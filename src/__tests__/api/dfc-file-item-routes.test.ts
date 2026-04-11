import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  dFCFile: {
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  dFC: {
    update: vi.fn(),
  },
};

const getSessionOrFailMock = vi.fn();
const deleteFeasibilityFileMock = vi.fn();
const readFeasibilityFileMock = vi.fn();

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/api-helpers", () => ({
  getSessionOrFail: getSessionOrFailMock,
  handleApiError: (err: unknown, message: string) =>
    Response.json({ error: message, detail: String(err) }, { status: 500 }),
}));
vi.mock("@/lib/storage/dfc-files", () => ({
  deleteFeasibilityFile: deleteFeasibilityFileMock,
  readFeasibilityFile: readFeasibilityFileMock,
}));

describe("/api/dfc/[id]/files/[fileId] routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionOrFailMock.mockResolvedValue({
      session: { user: { id: "u1", role: "USER" } },
      error: null,
    });

    prismaMock.dFCFile.findFirst.mockResolvedValue({
      id: "f1",
      dfcId: "d1",
      relativePath: "d1/uuid.pdf",
      mimeType: "application/pdf",
      originalName: "my-file.pdf",
      sizeBytes: 11,
      dfc: { createdById: "u1" },
      uploadedBy: { nom: "Doe", prenom: "John", matricule: "M1" },
    });
  });

  it("returns file metadata", async () => {
    const { GET } = await import("@/app/api/dfc/[id]/files/[fileId]/route");
    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "d1", fileId: "f1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.file.id).toBe("f1");
  });

  it("deletes file record and storage artifact", async () => {
    prismaMock.dFCFile.delete.mockResolvedValue({ id: "f1" });
    prismaMock.dFC.update.mockResolvedValue({ id: "d1" });
    deleteFeasibilityFileMock.mockResolvedValue(true);

    const { DELETE } = await import("@/app/api/dfc/[id]/files/[fileId]/route");
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }) as never, {
      params: Promise.resolve({ id: "d1", fileId: "f1" }),
    });

    expect(response.status).toBe(200);
    expect(prismaMock.dFCFile.delete).toHaveBeenCalledWith({ where: { id: "f1" } });
    expect(deleteFeasibilityFileMock).toHaveBeenCalledWith("d1/uuid.pdf");
  });

  it("streams file download when authorized", async () => {
    readFeasibilityFileMock.mockResolvedValue(Buffer.from("hello world"));

    const { GET } = await import("@/app/api/dfc/[id]/files/[fileId]/download/route");
    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "d1", fileId: "f1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("returns forbidden for unauthorized user", async () => {
    prismaMock.dFCFile.findFirst.mockResolvedValue({
      id: "f1",
      dfcId: "d1",
      relativePath: "d1/uuid.pdf",
      dfc: { createdById: "owner" },
      uploadedBy: { nom: "Doe", prenom: "John", matricule: "M1" },
    });

    const { GET } = await import("@/app/api/dfc/[id]/files/[fileId]/route");
    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "d1", fileId: "f1" }),
    });

    expect(response.status).toBe(403);
  });
});
