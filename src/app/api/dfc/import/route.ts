import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GoogleGenAI, Type } from "@google/genai";
import { config as dotenvConfig } from "dotenv";
import path from "path";

// Force-load .env from project root (overrides system env vars)
dotenvConfig({ path: path.resolve(process.cwd(), '.env'), override: true });

// ─── Force Node.js runtime (required for Buffer, pdf-parse, canvas, OCR) ───
export const runtime = "nodejs";

// ─── Constants ───
const MAX_TEXT_LENGTH = 6000; // Cap text sent to LLM (free tier token budget)
const OCR_THRESHOLD = 50;    // Minimum chars to consider native PDF extraction successful
const GEMINI_TIMEOUT = 60000; // 60s timeout for Gemini API call

// ═══════════════════════════════════════════════════
// 1. EXCEL / CSV EXTRACTION
// ═══════════════════════════════════════════════════
async function extractFromExcel(file: File): Promise<string> {
    const XLSX = await import("xlsx");
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length === 0) {
        throw new Error("Le fichier Excel/CSV est vide.");
    }

    const headers = Object.keys(rows[0]);
    const lines = rows.map((row) =>
        headers.map((h) => `${h}: ${row[h]}`).join(" | ")
    );

    const text = `Colonnes: ${headers.join(", ")}\n\n${lines.join("\n")}`;
    console.log(`[DFC Import] Excel extraction: ${rows.length} rows, ${text.length} chars`);
    return text;
}

// ═══════════════════════════════════════════════════
// 2. PDF TEXT EXTRACTION (native + OCR fallback)
// ═══════════════════════════════════════════════════
async function extractFromPDF(buffer: Buffer): Promise<string> {
    // Try native text extraction first
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf = require("pdf-parse");
    const pdfData = await pdf(buffer);
    const nativeText = (pdfData.text || "").trim();

    console.log(`[DFC Import] Native PDF text: ${nativeText.length} chars`);

    if (nativeText.length >= OCR_THRESHOLD) {
        console.log("[DFC Import] Native text sufficient, skipping OCR.");
        return nativeText;
    }

    // Native extraction failed → trigger OCR
    console.log("[DFC Import] Native text below threshold, triggering OCR...");
    const ocrText = await performOCR(buffer);
    console.log(`[DFC Import] OCR result: ${ocrText.length} chars`);

    return ocrText || nativeText; // Fallback to native if OCR also gives nothing
}

// ═══════════════════════════════════════════════════
// 3. OCR: PDF → Images → Tesseract.js
// ═══════════════════════════════════════════════════
async function performOCR(pdfBuffer: Buffer): Promise<string> {
    const mupdf = await import("mupdf");
    const { createWorker } = await import("tesseract.js");
    const fs = await import("fs");
    const os = await import("os");
    const pathMod = await import("path");

    // Load PDF document with mupdf
    const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
    const numPages = Math.min(doc.countPages(), 5); // Limit to 5 pages for CPU budget

    console.log(`[DFC Import] OCR: Processing ${numPages}/${doc.countPages()} pages`);

    // Initialize Tesseract worker (French + English)
    const worker = await createWorker("fra+eng");
    const allText: string[] = [];
    const tmpFiles: string[] = [];

    try {
        for (let i = 0; i < numPages; i++) {
            console.log(`[DFC Import] OCR: Rendering page ${i + 1}/${numPages}...`);
            const page = doc.loadPage(i);

            // Render page to PNG at 3x scale for good OCR quality
            const pixmap = page.toPixmap(
                [3, 0, 0, 3, 0, 0], // 3x scale matrix
                mupdf.ColorSpace.DeviceRGB,
                false,
                true
            );
            const pngBuffer = pixmap.asPNG();

            // Write PNG to a temp file for Tesseract.js
            const tmpFile = pathMod.join(os.tmpdir(), `dfc_ocr_page_${i}_${Date.now()}.png`);
            fs.writeFileSync(tmpFile, pngBuffer);
            tmpFiles.push(tmpFile);

            console.log(`[DFC Import] OCR: Page ${i + 1} rendered (${pngBuffer.length} bytes)`);

            // Run OCR on the temp file
            const { data: { text } } = await worker.recognize(tmpFile);
            if (text.trim()) {
                allText.push(text.trim());
            }
        }
    } finally {
        await worker.terminate();
        // Clean up temp files
        for (const f of tmpFiles) {
            try { fs.unlinkSync(f); } catch { /* ignore */ }
        }
    }

    return allText.join("\n\n");
}

// ═══════════════════════════════════════════════════
// 4. GEMINI LLM CALL (structured JSON output)
// ═══════════════════════════════════════════════════

// Schema for the DFC form fields
const DFC_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        description: { type: Type.STRING, description: "Description de la DFC" },
        typeDFC: { type: Type.STRING, description: "T1, T2, T3, ou MISTAKED" },
        faisabilite: { type: Type.STRING, description: "OUI, NON, EN_COURS, ou A_CLARIFIER" },
        dateReception: { type: Type.STRING, description: "Date format YYYY-MM-DD" },
        dateReponse: { type: Type.STRING, description: "Date format YYYY-MM-DD" },
        delaiReponse: { type: Type.STRING, description: "Nombre de jours" },
        numeroDerogation: { type: Type.STRING, description: "Numéro de dérogation" },
        dateReceptionDerogation: { type: Type.STRING, description: "Date format YYYY-MM-DD" },
        dateApplicationEstimee: { type: Type.STRING, description: "Date format YYYY-MM-DD" },
        dateApplicationDerogation: { type: Type.STRING, description: "Date format YYYY-MM-DD" },
        commentaire: { type: Type.STRING, description: "Commentaires" },
        projectName: { type: Type.STRING, description: "Nom du projet" },
        familyName: { type: Type.STRING, description: "Nom de la famille" },
        phaseName: { type: Type.STRING, description: "Nom de la phase" },
    },
    required: ["description"],
};

interface GeminiDFCResult {
    description?: string;
    typeDFC?: string;
    faisabilite?: string;
    dateReception?: string;
    dateReponse?: string;
    delaiReponse?: string;
    numeroDerogation?: string;
    dateReceptionDerogation?: string;
    dateApplicationEstimee?: string;
    dateApplicationDerogation?: string;
    commentaire?: string;
    projectName?: string;
    familyName?: string;
    phaseName?: string;
}

async function callGemini(
    text: string,
    refs: { projects: string[]; families: string[]; phases: string[] }
): Promise<GeminiDFCResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY manquante. Ajoutez-la dans le fichier .env.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Truncate text to stay within token budget
    const truncatedText = text.length > MAX_TEXT_LENGTH
        ? text.substring(0, MAX_TEXT_LENGTH) + "\n...[texte tronqué]"
        : text;

    const prompt = `Tu es un assistant spécialisé dans l'extraction de données pour des demandes de faisabilité de conception (DFC) dans l'industrie automobile (Yazaki).

Voici le texte extrait d'un document :

---
${truncatedText}
---

Données de référence disponibles :
- Projets : ${refs.projects.join(", ")}
- Familles : ${refs.families.join(", ")}
- Phases : ${refs.phases.join(", ")}

Règles d'extraction :
- projectName, familyName, phaseName : matche avec les valeurs de référence ci-dessus
- typeDFC : uniquement T1, T2, T3 ou MISTAKED
- faisabilite : uniquement OUI, NON, EN_COURS ou A_CLARIFIER
- Dates au format YYYY-MM-DD
- Laisse une chaîne vide "" si un champ n'est pas trouvé`;

    console.log(`[DFC Import] Calling Gemini (${truncatedText.length} chars)...`);

    // Call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT);

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: DFC_SCHEMA,
            },
        });

        clearTimeout(timeoutId);

        const responseText = response.text;
        if (!responseText) {
            throw new Error("Réponse vide du modèle Gemini.");
        }

        console.log(`[DFC Import] Gemini response received (${responseText.length} chars)`);

        const parsed: GeminiDFCResult = JSON.parse(responseText);
        return parsed;
    } catch (error: unknown) {
        clearTimeout(timeoutId);

        const err = error as Error & { status?: number; message?: string };

        // Log the raw error for debugging
        console.error(`[DFC Import] Raw Gemini error:`, err.message, err.status);

        // Handle specific error cases
        if (err.name === "AbortError") {
            throw new Error("Timeout : le modèle Gemini n'a pas répondu dans les 60 secondes.");
        }
        if (err.message?.includes("API_KEY_INVALID")) {
            throw new Error("Clé API Gemini invalide. Vérifiez GEMINI_API_KEY dans le fichier .env.");
        }
        if (err.message?.includes("RESOURCE_EXHAUSTED") || err.status === 429) {
            throw new Error("Quota Gemini épuisé (free tier). Réessayez dans quelques minutes.");
        }
        if (err.message?.includes("not found") || err.message?.includes("NOT_FOUND")) {
            throw new Error("Modèle Gemini non disponible. Vérifiez que gemini-2.5-flash est accessible avec votre clé API.");
        }

        throw error; // Re-throw unexpected errors
    }
}

// ═══════════════════════════════════════════════════
// 5. RESOLVE NAMES → IDs
// ═══════════════════════════════════════════════════
function resolveId(items: { id: string; name: string }[], name: string | undefined): string {
    if (!name || !name.trim()) return "";
    const lower = name.toLowerCase().trim();

    // Exact match
    const exact = items.find((i) => i.name.toLowerCase() === lower);
    if (exact) return exact.id;

    // Partial match
    const partial = items.find(
        (i) => i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase())
    );
    return partial?.id || "";
}

// ═══════════════════════════════════════════════════
// 6. POST HANDLER (Orchestrator)
// ═══════════════════════════════════════════════════
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    try {
        // ─── Read uploaded file ───
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
        }

        const fileName = file.name.toLowerCase();
        console.log(`[DFC Import] Processing file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

        // ─── Extract text based on file type ───
        let extractedText = "";

        if (fileName.endsWith(".xlsx") || fileName.endsWith(".csv")) {
            extractedText = await extractFromExcel(file);
        } else if (fileName.endsWith(".pdf")) {
            const buffer = Buffer.from(await file.arrayBuffer());
            extractedText = await extractFromPDF(buffer);
        } else {
            return NextResponse.json(
                { error: "Format non supporté. Utilisez PDF, XLSX ou CSV." },
                { status: 400 }
            );
        }

        if (!extractedText || extractedText.trim().length < 5) {
            return NextResponse.json(
                { error: "Impossible d'extraire du texte exploitable du fichier." },
                { status: 400 }
            );
        }

        // ─── Fetch reference data ───
        const [projects, families, phases] = await Promise.all([
            prisma.project.findMany({ select: { id: true, name: true } }),
            prisma.family.findMany({ select: { id: true, name: true } }),
            prisma.phase.findMany({ select: { id: true, name: true } }),
        ]);

        // ─── Call Gemini ───
        const parsed = await callGemini(extractedText, {
            projects: projects.map((p) => p.name),
            families: families.map((f) => f.name),
            phases: phases.map((p) => p.name),
        });

        // ─── Map to form data with resolved IDs ───
        const mappedData = {
            projectId: resolveId(projects, parsed.projectName),
            familyId: resolveId(families, parsed.familyName),
            phaseId: resolveId(phases, parsed.phaseName),
            description: parsed.description || "",
            typeDFC: ["T1", "T2", "T3", "MISTAKED"].includes(parsed.typeDFC || "")
                ? parsed.typeDFC!
                : "T1",
            faisabilite: ["OUI", "NON", "EN_COURS", "A_CLARIFIER"].includes(parsed.faisabilite || "")
                ? parsed.faisabilite!
                : "EN_COURS",
            dateReception: parsed.dateReception || "",
            dateReponse: parsed.dateReponse || "",
            delaiReponse: parsed.delaiReponse || "",
            numeroDerogation: parsed.numeroDerogation || "",
            dateReceptionDerogation: parsed.dateReceptionDerogation || "",
            dateApplicationEstimee: parsed.dateApplicationEstimee || "",
            dateApplicationDerogation: parsed.dateApplicationDerogation || "",
            commentaire: parsed.commentaire || "",
        };

        console.log("[DFC Import] ✅ Extraction complete. Fields mapped:", Object.keys(mappedData).filter(k => (mappedData as Record<string, string>)[k]).length);

        return NextResponse.json({
            success: true,
            data: mappedData,
            extractedText: extractedText.substring(0, 500),
        });
    } catch (error: unknown) {
        const err = error as Error;
        console.error("[DFC Import] ❌ Error:", err.message);

        return NextResponse.json(
            { error: err.message || "Erreur lors du traitement du fichier." },
            { status: 500 }
        );
    }
}
