import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { upsertEcoSchema } from "@/lib/validations";

async function getAuthorizedDfc(id: string, userId: string, role: string) {
    const dfc = await prisma.dFC.findUnique({
        where: { id },
        select: { id: true, createdById: true },
    });

    if (!dfc) {
        return { dfc: null, error: NextResponse.json({ error: "DFC not found" }, { status: 404 }) };
    }

    if (dfc.createdById !== userId && role !== "ADMIN") {
        return {
            dfc: null,
            error: NextResponse.json(
                { error: "You are not allowed to access ECO for this DFC" },
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

    const eco = await prisma.eCO.findUnique({ where: { dfcId: id } });
    return NextResponse.json({ eco });
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;
    const authz = await getAuthorizedDfc(id, session.user.id, session.user.role);
    if (authz.error) return authz.error;

    try {
        const body = await request.json();
        const parsed = upsertEcoSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const data = parsed.data;
        const eco = await prisma.eCO.upsert({
            where: { dfcId: id },
            create: {
                dfcId: id,
                code: data.code,
                status: data.status,
                issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
                commentaire: data.commentaire || null,
                createdById: session.user.id,
            },
            update: {
                code: data.code,
                status: data.status,
                issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
                commentaire: data.commentaire || null,
            },
        });

        await prisma.dFCHistory.create({
            data: {
                dfcId: id,
                userId: session.user.id,
                field: "ECO_UPSERT",
                newValue: eco.code,
            },
        });

        return NextResponse.json({ eco });
    } catch (err) {
        return handleApiError(err, "Failed to upsert ECO");
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;
    const authz = await getAuthorizedDfc(id, session.user.id, session.user.role);
    if (authz.error) return authz.error;

    try {
        const existing = await prisma.eCO.findUnique({ where: { dfcId: id } });
        if (!existing) {
            return NextResponse.json({ error: "ECO not found" }, { status: 404 });
        }

        await prisma.eCO.delete({ where: { dfcId: id } });

        await prisma.dFCHistory.create({
            data: {
                dfcId: id,
                userId: session.user.id,
                field: "ECO_DELETED",
                oldValue: existing.code,
            },
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        return handleApiError(err, "Failed to delete ECO");
    }
}
