import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { updateProfileSchema } from "@/lib/validations";
import { applyRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

export async function GET() {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const userId = session.user.id;
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
    // Rate limit : 10 modifications profil/min par IP
    const rateLimitError = applyRateLimit(request, RATE_LIMIT_PRESETS.PROFILE, "profile");
    if (rateLimitError) return rateLimitError;

    const { session, error } = await getSessionOrFail();
    if (error) return error;

    try {
        const body = await request.json();

        const parsed = updateProfileSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Données invalides", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { nom, prenom, email, image } = parsed.data;
        const normalizedImage = image && image.trim() !== "" ? image : null;
        const userId = session.user.id;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { nom, prenom, email, image: normalizedImage },
        });

        return NextResponse.json({ success: true, user: updatedUser });
    } catch (err) {
        return handleApiError(err, "Erreur lors de la mise à jour");
    }
}
