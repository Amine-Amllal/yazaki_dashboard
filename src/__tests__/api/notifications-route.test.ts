import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
    notification: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
    },
};

const getSessionOrFailMock = vi.fn();

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/api-helpers", () => ({
    getSessionOrFail: getSessionOrFailMock,
    handleApiError: (err: unknown, message: string) =>
        Response.json({ error: message, detail: String(err) }, { status: 500 }),
}));

describe("notifications routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSessionOrFailMock.mockResolvedValue({
            session: { user: { id: "u1", role: "USER" } },
            error: null,
        });
    });

    it("lists notifications and unread count", async () => {
        prismaMock.notification.findMany.mockResolvedValue([
            {
                id: "n1",
                type: "DFC_OVERDUE_OPEN",
                message: "Late",
                readAt: null,
                createdAt: new Date(),
                dfcId: "d1",
                dfc: { numero: 101 },
            },
        ]);
        prismaMock.notification.count.mockResolvedValue(1);

        const { GET } = await import("@/app/api/notifications/route");
        const response = await GET(new Request("http://localhost/api/notifications?limit=5") as never);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.unreadCount).toBe(1);
        expect(body.notifications).toHaveLength(1);
    });

    it("marks a notification as read", async () => {
        prismaMock.notification.findFirst.mockResolvedValue({ id: "n1" });
        prismaMock.notification.update.mockResolvedValue({
            id: "n1",
            readAt: new Date(),
        });

        const { PUT } = await import("@/app/api/notifications/[id]/route");
        const response = await PUT(
            new Request("http://localhost/api/notifications/n1", {
                method: "PUT",
                body: JSON.stringify({ read: true }),
                headers: { "Content-Type": "application/json" },
            }) as never,
            { params: Promise.resolve({ id: "n1" }) }
        );

        expect(response.status).toBe(200);
        expect(prismaMock.notification.update).toHaveBeenCalled();
    });
});
