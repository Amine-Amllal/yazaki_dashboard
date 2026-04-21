import prisma from "@/lib/prisma";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type SlaComputationResult = {
    slaDelayDays: number | null;
    slaDueDate: Date | null;
    isOverdue: boolean;
    overdueSince: Date | null;
    delaiReponse: number | null;
};

function toUtcStartOfDay(date: Date) {
    const normalized = new Date(date);
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
}

function toUtcEndOfDay(date: Date) {
    const normalized = new Date(date);
    normalized.setUTCHours(23, 59, 59, 999);
    return normalized;
}

function addDaysUtc(date: Date, days: number) {
    const normalized = new Date(date);
    normalized.setUTCDate(normalized.getUTCDate() + days);
    return normalized;
}

export function calculateElapsedDays(start: Date, end: Date) {
    const startMs = toUtcStartOfDay(start).getTime();
    const endMs = toUtcStartOfDay(end).getTime();

    if (endMs <= startMs) return 0;
    return Math.ceil((endMs - startMs) / DAY_IN_MS);
}

export async function getActiveSlaRule(projectId: string, typeDFC?: string | null) {
    if (!projectId) return null;

    const specificRule = typeDFC
        ? await prisma.slaRule.findFirst({
            where: {
                projectId,
                typeDFC,
                active: true,
            },
            select: { id: true, delayDays: true, active: true },
        })
        : null;

    if (specificRule) return specificRule;

    const fallbackRule = await prisma.slaRule.findFirst({
        where: {
            projectId,
            typeDFC: null,
            active: true,
        },
        select: { id: true, delayDays: true, active: true },
    });

    if (!fallbackRule || !fallbackRule.active) return null;
    return fallbackRule;
}

export async function computeSlaForDfc(params: {
    projectId: string;
    typeDFC?: string | null;
    dateReception: Date;
    dateReponse: Date | null;
    now?: Date;
}): Promise<SlaComputationResult> {
    const { projectId, typeDFC, dateReception, dateReponse, now = new Date() } = params;

    const effectiveDelai = dateReponse ? calculateElapsedDays(dateReception, dateReponse) : null;
    const rule = await getActiveSlaRule(projectId, typeDFC);

    if (!rule) {
        return {
            slaDelayDays: null,
            slaDueDate: null,
            isOverdue: false,
            overdueSince: null,
            delaiReponse: effectiveDelai,
        };
    }

    const dueDate = toUtcEndOfDay(addDaysUtc(toUtcStartOfDay(dateReception), rule.delayDays));
    const isOverdue = !dateReponse && now.getTime() > dueDate.getTime();

    return {
        slaDelayDays: rule.delayDays,
        slaDueDate: dueDate,
        isOverdue,
        overdueSince: isOverdue ? dueDate : null,
        delaiReponse: effectiveDelai,
    };
}

export async function syncOverdueDfcsAndNotify(now: Date = new Date()) {
    const overdueCandidates = await prisma.dFC.findMany({
        where: {
            dateReponse: null,
            slaDueDate: { not: null, lt: now },
            isOverdue: false,
            assignedToId: { not: null },
        },
        select: {
            id: true,
            numero: true,
            assignedToId: true,
            slaDueDate: true,
            project: { select: { name: true } },
        },
    });

    let markedOverdue = 0;
    let notificationsCreated = 0;

    for (const dfc of overdueCandidates) {
        const updateResult = await prisma.dFC.updateMany({
            where: {
                id: dfc.id,
                dateReponse: null,
                isOverdue: false,
            },
            data: {
                isOverdue: true,
                overdueSince: dfc.slaDueDate,
            },
        });

        if (updateResult.count !== 1 || !dfc.assignedToId) continue;

        markedOverdue += 1;

        const dedupeKey = `DFC_OVERDUE_OPEN:${dfc.id}:${dfc.assignedToId}`;
        const notification = await prisma.notification.upsert({
            where: { dedupeKey },
            update: {},
            create: {
                userId: dfc.assignedToId,
                dfcId: dfc.id,
                type: "DFC_OVERDUE_OPEN",
                message: `DFC #${dfc.numero} (${dfc.project.name}) en retard: delai depasse.`,
                dedupeKey,
            },
            select: { id: true },
        });

        if (notification?.id) notificationsCreated += 1;
    }

    const recovered = await prisma.dFC.updateMany({
        where: {
            isOverdue: true,
            OR: [
                { dateReponse: { not: null } },
                { slaDueDate: null },
            ],
        },
        data: {
            isOverdue: false,
            overdueSince: null,
        },
    });

    return {
        markedOverdue,
        notificationsCreated,
        recovered: recovered.count,
    };
}

export async function createOverdueNotification(params: {
    dfcId: string;
    numero: number;
    projectName: string;
    userId: string;
}) {
    const { dfcId, numero, projectName, userId } = params;
    const dedupeKey = `DFC_OVERDUE_OPEN:${dfcId}:${userId}`;

    return prisma.notification.upsert({
        where: { dedupeKey },
        update: {},
        create: {
            userId,
            dfcId,
            type: "DFC_OVERDUE_OPEN",
            message: `DFC #${numero} (${projectName}) en retard: delai depasse.`,
            dedupeKey,
        },
    });
}
