import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const [projects, families, phases] = await Promise.all([
        prisma.project.findMany({ orderBy: { name: "asc" } }),
        prisma.family.findMany({ orderBy: { name: "asc" } }),
        prisma.phase.findMany({ orderBy: { name: "asc" } }),
    ]);

    return NextResponse.json({ projects, families, phases });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if ((session.user as Record<string, unknown>)?.role !== "ADMIN") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { type, name } = body;

    try {
        let result;
        if (type === "project") {
            result = await prisma.project.create({ data: { name } });
        } else if (type === "family") {
            result = await prisma.family.create({ data: { name } });
        } else if (type === "phase") {
            result = await prisma.phase.create({ data: { name } });
        } else {
            return NextResponse.json({ error: "Type invalide" }, { status: 400 });
        }
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        console.error("Error creating reference:", error);
        return NextResponse.json({ error: "Erreur lors de la création (doublon ?)" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if ((session.user as Record<string, unknown>)?.role !== "ADMIN") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { type, id, name } = body;

        if (!type || !id || !name) {
            return NextResponse.json({ error: "Données incomplètes" }, { status: 400 });
        }

        if (type === "project") {
            await prisma.project.update({ where: { id }, data: { name } });
        } else if (type === "family") {
            await prisma.family.update({ where: { id }, data: { name } });
        } else if (type === "phase") {
            await prisma.phase.update({ where: { id }, data: { name } });
        } else {
            return NextResponse.json({ error: "Type invalide" }, { status: 400 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating reference:", error);
        return NextResponse.json({ error: "Erreur lors de la modification" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if ((session.user as Record<string, unknown>)?.role !== "ADMIN") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!type || !id) {
        return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    try {
        if (type === "project") {
            await prisma.project.delete({ where: { id } });
        } else if (type === "family") {
            await prisma.family.delete({ where: { id } });
        } else if (type === "phase") {
            await prisma.phase.delete({ where: { id } });
        } else {
            return NextResponse.json({ error: "Type invalide" }, { status: 400 });
        }
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting reference:", error);
        if (error.code === "P2003") {
            return NextResponse.json({ error: "Impossible de supprimer : cet élément est utilisé par un ou plusieurs DFC." }, { status: 400 });
        }
        return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
    }
}
