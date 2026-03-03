import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, handleApiError } from "@/lib/api-helpers";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;
    const dfc = await prisma.dFC.findUnique({
        where: { id },
        include: {
            project: true,
            family: true,
            phase: true,
            createdBy: { select: { nom: true, prenom: true, matricule: true } },
            histories: {
                include: { user: { select: { nom: true, prenom: true } } },
                orderBy: { changedAt: "desc" },
            },
        },
    });

    if (!dfc) {
        return NextResponse.json({ error: "DFC non trouvé" }, { status: 404 });
    }

    return NextResponse.json(dfc);
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

    try {
        // Use a transaction to ensure atomicity of update + history
        const dfc = await prisma.$transaction(async (tx) => {
            const currentDfc = await tx.dFC.findUnique({ where: { id } });
            if (!currentDfc) {
                throw new Error("DFC_NOT_FOUND");
            }

            // Track changes — proper null-safe comparison
            const fieldsToTrack = [
                "description", "faisabilite", "typeDFC", "commentaire",
                "projectId", "familyId", "phaseId", "numeroDerogation",
            ];

            const historyEntries = [];
            for (const field of fieldsToTrack) {
                const oldVal = (currentDfc as Record<string, unknown>)[field];
                const newVal = body[field];
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
                "faisabilite", "typeDFC", "commentaire", "numeroDerogation",
            ];

            for (const f of allowedFields) {
                if (body[f] !== undefined) {
                    updateData[f] = body[f];
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

            if (body.delaiReponse !== undefined) {
                updateData.delaiReponse = body.delaiReponse ? parseInt(body.delaiReponse) : null;
            }

            // Execute update + history atomically
            const updated = await tx.dFC.update({
                where: { id },
                data: updateData,
                include: { project: true, family: true, phase: true },
            });

            if (historyEntries.length > 0) {
                await tx.dFCHistory.createMany({ data: historyEntries });
            }

            return updated;
        });

        return NextResponse.json(dfc);
    } catch (err) {
        if (err instanceof Error && err.message === "DFC_NOT_FOUND") {
            return NextResponse.json({ error: "DFC non trouvé" }, { status: 404 });
        }
        return handleApiError(err, "Erreur lors de la modification du DFC");
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
        await prisma.dFC.delete({ where: { id } });
        return NextResponse.json({ message: "DFC supprimé" });
    } catch (err) {
        return handleApiError(err, "Erreur lors de la suppression");
    }
}
