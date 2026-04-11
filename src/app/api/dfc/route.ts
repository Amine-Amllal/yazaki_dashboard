import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { createDFCSchema } from "@/lib/validations";
import { applyRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

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
    // Rate limit : 20 créations DFC/min par IP
    const rateLimitError = applyRateLimit(request, RATE_LIMIT_PRESETS.CREATE, "dfc-create");
    if (rateLimitError) return rateLimitError;

    const { session, error } = await getSessionOrFail();
    if (error) return error;

    try {
        const body = await request.json();

        // Validate input
        const parsed = createDFCSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const data = parsed.data;
        const userId = session.user.id;

        const incomingDerogations = Array.isArray(body.derogations)
            ? body.derogations.filter((d: unknown) => d && typeof d === "object")
            : [];
        const incomingEco = body.eco && typeof body.eco === "object" ? body.eco : null;

        // Use transaction to atomically get next numero and create DFC
        const dfc = await prisma.$transaction(async (tx) => {
            const lastDfc = await tx.dFC.findFirst({ orderBy: { numero: "desc" } });
            const numero = (lastDfc?.numero || 0) + 1;

            const createdDfc = await tx.dFC.create({
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

            const derogationsPayload = incomingDerogations.length > 0
                ? incomingDerogations
                : (data.numeroDerogation || data.dateReceptionDerogation || data.dateApplicationEstimee || data.dateApplicationDerogation
                    ? [{
                        numero: data.numeroDerogation,
                        dateReception: data.dateReceptionDerogation,
                        dateApplicationEstimee: data.dateApplicationEstimee,
                        dateApplicationEffective: data.dateApplicationDerogation,
                        commentaire: data.commentaire,
                    }]
                    : []);

            for (const entry of derogationsPayload) {
                const d = entry as Record<string, string | null | undefined>;
                await tx.derogation.create({
                    data: {
                        dfcId: createdDfc.id,
                        numero: d.numero || null,
                        dateReception: d.dateReception ? new Date(d.dateReception) : null,
                        dateApplicationEstimee: d.dateApplicationEstimee
                            ? new Date(d.dateApplicationEstimee)
                            : null,
                        dateApplicationEffective: d.dateApplicationEffective
                            ? new Date(d.dateApplicationEffective)
                            : null,
                        commentaire: d.commentaire || null,
                        createdById: userId,
                    },
                });
            }

            if (incomingEco) {
                const eco = incomingEco as Record<string, string | null | undefined>;
                if (eco.code) {
                    await tx.eCO.create({
                        data: {
                            dfcId: createdDfc.id,
                            code: eco.code,
                            status: eco.status || "DRAFT",
                            issuedAt: eco.issuedAt ? new Date(eco.issuedAt) : null,
                            commentaire: eco.commentaire || null,
                            createdById: userId,
                        },
                    });
                }
            }

            return createdDfc;
        });

        return NextResponse.json(dfc, { status: 201 });
    } catch (err) {
        return handleApiError(err, "Failed to create DFC");
    }
}
