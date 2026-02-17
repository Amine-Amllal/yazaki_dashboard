import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const projectId = searchParams.get("projectId") || "";
    const typeDFC = searchParams.get("typeDFC") || "";
    const faisabilite = searchParams.get("faisabilite") || "";
    const status = searchParams.get("status") || "";

    const where: Record<string, unknown> = {};

    if (search) {
        where.OR = [
            { description: { contains: search } },
            { numeroDerogation: { contains: search } },
            { commentaire: { contains: search } },
        ];
    }

    if (projectId) where.projectId = projectId;
    if (typeDFC) where.typeDFC = typeDFC;
    if (faisabilite) where.faisabilite = faisabilite;
    if (status === "open") where.dateReponse = null;
    if (status === "closed") where.dateReponse = { not: null };

    const [dfcs, total] = await Promise.all([
        prisma.dFC.findMany({
            where,
            include: {
                project: true,
                family: true,
                phase: true,
                createdBy: { select: { nom: true, prenom: true, matricule: true } },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.dFC.count({ where }),
    ]);

    return NextResponse.json({
        dfcs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const userId = (session.user as Record<string, unknown>).id as string;

        // Auto-generate numero
        const lastDfc = await prisma.dFC.findFirst({ orderBy: { numero: "desc" } });
        const numero = (lastDfc?.numero || 0) + 1;

        const dfc = await prisma.dFC.create({
            data: {
                numero,
                projectId: body.projectId,
                familyId: body.familyId,
                phaseId: body.phaseId,
                description: body.description,
                dateReception: new Date(body.dateReception),
                faisabilite: body.faisabilite || "EN_COURS",
                dateReponse: body.dateReponse ? new Date(body.dateReponse) : null,
                typeDFC: body.typeDFC || "T1",
                delaiReponse: body.delaiReponse ? parseInt(body.delaiReponse) : null,
                dateReceptionDerogation: body.dateReceptionDerogation
                    ? new Date(body.dateReceptionDerogation)
                    : null,
                numeroDerogation: body.numeroDerogation || null,
                dateApplicationEstimee: body.dateApplicationEstimee
                    ? new Date(body.dateApplicationEstimee)
                    : null,
                dateApplicationDerogation: body.dateApplicationDerogation
                    ? new Date(body.dateApplicationDerogation)
                    : null,
                commentaire: body.commentaire || null,
                createdById: userId,
                histories: {
                    create: {
                        userId,
                        field: "STATUS",
                        newValue: "CREATED",
                    }
                }
            },
            include: {
                project: true,
                family: true,
                phase: true,
            },
        });

        return NextResponse.json(dfc, { status: 201 });
    } catch (error) {
        console.error("Error creating DFC:", error);
        return NextResponse.json(
            { error: "Erreur lors de la création du DFC" },
            { status: 500 }
        );
    }
}
