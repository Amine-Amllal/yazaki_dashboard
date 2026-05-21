import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { deleteDfcFeasibilityDirectory, deleteFeasibilityFile } from "@/lib/storage/dfc-files";
import { computeSlaForDfc, createOverdueNotification } from "@/lib/sla";

type DerogationPayload = {
    id?: string;
    numero?: string | null;
    dateReception?: string | null;
    dateApplicationEstimee?: string | null;
    dateApplicationEffective?: string | null;
    commentaire?: string | null;
};

type EcoPayload = {
    code?: string | null;
    status?: string | null;
    issuedAt?: string | null;
    commentaire?: string | null;
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await getSessionOrFail();
    if (error) return error;

    try {
        const { id } = await params;

        const baseDfc = await prisma.dFC.findUnique({ where: { id } });
        if (!baseDfc) {
            return NextResponse.json({ error: "DFC not found" }, { status: 404 });
        }

        const [project, family, phase, creator, assignedUser, derogationsRaw, eco, historiesRaw] = await Promise.all([
            prisma.project.findUnique({ where: { id: baseDfc.projectId } }),
            prisma.family.findUnique({ where: { id: baseDfc.familyId } }),
            prisma.phase.findUnique({ where: { id: baseDfc.phaseId } }),
            prisma.user.findUnique({
                where: { id: baseDfc.createdById },
                select: { nom: true, prenom: true, matricule: true },
            }),
            prisma.user.findUnique({
                where: { id: baseDfc.assignedToId || baseDfc.createdById },
                select: { id: true, nom: true, prenom: true, matricule: true },
            }),
            prisma.derogation.findMany({
                where: { dfcId: id },
                orderBy: { createdAt: "desc" },
            }),
            prisma.eCO.findUnique({ where: { dfcId: id } }),
            prisma.dFCHistory.findMany({
                where: { dfcId: id },
                orderBy: { changedAt: "desc" },
            }),
        ]);

        if (!project || !family || !phase || !creator) {
            return NextResponse.json(
                { error: "DFC has inconsistent reference data (project/family/phase/creator)" },
                { status: 409 }
            );
        }

        const derogationUserIds = Array.from(new Set(derogationsRaw.map((d) => d.createdById)));
        const historyUserIds = Array.from(new Set(historiesRaw.map((h) => h.userId)));
        const relatedUserIds = Array.from(new Set([...derogationUserIds, ...historyUserIds]));

        const relatedUsers = relatedUserIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: relatedUserIds } },
                select: { id: true, nom: true, prenom: true, matricule: true },
            })
            : [];

        const userMap = new Map(relatedUsers.map((u) => [u.id, u]));

        const derogations = derogationsRaw.map((d) => ({
            ...d,
            createdBy: userMap.get(d.createdById)
                ? {
                    nom: userMap.get(d.createdById)!.nom,
                    prenom: userMap.get(d.createdById)!.prenom,
                    matricule: userMap.get(d.createdById)!.matricule,
                }
                : { nom: "Unknown", prenom: "User", matricule: "N/A" },
        }));

        const histories = historiesRaw.map((h) => {
            const historyUser = userMap.get(h.userId);
            return {
                ...h,
                user: historyUser
                    ? { nom: historyUser.nom, prenom: historyUser.prenom }
                    : { nom: "Unknown", prenom: "User" },
            };
        });

        return NextResponse.json({
            ...baseDfc,
            project,
            family,
            phase,
            createdBy: creator,
            assignedTo: assignedUser,
            derogations,
            eco,
            histories,
        });
    } catch (err) {
        return handleApiError(err, "Failed to fetch DFC details");
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const userId = session.user.id;
    let pendingNotification: { userId: string; dfcId: string; numero: number; projectName: string } | null = null;

    try {
        // Use a transaction to ensure atomicity of update + history
        const dfc = await prisma.$transaction(async (tx) => {
            const currentDfc = await tx.dFC.findUnique({ where: { id } });
            if (!currentDfc) {
                throw new Error("DFC_NOT_FOUND");
            }

            // Authorization: only the creator or an ADMIN can modify
            if (currentDfc.createdById !== userId && currentDfc.assignedToId !== userId && session.user.role !== "ADMIN") {
                throw new Error("FORBIDDEN");
            }

            // Track changes — proper null-safe comparison
            const fieldsToTrack = [
                "description", "faisabilite", "typeDFC", "commentaire",
                "projectId", "familyId", "phaseId", "numeroDerogation", "assignedToId",
            ];

            const historyEntries = [];
            for (const field of fieldsToTrack) {
                const oldVal = (currentDfc as Record<string, unknown>)[field];
                const incomingVal = body[field];
                const newVal = field === "assignedToId" && (incomingVal === "" || incomingVal === null)
                    ? null
                    : incomingVal;
                if (newVal !== undefined) {
                    const oldStr = oldVal != null ? String(oldVal) : null;
                    const newStr = newVal != null ? String(newVal) : null;
                    if (oldStr !== newStr) {
                        historyEntries.push({
                            dfcId: id,
                            userId,
                            field,
                            oldValue: oldStr,
                            newValue: newStr,
                        });
                    }
                }
            }

            // Build update data
            const updateData: Record<string, unknown> = {};
            const allowedFields = [
                "projectId", "familyId", "phaseId", "description",
                "faisabilite", "typeDFC", "commentaire", "numeroDerogation", "assignedToId",
            ];

            for (const f of allowedFields) {
                if (body[f] !== undefined) {
                    if (f === "assignedToId") {
                        updateData[f] = body[f] ? String(body[f]) : null;
                    } else {
                        updateData[f] = body[f];
                    }
                }
            }

            const dateFields = [
                "dateReception", "dateReponse", "dateReceptionDerogation",
                "dateApplicationEstimee", "dateApplicationDerogation",
            ];
            for (const f of dateFields) {
                if (body[f] !== undefined) {
                    updateData[f] = body[f] ? new Date(body[f]) : null;
                }
            }

            if (body.assignedToId !== undefined) {
                if (body.assignedToId) {
                    const assigned = await tx.user.findFirst({
                        where: { id: String(body.assignedToId), active: true },
                        select: { id: true },
                    });
                    if (!assigned) {
                        throw new Error("INVALID_ASSIGNED_USER");
                    }
                    updateData.assignedAt = new Date();
                } else {
                    updateData.assignedAt = null;
                }
            }

            const nextProjectId = (updateData.projectId as string | undefined) ?? currentDfc.projectId;
            const nextTypeDFC = (updateData.typeDFC as string | undefined) ?? currentDfc.typeDFC;
            const nextDateReception = (updateData.dateReception as Date | null | undefined) ?? currentDfc.dateReception;
            const nextDateReponse = Object.prototype.hasOwnProperty.call(updateData, "dateReponse")
                ? ((updateData.dateReponse as Date | null | undefined) ?? null)
                : currentDfc.dateReponse;
            const nextAssignedToId = Object.prototype.hasOwnProperty.call(updateData, "assignedToId")
                ? ((updateData.assignedToId as string | null | undefined) ?? null)
                : (currentDfc.assignedToId ?? currentDfc.createdById);

            const sla = await computeSlaForDfc({
                projectId: nextProjectId,
                typeDFC: nextTypeDFC,
                dateReception: nextDateReception,
                dateReponse: nextDateReponse,
            });

            updateData.delaiReponse = sla.delaiReponse;
            updateData.slaDelayDays = sla.slaDelayDays;
            updateData.slaDueDate = sla.slaDueDate;
            updateData.isOverdue = sla.isOverdue;
            updateData.overdueSince = sla.overdueSince;

            const incomingDerogations = Array.isArray(body.derogations)
                ? (body.derogations as DerogationPayload[]).filter((entry) => entry && typeof entry === "object")
                : null;
            const incomingEco = body.eco === null
                ? null
                : (body.eco && typeof body.eco === "object" ? (body.eco as EcoPayload) : undefined);

            // Execute update + history atomically
            const updated = await tx.dFC.update({
                where: { id },
                data: updateData,
                include: { project: true, family: true, phase: true },
            });

            if (incomingDerogations) {
                for (const entry of incomingDerogations) {
                    if (entry.id) {
                        await tx.derogation.updateMany({
                            where: { id: entry.id, dfcId: id },
                            data: {
                                numero: entry.numero !== undefined ? entry.numero || null : undefined,
                                dateReception:
                                    entry.dateReception !== undefined
                                        ? entry.dateReception
                                            ? new Date(entry.dateReception)
                                            : null
                                        : undefined,
                                dateApplicationEstimee:
                                    entry.dateApplicationEstimee !== undefined
                                        ? entry.dateApplicationEstimee
                                            ? new Date(entry.dateApplicationEstimee)
                                            : null
                                        : undefined,
                                dateApplicationEffective:
                                    entry.dateApplicationEffective !== undefined
                                        ? entry.dateApplicationEffective
                                            ? new Date(entry.dateApplicationEffective)
                                            : null
                                        : undefined,
                                commentaire: entry.commentaire !== undefined ? entry.commentaire || null : undefined,
                            },
                        });
                    } else {
                        await tx.derogation.create({
                            data: {
                                dfcId: id,
                                numero: entry.numero || null,
                                dateReception: entry.dateReception ? new Date(entry.dateReception) : null,
                                dateApplicationEstimee: entry.dateApplicationEstimee
                                    ? new Date(entry.dateApplicationEstimee)
                                    : null,
                                dateApplicationEffective: entry.dateApplicationEffective
                                    ? new Date(entry.dateApplicationEffective)
                                    : null,
                                commentaire: entry.commentaire || null,
                                createdById: userId,
                            },
                        });
                    }
                }
            }

            if (incomingEco !== undefined) {
                if (incomingEco === null || !incomingEco.code) {
                    await tx.eCO.deleteMany({ where: { dfcId: id } });
                } else {
                    await tx.eCO.upsert({
                        where: { dfcId: id },
                        create: {
                            dfcId: id,
                            code: incomingEco.code,
                            status: incomingEco.status || "DRAFT",
                            issuedAt: incomingEco.issuedAt ? new Date(incomingEco.issuedAt) : null,
                            commentaire: incomingEco.commentaire || null,
                            createdById: userId,
                        },
                        update: {
                            code: incomingEco.code,
                            status: incomingEco.status || "DRAFT",
                            issuedAt: incomingEco.issuedAt ? new Date(incomingEco.issuedAt) : null,
                            commentaire: incomingEco.commentaire || null,
                        },
                    });
                }
            }

            if (historyEntries.length > 0) {
                await tx.dFCHistory.createMany({ data: historyEntries });
            }

            if (sla.isOverdue && nextAssignedToId) {
                pendingNotification = {
                    userId: nextAssignedToId,
                    dfcId: id,
                    numero: updated.numero,
                    projectName: updated.project.name,
                };
            }

            return updated;
        });

        if (pendingNotification) {
            const notif = pendingNotification as { userId: string; dfcId: string; numero: number; projectName: string };
            await createOverdueNotification({
                dfcId: notif.dfcId,
                numero: notif.numero,
                projectName: notif.projectName,
                userId: notif.userId,
            });
        }

        return NextResponse.json(dfc);
    } catch (err) {
        if (err instanceof Error && err.message === "DFC_NOT_FOUND") {
            return NextResponse.json({ error: "DFC not found" }, { status: 404 });
        }
        if (err instanceof Error && err.message === "FORBIDDEN") {
            return NextResponse.json({ error: "You are not allowed to modify this DFC" }, { status: 403 });
        }
        if (err instanceof Error && err.message === "INVALID_ASSIGNED_USER") {
            return NextResponse.json({ error: "Assigned responsible not found or inactive" }, { status: 400 });
        }
        return handleApiError(err, "Failed to update DFC");
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;

    try {
        // Check authorization: only the creator or an ADMIN can delete
        const dfc = await prisma.dFC.findUnique({ where: { id }, select: { createdById: true } });
        if (!dfc) {
            return NextResponse.json({ error: "DFC not found" }, { status: 404 });
        }
        if (dfc.createdById !== session.user.id && session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "You are not allowed to delete this DFC" }, { status: 403 });
        }

        const linkedFiles = await prisma.dFCFile.findMany({
            where: { dfcId: id },
            select: { relativePath: true },
        });

        for (const linkedFile of linkedFiles) {
            await deleteFeasibilityFile(linkedFile.relativePath);
        }

        await deleteDfcFeasibilityDirectory(id);

        await prisma.dFC.delete({ where: { id } });
        return NextResponse.json({ message: "DFC deleted" });
    } catch (err) {
        return handleApiError(err, "Failed to delete DFC");
    }
}
