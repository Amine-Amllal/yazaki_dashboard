import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, getAdminSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { createReferenceSchema, updateReferenceSchema } from "@/lib/validations";

export async function GET() {
    const { error } = await getSessionOrFail();
    if (error) return error;

    const [projects, families, phases, users] = await Promise.all([
        prisma.project.findMany({ orderBy: { name: "asc" } }),
        prisma.family.findMany({ orderBy: { name: "asc" } }),
        prisma.phase.findMany({ orderBy: { name: "asc" } }),
        prisma.user.findMany({
            where: { active: true },
            orderBy: { nom: "asc" },
            select: { id: true, nom: true, prenom: true, matricule: true, fonction: true },
        }),
    ]);

    return NextResponse.json({ projects, families, phases, users });
}

export async function POST(request: NextRequest) {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

    try {
        const body = await request.json();

        const parsed = createReferenceSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
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
            return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        }
        return NextResponse.json(result, { status: 201 });
    } catch (err) {
        return handleApiError(err, "Failed to create reference item");
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
                { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
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
            return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        return handleApiError(err, "Failed to update reference item");
    }
}

export async function DELETE(request: NextRequest) {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!type || !id) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    try {
        if (type === "project") {
            await prisma.project.delete({ where: { id } });
        } else if (type === "family") {
            await prisma.family.delete({ where: { id } });
        } else if (type === "phase") {
            await prisma.phase.delete({ where: { id } });
        } else {
            return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        }
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return handleApiError(err, "Failed to delete reference item");
    }
}
