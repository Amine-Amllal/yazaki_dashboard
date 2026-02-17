import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const userId = (session.user as any).id;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            fonction: true,
            image: true,
        },
    });

    if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    return NextResponse.json(user);
}

export async function PUT(request: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    try {
        const body = await request.json();
        const { nom, prenom, email, image } = body;
        const userId = (session.user as any).id;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                nom,
                prenom,
                email,
                image, // Base64 string
            },
        });

        return NextResponse.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
    }
}
