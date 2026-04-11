import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { deleteFeasibilityFile } from "@/lib/storage/dfc-files";

async function getAuthorizedFile(
    dfcId: string,
    fileId: string,
    userId: string,
    role: string
) {
    const file = await prisma.dFCFile.findFirst({
        where: { id: fileId, dfcId },
        include: {
            dfc: { select: { createdById: true } },
            uploadedBy: { select: { nom: true, prenom: true, matricule: true } },
        },
    });

    if (!file) {
        return { file: null, error: NextResponse.json({ error: "File not found" }, { status: 404 }) };
    }

    if (file.dfc.createdById !== userId && role !== "ADMIN") {
        return {
            file: null,
            error: NextResponse.json(
                { error: "You are not allowed to access this file" },
                { status: 403 }
            ),
        };
    }

    return { file, error: null };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; fileId: string }> }
) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id, fileId } = await params;
    const authz = await getAuthorizedFile(id, fileId, session.user.id, session.user.role);
    if (authz.error) return authz.error;

    return NextResponse.json({ file: authz.file });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; fileId: string }> }
) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id, fileId } = await params;
    const authz = await getAuthorizedFile(id, fileId, session.user.id, session.user.role);
    if (authz.error) return authz.error;

    try {
        await prisma.dFCFile.delete({ where: { id: fileId } });
        await deleteFeasibilityFile(authz.file.relativePath);
        await prisma.dFC.update({ where: { id }, data: { updatedAt: new Date() } });

        return NextResponse.json({ success: true });
    } catch (err) {
        return handleApiError(err, "Failed to delete feasibility file");
    }
}
