import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Session } from "next-auth";

/**
 * Helper to get the authenticated session or return a 401 response.
 */
export async function getSessionOrFail(): Promise<
    | { session: Session; error: null }
    | { session: null; error: NextResponse }
> {
    const session = await auth();
    if (!session) {
        return {
            session: null,
            error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }),
        };
    }
    return { session, error: null };
}

/**
 * Helper to check admin role or return a 403 response.
 */
export async function getAdminSessionOrFail(): Promise<
    | { session: Session; error: null }
    | { session: null; error: NextResponse }
> {
    const result = await getSessionOrFail();
    if (result.error) return result;

    if (result.session.user.role !== "ADMIN") {
        return {
            session: null,
            error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
        };
    }

    return result;
}

/**
 * Standard error response for Prisma/validation errors.
 */
export function handleApiError(error: unknown, message: string) {
    console.error(message, error);

    // Handle Prisma unique constraint errors
    const prismaError = error as { code?: string; meta?: { target?: string[] } };
    if (prismaError.code === "P2002") {
        const field = prismaError.meta?.target?.[0] || "champ";
        return NextResponse.json(
            { error: `Doublon détecté sur le champ "${field}".` },
            { status: 409 }
        );
    }

    // Handle Prisma foreign key errors
    if (prismaError.code === "P2003") {
        return NextResponse.json(
            { error: "Impossible : cet élément est référencé par d'autres données." },
            { status: 400 }
        );
    }

    // Handle Prisma not found errors
    if (prismaError.code === "P2025") {
        return NextResponse.json(
            { error: "Élément introuvable." },
            { status: 404 }
        );
    }

    return NextResponse.json({ error: message }, { status: 500 });
}
