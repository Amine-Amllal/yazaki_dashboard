import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { applyRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import {
    deleteFeasibilityFile,
    saveFeasibilityFile,
} from "@/lib/storage/dfc-files";

async function getAuthorizedDfc(
    id: string,
    userId: string,
    role: string
) {
    const dfc = await prisma.dFC.findUnique({
        where: { id },
        select: { id: true, createdById: true, assignedToId: true },
    });

    if (!dfc) {
        return { dfc: null, error: NextResponse.json({ error: "DFC not found" }, { status: 404 }) };
    }

    const canAccess = role === "ADMIN" || dfc.createdById === userId || dfc.assignedToId === userId;
    if (!canAccess) {
        return {
            dfc: null,
            error: NextResponse.json(
                { error: "You are not allowed to access files for this DFC" },
                { status: 403 }
            ),
        };
    }

    return { dfc, error: null };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;
    const authz = await getAuthorizedDfc(id, session.user.id, session.user.role);
    if (authz.error) return authz.error;

    const files = await prisma.dFCFile.findMany({
        where: { dfcId: id },
        include: {
            uploadedBy: {
                select: { nom: true, prenom: true, matricule: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ files });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const rateLimitError = applyRateLimit(request, RATE_LIMIT_PRESETS.FILE_UPLOAD, "dfc-file-upload");
    if (rateLimitError) return rateLimitError;

    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;
    const authz = await getAuthorizedDfc(id, session.user.id, session.user.role);
    if (authz.error) return authz.error;

    try {
        const formData = await request.formData();
        const formEntries = formData.getAll("files");
        const files = formEntries.filter((entry): entry is File => entry instanceof File);

        if (files.length === 0) {
            return NextResponse.json(
                { error: "At least one file is required" },
                { status: 400 }
            );
        }

        const createdFiles = [];

        for (const incomingFile of files) {
            const stored = await saveFeasibilityFile(id, incomingFile);

            try {
                const created = await prisma.dFCFile.create({
                    data: {
                        dfcId: id,
                        originalName: stored.originalName,
                        storedName: stored.storedName,
                        mimeType: stored.mimeType,
                        sizeBytes: stored.sizeBytes,
                        relativePath: stored.relativePath,
                        uploadedById: session.user.id,
                    },
                    include: {
                        uploadedBy: {
                            select: { nom: true, prenom: true, matricule: true },
                        },
                    },
                });

                createdFiles.push(created);
            } catch (err) {
                await deleteFeasibilityFile(stored.relativePath);
                throw err;
            }
        }

        await prisma.dFC.update({
            where: { id },
            data: { updatedAt: new Date() },
        });

        return NextResponse.json({ files: createdFiles }, { status: 201 });
    } catch (err) {
        if (err instanceof Error) {
            if (err.message === "Empty file is not allowed") {
                return NextResponse.json({ error: err.message }, { status: 400 });
            }
            if (err.message === "Unsupported file type") {
                return NextResponse.json({ error: err.message }, { status: 400 });
            }
            if (err.message === "File is too large") {
                return NextResponse.json({ error: err.message }, { status: 413 });
            }
        }
        return handleApiError(err, "Failed to upload feasibility file");
    }
}
