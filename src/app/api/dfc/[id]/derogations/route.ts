import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { createDerogationSchema } from "@/lib/validations";

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
                { error: "You are not allowed to access derogations for this DFC" },
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

    const derogations = await prisma.derogation.findMany({
        where: { dfcId: id },
        include: {
            createdBy: { select: { nom: true, prenom: true, matricule: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ derogations });
}

export async function POST(
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
        const parsed = createDerogationSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const data = parsed.data;

        const derogation = await prisma.derogation.create({
            data: {
                dfcId: id,
                numero: data.numero || null,
                dateReception: data.dateReception ? new Date(data.dateReception) : null,
                dateApplicationEstimee: data.dateApplicationEstimee
                    ? new Date(data.dateApplicationEstimee)
                    : null,
                dateApplicationEffective: data.dateApplicationEffective
                    ? new Date(data.dateApplicationEffective)
                    : null,
                commentaire: data.commentaire || null,
                createdById: session.user.id,
            },
            include: {
                createdBy: { select: { nom: true, prenom: true, matricule: true } },
            },
        });

        await prisma.dFCHistory.create({
            data: {
                dfcId: id,
                userId: session.user.id,
                field: "DEROGATION_CREATED",
                newValue: derogation.numero || "created",
            },
        });

        return NextResponse.json(derogation, { status: 201 });
    } catch (err) {
        return handleApiError(err, "Failed to create derogation");
    }
}
