import { NextRequest, NextResponse } from "next/server";
import { getSessionOrFail } from "@/lib/api-helpers";
import { applyRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:5000";
const RAG_API_TOKEN = process.env.RAG_API_TOKEN || "";

// Headers communs pour les appels au service RAG
function ragHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (RAG_API_TOKEN) {
        headers["Authorization"] = `Bearer ${RAG_API_TOKEN}`;
    }
    return headers;
}

export async function POST(request: NextRequest) {
    // Rate limit : 10 requêtes/min par IP (protège le quota Gemini)
    const rateLimitError = applyRateLimit(request, RATE_LIMIT_PRESETS.CHAT, "chat");
    if (rateLimitError) return rateLimitError;

    const { error } = await getSessionOrFail();
    if (error) return error;

    try {
        const body = await request.json();
        const question = body.question;

        // Health check rapide
        if (body.healthCheck) {
            try {
                const healthRes = await fetch(`${RAG_SERVICE_URL}/api/health`, {
                    signal: AbortSignal.timeout(3000),
                    headers: ragHeaders(),
                });
                if (healthRes.ok) {
                    return NextResponse.json({ status: "ok" });
                }
                return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
            } catch {
                return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
            }
        }

        if (!question || typeof question !== "string" || !question.trim()) {
            return NextResponse.json({ error: "Question is required" }, { status: 400 });
        }

        const ragRes = await fetch(`${RAG_SERVICE_URL}/api/chat`, {
            method: "POST",
            headers: ragHeaders(),
            body: JSON.stringify({ question: question.trim() }),
            signal: AbortSignal.timeout(60000), // 60s timeout pour les requêtes RAG
        });

        const data = await ragRes.json();

        if (!ragRes.ok) {
            return NextResponse.json(
                { error: data.error || "AI service error" },
                { status: ragRes.status }
            );
        }

        return NextResponse.json(data);
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            return NextResponse.json(
                { error: "The AI service is taking too long to respond. Please try again." },
                { status: 504 }
            );
        }
        return NextResponse.json(
            { error: "Unable to reach the AI service. Verify it is running." },
            { status: 502 }
        );
    }
}
