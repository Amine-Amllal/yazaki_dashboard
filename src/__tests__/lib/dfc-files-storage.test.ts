import { promises as fs } from "fs";
import path from "path";
import {
  deleteDfcFeasibilityDirectory,
  deleteFeasibilityFile,
  getFeasibilityStorageRoot,
  isAllowedFeasibilityFile,
  readFeasibilityFile,
  saveFeasibilityFile,
  sanitizeFileName,
} from "@/lib/storage/dfc-files";

describe("dfc feasibility storage", () => {
  const dfcId = "dfc-test-storage";

  afterAll(async () => {
    await deleteDfcFeasibilityDirectory(dfcId);
  });

  it("sanitizes incoming filenames", () => {
    expect(sanitizeFileName("../../weird file?.pdf")).toBe(".._.._weird_file_.pdf");
  });

  it("validates allowed extension and mime pair", () => {
    expect(isAllowedFeasibilityFile("report.pdf", "application/pdf")).toBe(true);
    expect(isAllowedFeasibilityFile("report.exe", "application/octet-stream")).toBe(false);
  });

  it("saves, reads, and deletes a file", async () => {
    const file = new File([Buffer.from("hello-feasibility")], "sample.pdf", {
      type: "application/pdf",
    });

    const saved = await saveFeasibilityFile(dfcId, file);

    const expectedAbsolutePath = path.join(getFeasibilityStorageRoot(), saved.relativePath);
    await expect(fs.stat(expectedAbsolutePath)).resolves.toBeDefined();

    const loaded = await readFeasibilityFile(saved.relativePath);
    expect(loaded.toString()).toBe("hello-feasibility");

    const deleted = await deleteFeasibilityFile(saved.relativePath);
    expect(deleted).toBe(true);

    await expect(fs.stat(expectedAbsolutePath)).rejects.toBeDefined();
  });
});
