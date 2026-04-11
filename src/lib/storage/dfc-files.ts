import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
    ALLOWED_FEASIBILITY_FILE_EXTENSIONS,
    ALLOWED_FEASIBILITY_FILE_MIME_TYPES,
    MAX_FEASIBILITY_FILE_SIZE_BYTES,
} from "@/lib/validations";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "dfc-feasibility");

export function getFeasibilityStorageRoot() {
    return STORAGE_ROOT;
}

export function sanitizeFileName(input: string) {
    return input
        .replace(/[\\/]+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 180) || "file";
}

export function getFileExtension(fileName: string) {
    const ext = path.extname(fileName).toLowerCase().replace(".", "");
    return ext;
}

export function isAllowedFeasibilityFile(fileName: string, mimeType: string) {
    const ext = getFileExtension(fileName);
    const byExt = ALLOWED_FEASIBILITY_FILE_EXTENSIONS.includes(
        ext as (typeof ALLOWED_FEASIBILITY_FILE_EXTENSIONS)[number]
    );
    const byMime = ALLOWED_FEASIBILITY_FILE_MIME_TYPES.includes(
        mimeType as (typeof ALLOWED_FEASIBILITY_FILE_MIME_TYPES)[number]
    );

    return byExt && byMime;
}

export function ensureRelativePathInsideStorage(relativePath: string) {
    const absolutePath = path.resolve(STORAGE_ROOT, relativePath);
    const normalizedRoot = path.resolve(STORAGE_ROOT);

    if (!absolutePath.startsWith(normalizedRoot)) {
        throw new Error("Invalid storage path");
    }

    return absolutePath;
}

export async function saveFeasibilityFile(dfcId: string, file: File) {
    if (file.size <= 0) {
        throw new Error("Empty file is not allowed");
    }

    if (file.size > MAX_FEASIBILITY_FILE_SIZE_BYTES) {
        throw new Error("File is too large");
    }

    if (!isAllowedFeasibilityFile(file.name, file.type)) {
        throw new Error("Unsupported file type");
    }

    const originalName = sanitizeFileName(file.name);
    const ext = getFileExtension(originalName);
    const storedName = `${randomUUID()}${ext ? `.${ext}` : ""}`;
    const relativePath = path.join(dfcId, storedName);
    const absolutePath = ensureRelativePathInsideStorage(relativePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const content = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absolutePath, content);

    return {
        originalName,
        storedName,
        mimeType: file.type,
        sizeBytes: file.size,
        relativePath,
        absolutePath,
    };
}

export async function readFeasibilityFile(relativePath: string) {
    const absolutePath = ensureRelativePathInsideStorage(relativePath);
    return fs.readFile(absolutePath);
}

export async function deleteFeasibilityFile(relativePath: string) {
    const absolutePath = ensureRelativePathInsideStorage(relativePath);

    try {
        await fs.unlink(absolutePath);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return false;
        }
        throw error;
    }
}

export async function deleteDfcFeasibilityDirectory(dfcId: string) {
    const dirPath = ensureRelativePathInsideStorage(dfcId);
    await fs.rm(dirPath, { recursive: true, force: true });
}
