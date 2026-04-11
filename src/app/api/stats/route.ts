import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
    const { error } = await getSessionOrFail();
    if (error) return error;

    // Parse filter parameters
    const { searchParams } = new URL(request.url);
    const dateStart = searchParams.get("dateStart");
    const dateEnd = searchParams.get("dateEnd");
    const projectId = searchParams.get("projectId");
    const familyId = searchParams.get("familyId");
    const typeDFC = searchParams.get("typeDFC");
    const statut = searchParams.get("statut"); // open | closed
    const responsableId = searchParams.get("responsableId");
    const faisabilite = searchParams.get("faisabilite"); // OUI | NON | EN_COURS | A_CLARIFIER

    // Build where clause from filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (dateStart || dateEnd) {
        where.dateReception = {};
        if (dateStart) where.dateReception.gte = new Date(dateStart);
        if (dateEnd) {
            const end = new Date(dateEnd);
            end.setHours(23, 59, 59, 999);
            where.dateReception.lte = end;
        }
    }
    if (projectId) where.projectId = projectId;
    if (familyId) where.familyId = familyId;
    if (typeDFC) where.typeDFC = typeDFC;
    if (statut === "open") where.dateReponse = null;
    if (statut === "closed") where.dateReponse = { not: null };
    if (responsableId) where.createdById = responsableId;
    if (faisabilite) where.faisabilite = faisabilite;

    const [
        totalDFC,
        dfcOuverts,
        dfcFermes,
        dfcByType,
        dfcByProject,
        dfcByFaisabilite,
        recentDFCs,
        allDFCs,
    ] = await Promise.all([
        prisma.dFC.count({ where }),
        prisma.dFC.count({ where: { ...where, dateReponse: null } }),
        prisma.dFC.count({ where: { ...where, dateReponse: { not: null } } }),
        prisma.dFC.groupBy({ by: ["typeDFC"], where, _count: { id: true } }),
        prisma.dFC.groupBy({ by: ["projectId"], where, _count: { id: true } }),
        prisma.dFC.groupBy({ by: ["faisabilite"], where, _count: { id: true } }),
        prisma.dFC.findMany({
            where,
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { project: true, family: true },
        }),
        prisma.dFC.findMany({
            where: { ...where, delaiReponse: { not: null } },
            select: { delaiReponse: true },
        }),
    ]);

    // Calculate average response time
    const delais = allDFCs
        .map((d) => d.delaiReponse)
        .filter((d): d is number => d !== null);
    const delaiMoyen = delais.length > 0
        ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length)
        : 0;

    // Get project names for the chart
    const projects = await prisma.project.findMany();
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

    const dfcByProjectNamed = dfcByProject.map((item) => ({
        name: projectMap[item.projectId] || "Unknown",
        count: item._count.id,
    }));

    const dfcByTypeNamed = dfcByType.map((item) => ({
        name: item.typeDFC,
        count: item._count.id,
    }));

    const dfcByFaisabiliteNamed = dfcByFaisabilite.map((item) => ({
        name: item.faisabilite === "OUI" ? "Yes"
            : item.faisabilite === "NON" ? "No"
                : item.faisabilite === "EN_COURS" ? "In progress"
                    : "Needs clarification",
        count: item._count.id,
    }));

    // Monthly trend based on filtered data (up to last 12 months)
    const monthlyWhere = { ...where };
    if (!dateStart && !dateEnd) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        monthlyWhere.dateReception = { gte: sixMonthsAgo };
    }

    const monthlyDFCs = await prisma.dFC.findMany({
        where: monthlyWhere,
        select: { dateReception: true, dateReponse: true },
    });

    const monthlyTrend: Record<string, { received: number; answered: number }> = {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    monthlyDFCs.forEach((dfc) => {
        const date = new Date(dfc.dateReception);
        const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
        if (!monthlyTrend[key]) monthlyTrend[key] = { received: 0, answered: 0 };
        monthlyTrend[key].received++;
        if (dfc.dateReponse) monthlyTrend[key].answered++;
    });

    const monthlyData = Object.entries(monthlyTrend).map(([month, data]) => ({
        month,
        ...data,
    }));

    // Fetch filter options (projects, families, users)
    const [allProjects, allFamilies, allUsers] = await Promise.all([
        prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.family.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.user.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true, prenom: true } }),
    ]);

    return NextResponse.json({
        totalDFC,
        dfcOuverts,
        dfcFermes,
        delaiMoyen,
        dfcByType: dfcByTypeNamed,
        dfcByProject: dfcByProjectNamed,
        dfcByFaisabilite: dfcByFaisabiliteNamed,
        monthlyData,
        recentDFCs,
        filterOptions: {
            projects: allProjects,
            families: allFamilies,
            users: allUsers.map((u) => ({ id: u.id, name: `${u.prenom} ${u.nom}` })),
        },
    });
}
