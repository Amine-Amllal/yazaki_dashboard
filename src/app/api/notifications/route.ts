import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, handleApiError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));

    try {
        const where = {
            userId: session.user.id,
            ...(unreadOnly ? { readAt: null } : {}),
        };

        const [notifications, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                select: {
                    id: true,
                    type: true,
                    message: true,
                    readAt: true,
                    createdAt: true,
                    dfcId: true,
                    dfc: { select: { numero: true } },
                },
            }),
            prisma.notification.count({
                where: {
                    userId: session.user.id,
                    readAt: null,
                },
            }),
        ]);

        return NextResponse.json({ notifications, unreadCount });
    } catch (err) {
        return handleApiError(err, "Failed to fetch notifications");
    }
}
