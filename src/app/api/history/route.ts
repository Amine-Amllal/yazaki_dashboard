import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const user = session.user as Record<string, unknown>;
    if (user.role !== "ADMIN") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
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
            { error: "Erreur lors de la récupération de l'historique" },
            { status: 500 }
        );
    }
}
