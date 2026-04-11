import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  dFC: {
    findUnique: vi.fn(),
  },
  derogation: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dFCHistory: {
    create: vi.fn(),
  },
};

const getSessionOrFailMock = vi.fn();

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/api-helpers", () => ({
  getSessionOrFail: getSessionOrFailMock,
  handleApiError: (err: unknown, message: string) =>
    Response.json({ error: message, detail: String(err) }, { status: 500 }),
}));

describe("/api/dfc/[id]/derogations routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionOrFailMock.mockResolvedValue({
      session: { user: { id: "u1", role: "USER" } },
      error: null,
    });
    prismaMock.dFC.findUnique.mockResolvedValue({ id: "d1", createdById: "u1" });
  });

  it("lists derogations for a DFC", async () => {
    prismaMock.derogation.findMany.mockResolvedValue([{ id: "w1", numero: "W-1" }]);

    const { GET } = await import("@/app/api/dfc/[id]/derogations/route");
    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "d1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.derogations).toHaveLength(1);
  });

  it("creates a derogation", async () => {
    prismaMock.derogation.create.mockResolvedValue({ id: "w1", numero: "W-1" });
    prismaMock.dFCHistory.create.mockResolvedValue({ id: "h1" });

    const { POST } = await import("@/app/api/dfc/[id]/derogations/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: "W-1", commentaire: "initial" }),
      }) as never,
      { params: Promise.resolve({ id: "d1" }) }
    );

    expect(response.status).toBe(201);
    expect(prismaMock.derogation.create).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthorized access", async () => {
    prismaMock.dFC.findUnique.mockResolvedValue({ id: "d1", createdById: "owner" });

    const { GET } = await import("@/app/api/dfc/[id]/derogations/route");
    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "d1" }),
    });

    expect(response.status).toBe(403);
  });
});
