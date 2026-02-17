import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

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
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const userId = (session.user as Record<string, unknown>).id as string;

    try {
        // Get current DFC for history tracking
        const currentDfc = await prisma.dFC.findUnique({ where: { id } });
        if (!currentDfc) {
            return NextResponse.json({ error: "DFC non trouvé" }, { status: 404 });
        }

        // Track changes
        const fieldsToTrack = [
            "description", "faisabilite", "typeDFC", "commentaire",
            "projectId", "familyId", "phaseId", "numeroDerogation",
        ];

        const historyEntries = [];
        for (const field of fieldsToTrack) {
            const oldVal = (currentDfc as Record<string, unknown>)[field];
            const newVal = body[field];
            if (newVal !== undefined && String(oldVal) !== String(newVal)) {
                historyEntries.push({
                    dfcId: id,
                    userId,
                    field,
                    oldValue: oldVal ? String(oldVal) : null,
                    newValue: newVal ? String(newVal) : null,
                });
            }
        }

        // Update DFC
        const updateData: Record<string, unknown> = {};
        const allowedFields = [
            "projectId", "familyId", "phaseId", "description",
            "faisabilite", "typeDFC", "commentaire", "numeroDerogation",
        ];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        // Handle date fields
        const dateFields = [
            "dateReception", "dateReponse", "dateReceptionDerogation",
            "dateApplicationEstimee", "dateApplicationDerogation",
        ];
        for (const field of dateFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field] ? new Date(body[field]) : null;
            }
        }

        if (body.delaiReponse !== undefined) {
            updateData.delaiReponse = body.delaiReponse ? parseInt(body.delaiReponse) : null;
        }

        const [dfc] = await Promise.all([
            prisma.dFC.update({
                where: { id },
                data: updateData,
                include: { project: true, family: true, phase: true },
            }),
            ...(historyEntries.length > 0
                ? [prisma.dFCHistory.createMany({ data: historyEntries })]
                : []),
        ]);

        return NextResponse.json(dfc);
    } catch (error) {
        console.error("Error updating DFC:", error);
        return NextResponse.json(
            { error: "Erreur lors de la modification du DFC" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    try {
        await prisma.dFC.delete({ where: { id } });
        return NextResponse.json({ message: "DFC supprimé" });
    } catch {
        return NextResponse.json(
            { error: "Erreur lors de la suppression" },
            { status: 500 }
        );
    }
}
