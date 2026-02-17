import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if ((session.user as Record<string, unknown>)?.role !== "ADMIN") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
        select: {
            id: true,
            matricule: true,
            nom: true,
            prenom: true,
            email: true,
            fonction: true,
            role: true,
            active: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if ((session.user as Record<string, unknown>)?.role !== "ADMIN") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const hashedPassword = await bcrypt.hash(body.password, 10);

        const user = await prisma.user.create({
            data: {
                matricule: body.matricule,
                nom: body.nom,
                prenom: body.prenom,
                email: body.email,
                password: hashedPassword,
                fonction: body.fonction || "PP_RESPONSIBLE",
                role: body.role || "USER",
            },
            select: {
                id: true,
                matricule: true,
                nom: true,
                prenom: true,
                email: true,
                fonction: true,
                role: true,
                active: true,
            },
        });

        return NextResponse.json(user, { status: 201 });
    } catch (error) {
        console.error("Error creating user:", error);
        return NextResponse.json(
            { error: "Erreur lors de la création de l'utilisateur" },
            { status: 500 }
        );
    }
}
