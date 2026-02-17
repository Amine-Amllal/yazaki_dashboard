import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if ((session.user as Record<string, unknown>)?.role !== "ADMIN") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true, matricule: true, nom: true, prenom: true,
                email: true, fonction: true, role: true, active: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch {
        return NextResponse.json({ error: "Erreur" }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if ((session.user as Record<string, unknown>)?.role !== "ADMIN") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    try {
        const updateData: Record<string, unknown> = {};
        const fields = ["nom", "prenom", "email", "matricule", "fonction", "role", "active"];
        for (const field of fields) {
            if (body[field] !== undefined) updateData[field] = body[field];
        }

        if (body.password) {
            updateData.password = await bcrypt.hash(body.password, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true, matricule: true, nom: true, prenom: true,
                email: true, fonction: true, role: true, active: true,
            },
        });

        return NextResponse.json(user);
    } catch {
        return NextResponse.json({ error: "Erreur lors de la modification" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if ((session.user as Record<string, unknown>)?.role !== "ADMIN") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    try {
        await prisma.user.update({
            where: { id },
            data: { active: false },
        });
        return NextResponse.json({ message: "Utilisateur désactivé" });
    } catch {
        return NextResponse.json({ error: "Erreur" }, { status: 500 });
    }
}
