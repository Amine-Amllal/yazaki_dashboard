import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail } from "@/lib/api-helpers";
import { readFeasibilityFile } from "@/lib/storage/dfc-files";

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
        },
    });

    if (!file) {
        return { file: null, error: NextResponse.json({ error: "File not found" }, { status: 404 }) };
    }

    if (file.dfc.createdById !== userId && role !== "ADMIN") {
        return {
            file: null,
            error: NextResponse.json(
                { error: "You are not allowed to download this file" },
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

    try {
        const content = await readFeasibilityFile(authz.file.relativePath);

        return new NextResponse(content, {
            status: 200,
            headers: {
                "Content-Type": authz.file.mimeType || "application/octet-stream",
                "Content-Length": String(authz.file.sizeBytes),
                "Content-Disposition": `attachment; filename="${encodeURIComponent(authz.file.originalName)}"`,
                "Cache-Control": "private, no-store",
            },
        });
    } catch {
        return NextResponse.json({ error: "Stored file is missing" }, { status: 404 });
    }
}
