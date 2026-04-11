import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  dFC: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  dFCFile: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

const getSessionOrFailMock = vi.fn();
const applyRateLimitMock = vi.fn();
const saveFeasibilityFileMock = vi.fn();
const deleteFeasibilityFileMock = vi.fn();

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/api-helpers", () => ({
  getSessionOrFail: getSessionOrFailMock,
  handleApiError: (err: unknown, message: string) =>
    Response.json({ error: message, detail: String(err) }, { status: 500 }),
}));
vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMIT_PRESETS: { FILE_UPLOAD: { maxRequests: 10, windowSizeInSeconds: 60 } },
  applyRateLimit: applyRateLimitMock,
}));
vi.mock("@/lib/storage/dfc-files", () => ({
  saveFeasibilityFile: saveFeasibilityFileMock,
  deleteFeasibilityFile: deleteFeasibilityFileMock,
}));

describe("/api/dfc/[id]/files route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyRateLimitMock.mockReturnValue(null);
    getSessionOrFailMock.mockResolvedValue({
      session: { user: { id: "u1", role: "USER" } },
      error: null,
    });
    prismaMock.dFC.findUnique.mockResolvedValue({ id: "d1", createdById: "u1" });
  });

  it("lists files linked to a DFC", async () => {
    prismaMock.dFCFile.findMany.mockResolvedValue([
      { id: "f1", originalName: "a.pdf" },
    ]);

    const { GET } = await import("@/app/api/dfc/[id]/files/route");
    const response = await GET(new Request("http://localhost/api/dfc/d1/files") as never, {
      params: Promise.resolve({ id: "d1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.files).toHaveLength(1);
  });

  it("uploads one or multiple files and creates DB associations", async () => {
    const uploadedRecord = {
      id: "f1",
      dfcId: "d1",
      originalName: "sample.pdf",
      uploadedBy: { nom: "Doe", prenom: "John", matricule: "M1" },
    };

    saveFeasibilityFileMock.mockResolvedValue({
      originalName: "sample.pdf",
      storedName: "uuid.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      relativePath: "d1/uuid.pdf",
      absolutePath: "C:/tmp/d1/uuid.pdf",
    });
    prismaMock.dFCFile.create.mockResolvedValue(uploadedRecord);
    prismaMock.dFC.update.mockResolvedValue({ id: "d1" });

    const formData = new FormData();
    formData.append("files", new File([Buffer.from("abc")], "sample.pdf", { type: "application/pdf" }));

    const { POST } = await import("@/app/api/dfc/[id]/files/route");
    const request = new Request("http://localhost/api/dfc/d1/files", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ id: "d1" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.files).toHaveLength(1);
    expect(prismaMock.dFCFile.create).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid upload payload", async () => {
    const { POST } = await import("@/app/api/dfc/[id]/files/route");
    const request = new Request("http://localhost/api/dfc/d1/files", {
      method: "POST",
      body: new FormData(),
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ id: "d1" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns forbidden for non-owner non-admin", async () => {
    prismaMock.dFC.findUnique.mockResolvedValue({ id: "d1", createdById: "owner" });

    const { GET } = await import("@/app/api/dfc/[id]/files/route");
    const response = await GET(new Request("http://localhost/api/dfc/d1/files") as never, {
      params: Promise.resolve({ id: "d1" }),
    });

    expect(response.status).toBe(403);
  });

  it("maps unsupported file type errors to 400", async () => {
    saveFeasibilityFileMock.mockRejectedValue(new Error("Unsupported file type"));

    const formData = new FormData();
    formData.append("files", new File([Buffer.from("abc")], "sample.exe", { type: "application/octet-stream" }));

    const { POST } = await import("@/app/api/dfc/[id]/files/route");
    const request = new Request("http://localhost/api/dfc/d1/files", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ id: "d1" }),
    });

    expect(response.status).toBe(400);
  });
});
