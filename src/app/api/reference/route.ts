import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, getAdminSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { createReferenceSchema, updateReferenceSchema } from "@/lib/validations";

export async function GET() {
    const { error } = await getSessionOrFail();
    if (error) return error;

    const [projects, families, phases] = await Promise.all([
        prisma.project.findMany({ orderBy: { name: "asc" } }),
        prisma.family.findMany({ orderBy: { name: "asc" } }),
        prisma.phase.findMany({ orderBy: { name: "asc" } }),
    ]);

    return NextResponse.json({ projects, families, phases });
}

export async function POST(request: NextRequest) {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

    try {
        const body = await request.json();

        const parsed = createReferenceSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Données invalides", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { type, name } = parsed.data;

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
    } catch (err) {
        return handleApiError(err, "Erreur lors de la création (doublon ?)");
    }
}

export async function PUT(request: NextRequest) {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

    try {
        const body = await request.json();

        const parsed = updateReferenceSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Données invalides", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { type, id, name } = parsed.data;

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
    } catch (err) {
        return handleApiError(err, "Erreur lors de la modification");
    }
}

export async function DELETE(request: NextRequest) {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

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
    } catch (err: unknown) {
        return handleApiError(err, "Erreur lors de la suppression");
    }
}
