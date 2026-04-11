import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getAdminSessionOrFail, handleApiError } from "@/lib/api-helpers";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

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
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (err) {
        return handleApiError(err, "Failed to fetch user");
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    try {
        const updateData: Record<string, unknown> = {};
        const fields = ["nom", "prenom", "email", "matricule", "fonction", "role", "active"];
        for (const field of fields) {
            if (body[field] !== undefined) updateData[field] = body[field];
        }

        if (body.password && typeof body.password === "string" && body.password.length >= 6) {
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
    } catch (err) {
        return handleApiError(err, "Failed to update user");
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

    const { id } = await params;

    try {
        await prisma.user.update({
            where: { id },
            data: { active: false },
        });
        return NextResponse.json({ message: "User deactivated" });
    } catch (err) {
        return handleApiError(err, "Failed to deactivate user");
    }
}
