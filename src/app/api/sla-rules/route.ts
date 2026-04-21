import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSessionOrFail, handleApiError } from "@/lib/api-helpers";
import { upsertSlaRuleSchema } from "@/lib/validations";

export async function GET() {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

    try {
        const rules = await prisma.slaRule.findMany({
            include: {
                project: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json({ rules });
    } catch (err) {
        return handleApiError(err, "Failed to fetch SLA rules");
    }
}

export async function POST(request: NextRequest) {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

    try {
        const body = await request.json();
        const parsed = upsertSlaRuleSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const data = parsed.data;
        const normalizedType = data.typeDFC || null;
        const projectExists = await prisma.project.findUnique({
            where: { id: data.projectId },
            select: { id: true },
        });

        if (!projectExists) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        if (data.id) {
            const existing = await prisma.slaRule.findUnique({
                where: { id: data.id },
                select: { id: true },
            });

            if (!existing) {
                return NextResponse.json({ error: "SLA rule not found" }, { status: 404 });
            }

            const duplicate = await prisma.slaRule.findFirst({
                where: {
                    projectId: data.projectId,
                    typeDFC: normalizedType,
                    id: { not: data.id },
                },
                select: { id: true },
            });

            if (duplicate) {
                return NextResponse.json(
                    { error: "A rule already exists for this project and DFC type" },
                    { status: 409 }
                );
            }

            const updated = await prisma.slaRule.update({
                where: { id: data.id },
                data: {
                    projectId: data.projectId,
                    typeDFC: normalizedType,
                    delayDays: data.delayDays,
                    active: data.active,
                },
                include: {
                    project: {
                        select: { id: true, name: true },
                    },
                },
            });

            return NextResponse.json(updated);
        }

        if (normalizedType === null) {
            const existingGlobal = await prisma.slaRule.findFirst({
                where: { projectId: data.projectId, typeDFC: null },
                orderBy: { createdAt: "asc" },
                select: { id: true },
            });

            if (existingGlobal) {
                const updated = await prisma.slaRule.update({
                    where: { id: existingGlobal.id },
                    data: {
                        delayDays: data.delayDays,
                        active: data.active,
                    },
                    include: {
                        project: {
                            select: { id: true, name: true },
                        },
                    },
                });

                return NextResponse.json(updated);
            }

            const createdGlobal = await prisma.slaRule.create({
                data: {
                    projectId: data.projectId,
                    typeDFC: null,
                    delayDays: data.delayDays,
                    active: data.active,
                },
                include: {
                    project: {
                        select: { id: true, name: true },
                    },
                },
            });

            return NextResponse.json(createdGlobal, { status: 201 });
        }

        const rule = await prisma.slaRule.upsert({
            where: {
                projectId_typeDFC: {
                    projectId: data.projectId,
                    typeDFC: normalizedType,
                },
            },
            update: {
                delayDays: data.delayDays,
                active: data.active,
            },
            create: {
                projectId: data.projectId,
                typeDFC: normalizedType,
                delayDays: data.delayDays,
                active: data.active,
            },
            include: {
                project: {
                    select: { id: true, name: true },
                },
            },
        });

        return NextResponse.json(rule, { status: 201 });
    } catch (err) {
        return handleApiError(err, "Failed to save SLA rule");
    }
}

export async function DELETE(request: NextRequest) {
    const { error } = await getAdminSessionOrFail();
    if (error) return error;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Missing SLA rule id" }, { status: 400 });
        }

        const existing = await prisma.slaRule.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!existing) {
            return NextResponse.json({ error: "SLA rule not found" }, { status: 404 });
        }

        await prisma.slaRule.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (err) {
        return handleApiError(err, "Failed to delete SLA rule");
    }
}
