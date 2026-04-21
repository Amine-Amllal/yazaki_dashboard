import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { markNotificationReadSchema } from "@/lib/validations";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    try {
        const { id } = await params;
        const body = await request.json();
        const parsed = markNotificationReadSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const notification = await prisma.notification.findFirst({
            where: {
                id,
                userId: session.user.id,
            },
            select: { id: true },
        });

        if (!notification) {
            return NextResponse.json({ error: "Notification not found" }, { status: 404 });
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: {
                readAt: parsed.data.read ? new Date() : null,
            },
            select: { id: true, readAt: true },
        });

        return NextResponse.json(updated);
    } catch (err) {
        return handleApiError(err, "Failed to update notification");
    }
}
