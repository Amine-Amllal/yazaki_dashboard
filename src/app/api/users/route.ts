import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getAdminSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { createUserSchema } from "@/lib/validations";
import { applyRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

export async function GET() {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

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
    // Rate limit : 10 créations utilisateur/min par IP
    const rateLimitError = applyRateLimit(request, RATE_LIMIT_PRESETS.USER_CREATE, "user-create");
    if (rateLimitError) return rateLimitError;

    const { error } = await getAdminSessionOrFail();
    if (error) return error;

    try {
        const body = await request.json();

        const parsed = createUserSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Données invalides", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const data = parsed.data;
        const hashedPassword = await bcrypt.hash(data.password, 10);

        const user = await prisma.user.create({
            data: {
                matricule: data.matricule,
                nom: data.nom,
                prenom: data.prenom,
                email: data.email,
                password: hashedPassword,
                fonction: data.fonction || "PP_RESPONSIBLE",
                role: data.role || "USER",
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
    } catch (err) {
        return handleApiError(err, "Erreur lors de la création de l'utilisateur");
    }
}
