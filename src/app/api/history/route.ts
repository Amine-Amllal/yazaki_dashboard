import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSessionOrFail } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const userId = searchParams.get("userId") || "";

    try {
        const where: Record<string, unknown> = {};
        if (userId) where.userId = userId;

        const history = await prisma.dFCHistory.findMany({
            where,
            take: limit,
            orderBy: { changedAt: "desc" },
            include: {
                user: {
                    select: {
                        nom: true,
                        prenom: true,
                        matricule: true,
                    },
                },
                dfc: {
                    select: {
                        id: true,
                        numero: true,
                        description: true,
                    },
                },
            },
        });

        return NextResponse.json(history);
    } catch (error) {
        console.error("Error fetching history:", error);
        return NextResponse.json(
            { error: "Failed to fetch history" },
            { status: 500 }
        );
    }
}
