import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
    dFC: {
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
    },
    project: {
        findMany: vi.fn(),
    },
    family: {
        findMany: vi.fn(),
    },
    user: {
        findMany: vi.fn(),
    },
};

const getSessionOrFailMock = vi.fn();

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/api-helpers", () => ({
    getSessionOrFail: getSessionOrFailMock,
}));

describe("/api/stats route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSessionOrFailMock.mockResolvedValue({
            session: { user: { id: "u-admin", role: "ADMIN" } },
            error: null,
        });
    });

    it("returns 401 when unauthenticated", async () => {
        getSessionOrFailMock.mockResolvedValue({
            session: null,
            error: Response.json({ error: "Unauthorized" }, { status: 401 }),
        });

        const { GET } = await import("@/app/api/stats/route");
        const response = await GET(new Request("http://localhost/api/stats") as never);

        expect(response.status).toBe(401);
    });

    it("returns responsible performance KPI", async () => {
        prismaMock.dFC.count
            .mockResolvedValueOnce(2)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(1);

        prismaMock.dFC.groupBy
            .mockResolvedValueOnce([{ typeDFC: "T1", _count: { id: 2 } }])
            .mockResolvedValueOnce([{ projectId: "p1", _count: { id: 2 } }])
            .mockResolvedValueOnce([
                { faisabilite: "OUI", _count: { id: 1 } },
                { faisabilite: "NON", _count: { id: 1 } },
            ]);

        prismaMock.dFC.findMany
            .mockResolvedValueOnce([
                {
                    id: "d1",
                    numero: 1,
                    description: "DFC demo",
                    faisabilite: "OUI",
                    typeDFC: "T1",
                    dateReception: new Date("2026-01-01"),
                    project: { id: "p1", name: "Project A" },
                    family: { id: "f1", name: "Family A" },
                    assignedTo: { id: "u1", nom: "Benali", prenom: "Sara", matricule: "M01" },
                },
            ])
            .mockResolvedValueOnce([{ delaiReponse: 5 }, { delaiReponse: 15 }])
            .mockResolvedValueOnce([
                {
                    id: "d1",
                    createdById: "u1",
                    assignedToId: "u1",
                    dateReponse: new Date("2026-01-04"),
                    delaiReponse: 5,
                    faisabilite: "OUI",
                },
                {
                    id: "d2",
                    createdById: "u1",
                    assignedToId: "u1",
                    dateReponse: null,
                    delaiReponse: null,
                    faisabilite: "NON",
                },
            ])
            .mockResolvedValueOnce([
                { dateReception: new Date("2026-01-01"), dateReponse: new Date("2026-01-04") },
                { dateReception: new Date("2026-01-10"), dateReponse: null },
            ]);

        prismaMock.project.findMany
            .mockResolvedValueOnce([{ id: "p1", name: "Project A" }])
            .mockResolvedValueOnce([{ id: "p1", name: "Project A" }]);

        prismaMock.user.findMany
            .mockResolvedValueOnce([
                { id: "u1", nom: "Benali", prenom: "Sara", matricule: "M01", fonction: "PP_RESPONSIBLE" },
            ])
            .mockResolvedValueOnce([
                { id: "u1", nom: "Benali", prenom: "Sara" },
            ]);

        prismaMock.family.findMany.mockResolvedValueOnce([{ id: "f1", name: "Family A" }]);

        const { GET } = await import("@/app/api/stats/route");
        const response = await GET(
            new Request("http://localhost/api/stats?sortBy=treatedCount&order=desc") as never
        );

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.totalDFC).toBe(2);
        expect(body.delaiMoyen).toBe(10);
        expect(body.responsablesPerformance).toHaveLength(1);
        expect(body.responsablesPerformance[0].name).toBe("Sara Benali");
        expect(body.responsablesPerformance[0].treatedCount).toBe(1);
        expect(body.responsablesPerformance[0].tauxFaisabilite).toBe(50);
        expect(body.responsablesPerformance[0].responseRate).toBe(50);
    });
});
