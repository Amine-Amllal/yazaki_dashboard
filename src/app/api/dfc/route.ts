import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { createDFCSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
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
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    try {
        const body = await request.json();

        // Validate input
        const parsed = createDFCSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Données invalides", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const data = parsed.data;
        const userId = session.user.id;

        // Use transaction to atomically get next numero and create DFC
        const dfc = await prisma.$transaction(async (tx) => {
            const lastDfc = await tx.dFC.findFirst({ orderBy: { numero: "desc" } });
            const numero = (lastDfc?.numero || 0) + 1;

            return tx.dFC.create({
                data: {
                    numero,
                    projectId: data.projectId,
                    familyId: data.familyId,
                    phaseId: data.phaseId,
                    description: data.description,
                    dateReception: new Date(data.dateReception),
                    faisabilite: data.faisabilite || "EN_COURS",
                    dateReponse: data.dateReponse ? new Date(data.dateReponse) : null,
                    typeDFC: data.typeDFC || "T1",
                    delaiReponse: data.delaiReponse ? parseInt(String(data.delaiReponse)) : null,
                    dateReceptionDerogation: data.dateReceptionDerogation
                        ? new Date(data.dateReceptionDerogation)
                        : null,
                    numeroDerogation: data.numeroDerogation || null,
                    dateApplicationEstimee: data.dateApplicationEstimee
                        ? new Date(data.dateApplicationEstimee)
                        : null,
                    dateApplicationDerogation: data.dateApplicationDerogation
                        ? new Date(data.dateApplicationDerogation)
                        : null,
                    commentaire: data.commentaire || null,
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
        });

        return NextResponse.json(dfc, { status: 201 });
    } catch (err) {
        return handleApiError(err, "Erreur lors de la création du DFC");
    }
}
