import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { updateDerogationSchema } from "@/lib/validations";

async function getAuthorizedDerogation(
    dfcId: string,
    derogationId: string,
    userId: string,
    role: string
) {
    const derogation = await prisma.derogation.findFirst({
        where: { id: derogationId, dfcId },
        include: {
            dfc: { select: { createdById: true } },
            createdBy: { select: { nom: true, prenom: true, matricule: true } },
        },
    });

    if (!derogation) {
        return {
            derogation: null,
            error: NextResponse.json({ error: "Derogation not found" }, { status: 404 }),
        };
    }

    if (derogation.dfc.createdById !== userId && role !== "ADMIN") {
        return {
            derogation: null,
            error: NextResponse.json(
                { error: "You are not allowed to modify this derogation" },
                { status: 403 }
            ),
        };
    }

    return { derogation, error: null };
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; derogationId: string }> }
) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id, derogationId } = await params;
    const authz = await getAuthorizedDerogation(id, derogationId, session.user.id, session.user.role);
    if (authz.error) return authz.error;

    try {
        const body = await request.json();
        const parsed = updateDerogationSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const data = parsed.data;
        const updated = await prisma.derogation.update({
            where: { id: derogationId },
            data: {
                numero: data.numero !== undefined ? data.numero || null : undefined,
                dateReception:
                    data.dateReception !== undefined
                        ? data.dateReception
                            ? new Date(data.dateReception)
                            : null
                        : undefined,
                dateApplicationEstimee:
                    data.dateApplicationEstimee !== undefined
                        ? data.dateApplicationEstimee
                            ? new Date(data.dateApplicationEstimee)
                            : null
                        : undefined,
                dateApplicationEffective:
                    data.dateApplicationEffective !== undefined
                        ? data.dateApplicationEffective
                            ? new Date(data.dateApplicationEffective)
                            : null
                        : undefined,
                commentaire:
                    data.commentaire !== undefined ? data.commentaire || null : undefined,
            },
            include: {
                createdBy: { select: { nom: true, prenom: true, matricule: true } },
            },
        });

        await prisma.dFCHistory.create({
            data: {
                dfcId: id,
                userId: session.user.id,
                field: "DEROGATION_UPDATED",
                newValue: updated.numero || "updated",
            },
        });

        return NextResponse.json(updated);
    } catch (err) {
        return handleApiError(err, "Failed to update derogation");
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; derogationId: string }> }
) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id, derogationId } = await params;
    const authz = await getAuthorizedDerogation(id, derogationId, session.user.id, session.user.role);
    if (authz.error) return authz.error;

    try {
        await prisma.derogation.delete({ where: { id: derogationId } });

        await prisma.dFCHistory.create({
            data: {
                dfcId: id,
                userId: session.user.id,
                field: "DEROGATION_DELETED",
                oldValue: authz.derogation.numero || "deleted",
            },
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        return handleApiError(err, "Failed to delete derogation");
    }
}
