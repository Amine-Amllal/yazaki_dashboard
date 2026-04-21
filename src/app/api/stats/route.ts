import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail } from "@/lib/api-helpers";
import { syncOverdueDfcsAndNotify } from "@/lib/sla";

type SortDirection = "asc" | "desc";

type ResponsablePerformance = {
    responsableId: string;
    name: string;
    matricule: string;
    fonction: string;
    totalDFC: number;
    openDFC: number;
    closedDFC: number;
    inProgressDFC: number;
    treatedCount: number;
    tauxFaisabilite: number;
    responseRate: number;
    delaiMoyen: number;
    performanceScore: number;
    difficulty: "OK" | "WARNING" | "CRITICAL";
};

function round(value: number, precision = 1) {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}

function buildDifficultyLevel(
    delaiMoyen: number,
    tauxFaisabilite: number,
    openDFC: number,
    thresholdDelai: number,
    thresholdBacklog: number
): "OK" | "WARNING" | "CRITICAL" {
    if (delaiMoyen > thresholdDelai + 7 || tauxFaisabilite < 50 || openDFC > thresholdBacklog + 10) {
        return "CRITICAL";
    }
    if (delaiMoyen > thresholdDelai || tauxFaisabilite < 70 || openDFC > thresholdBacklog) {
        return "WARNING";
    }
    return "OK";
}

function sortResponsables(
    data: ResponsablePerformance[],
    sortBy: string,
    order: SortDirection
): ResponsablePerformance[] {
    const direction = order === "asc" ? 1 : -1;

    const getter = (item: ResponsablePerformance) => {
        if (sortBy === "totalDFC") return item.totalDFC;
        if (sortBy === "openDFC") return item.openDFC;
        if (sortBy === "closedDFC") return item.closedDFC;
        if (sortBy === "inProgressDFC") return item.inProgressDFC;
        if (sortBy === "treatedCount") return item.treatedCount;
        if (sortBy === "tauxFaisabilite") return item.tauxFaisabilite;
        if (sortBy === "responseRate") return item.responseRate;
        if (sortBy === "delaiMoyen") return item.delaiMoyen;
        return item.performanceScore;
    };

    return [...data].sort((a, b) => {
        const av = getter(a);
        const bv = getter(b);

        if (av === bv) {
            if (a.treatedCount !== b.treatedCount) {
                return (a.treatedCount - b.treatedCount) * direction;
            }
            return a.name.localeCompare(b.name);
        }

        return (av - bv) * direction;
    });
}

export async function GET(request: NextRequest) {
    const { error } = await getSessionOrFail();
    if (error) return error;

    await syncOverdueDfcsAndNotify();

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
    const overdueOnly = searchParams.get("overdueOnly");
    const sortBy = searchParams.get("sortBy") || "performanceScore";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const thresholdDelai = Number(searchParams.get("thresholdDelai") || 14);
    const thresholdBacklog = Number(searchParams.get("thresholdBacklog") || 20);

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
    if (responsableId) where.assignedToId = responsableId;
    if (faisabilite) where.faisabilite = faisabilite;
    if (overdueOnly === "true") {
        where.isOverdue = true;
        where.dateReponse = null;
    }

    const [
        totalDFC,
        dfcOuverts,
        dfcFermes,
        dfcByType,
        dfcByProject,
        dfcByFaisabilite,
        recentDFCs,
        allDFCs,
        allDfcsForPerformance,
        overdueCount,
        overdueByProjectRaw,
        overdueRenault,
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
            include: {
                project: true,
                family: true,
                assignedTo: { select: { id: true, nom: true, prenom: true, matricule: true } },
            },
        }),
        prisma.dFC.findMany({
            where: { ...where, delaiReponse: { not: null } },
            select: { delaiReponse: true },
        }),
        prisma.dFC.findMany({
            where,
            select: {
                id: true,
                createdById: true,
                assignedToId: true,
                dateReponse: true,
                delaiReponse: true,
                faisabilite: true,
            },
        }),
        prisma.dFC.count({
            where: {
                ...where,
                isOverdue: true,
                dateReponse: null,
            },
        }),
        prisma.dFC.groupBy({
            by: ["projectId"],
            where: {
                ...where,
                isOverdue: true,
                dateReponse: null,
            },
            _count: { id: true },
        }),
        prisma.dFC.findMany({
            where: {
                ...where,
                isOverdue: true,
                dateReponse: null,
                project: { name: "Renault" },
            },
            orderBy: [
                { overdueSince: "asc" },
                { dateReception: "asc" },
            ],
            take: 8,
            include: {
                project: { select: { name: true } },
                assignedTo: { select: { id: true, nom: true, prenom: true, matricule: true } },
                createdBy: { select: { nom: true, prenom: true, matricule: true } },
            },
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

    const overdueByProject = (overdueByProjectRaw || []).map((item) => ({
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

    // Compute performance by assigned responsible
    const responsibleIds = Array.from(new Set(
        allDfcsForPerformance
            .map((dfc) => dfc.assignedToId || dfc.createdById)
            .filter((id): id is string => Boolean(id))
    ));

    const users = responsibleIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: responsibleIds } },
            select: { id: true, nom: true, prenom: true, matricule: true, fonction: true },
        })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));
    const accumulator = new Map<string, {
        totalDFC: number;
        openDFC: number;
        closedDFC: number;
        inProgressDFC: number;
        treatedCount: number;
        feasibleOui: number;
        feasibleNon: number;
        delaySum: number;
        delayCount: number;
    }>();

    for (const dfc of allDfcsForPerformance) {
        const rid = dfc.assignedToId || dfc.createdById;
        if (!rid) continue;

        if (!accumulator.has(rid)) {
            accumulator.set(rid, {
                totalDFC: 0,
                openDFC: 0,
                closedDFC: 0,
                inProgressDFC: 0,
                treatedCount: 0,
                feasibleOui: 0,
                feasibleNon: 0,
                delaySum: 0,
                delayCount: 0,
            });
        }

        const current = accumulator.get(rid)!;
        current.totalDFC += 1;

        if (dfc.dateReponse) {
            current.closedDFC += 1;
            current.treatedCount += 1;
        } else {
            current.openDFC += 1;
        }

        if (dfc.faisabilite === "EN_COURS" || dfc.faisabilite === "A_CLARIFIER") {
            current.inProgressDFC += 1;
        }

        if (dfc.faisabilite === "OUI") {
            current.feasibleOui += 1;
        }
        if (dfc.faisabilite === "NON") {
            current.feasibleNon += 1;
        }

        if (typeof dfc.delaiReponse === "number") {
            current.delaySum += dfc.delaiReponse;
            current.delayCount += 1;
        }
    }

    const responsablesPerformanceRaw: ResponsablePerformance[] = Array.from(accumulator.entries())
        .map(([rid, metrics]) => {
            const user = userMap.get(rid);
            const denom = metrics.feasibleOui + metrics.feasibleNon;
            const tauxFaisabilite = denom > 0 ? round((metrics.feasibleOui / denom) * 100) : 0;
            const responseRate = metrics.totalDFC > 0 ? round((metrics.closedDFC / metrics.totalDFC) * 100) : 0;
            const delaiMoyen = metrics.delayCount > 0 ? round(metrics.delaySum / metrics.delayCount) : 0;

            const delayScore = Math.max(0, 100 - delaiMoyen * 3);
            const performanceScore = round((responseRate * 0.45) + (tauxFaisabilite * 0.35) + (delayScore * 0.2));

            return {
                responsableId: rid,
                name: user ? `${user.prenom} ${user.nom}` : "Unknown user",
                matricule: user?.matricule || "N/A",
                fonction: user?.fonction || "UNKNOWN",
                totalDFC: metrics.totalDFC,
                openDFC: metrics.openDFC,
                closedDFC: metrics.closedDFC,
                inProgressDFC: metrics.inProgressDFC,
                treatedCount: metrics.treatedCount,
                tauxFaisabilite,
                responseRate,
                delaiMoyen,
                performanceScore,
                difficulty: buildDifficultyLevel(delaiMoyen, tauxFaisabilite, metrics.openDFC, thresholdDelai, thresholdBacklog),
            };
        });

    const responsablesPerformance = sortResponsables(responsablesPerformanceRaw, sortBy, order as SortDirection);

    // Fetch filter options (projects, families, users)
    const [allProjects, allFamilies, allUsers] = await Promise.all([
        prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.family.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.user.findMany({ where: { active: true }, orderBy: { nom: "asc" }, select: { id: true, nom: true, prenom: true } }),
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
        overdueCount,
        overdueByProject,
        overdueRenault: overdueRenault || [],
        responsablesPerformance,
        filterOptions: {
            projects: allProjects,
            families: allFamilies,
            users: allUsers.map((u) => ({ id: u.id, name: `${u.prenom} ${u.nom}` })),
        },
    });
}
