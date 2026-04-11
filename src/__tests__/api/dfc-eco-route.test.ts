import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  dFC: {
    findUnique: vi.fn(),
  },
  eCO: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
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

describe("/api/dfc/[id]/eco route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionOrFailMock.mockResolvedValue({
      session: { user: { id: "u1", role: "USER" } },
      error: null,
    });
    prismaMock.dFC.findUnique.mockResolvedValue({ id: "d1", createdById: "u1" });
  });

  it("gets ECO for a DFC", async () => {
    prismaMock.eCO.findUnique.mockResolvedValue({ id: "e1", code: "ECO-1", status: "DRAFT" });

    const { GET } = await import("@/app/api/dfc/[id]/eco/route");
    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "d1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.eco.code).toBe("ECO-1");
  });

  it("upserts ECO", async () => {
    prismaMock.eCO.upsert.mockResolvedValue({ id: "e1", code: "ECO-2", status: "VALIDATED" });
    prismaMock.dFCHistory.create.mockResolvedValue({ id: "h1" });

    const { PUT } = await import("@/app/api/dfc/[id]/eco/route");
    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "ECO-2", status: "VALIDATED" }),
      }) as never,
      { params: Promise.resolve({ id: "d1" }) }
    );

    expect(response.status).toBe(200);
    expect(prismaMock.eCO.upsert).toHaveBeenCalledTimes(1);
  });

  it("deletes ECO", async () => {
    prismaMock.eCO.findUnique.mockResolvedValue({ id: "e1", code: "ECO-1" });
    prismaMock.eCO.delete.mockResolvedValue({ id: "e1" });
    prismaMock.dFCHistory.create.mockResolvedValue({ id: "h1" });

    const { DELETE } = await import("@/app/api/dfc/[id]/eco/route");
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }) as never, {
      params: Promise.resolve({ id: "d1" }),
    });

    expect(response.status).toBe(200);
    expect(prismaMock.eCO.delete).toHaveBeenCalledWith({ where: { dfcId: "d1" } });
  });
});
