import { NextRequest, NextResponse } from "next/server";
import { getSessionOrFail } from "@/lib/api-helpers";

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:5000";

export async function POST(request: NextRequest) {
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
                });
                if (healthRes.ok) {
                    return NextResponse.json({ status: "ok" });
                }
                return NextResponse.json({ error: "Service indisponible" }, { status: 503 });
            } catch {
                return NextResponse.json({ error: "Service indisponible" }, { status: 503 });
            }
        }

        if (!question || typeof question !== "string" || !question.trim()) {
            return NextResponse.json({ error: "Question manquante" }, { status: 400 });
        }

        const ragRes = await fetch(`${RAG_SERVICE_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: question.trim() }),
            signal: AbortSignal.timeout(60000), // 60s timeout pour les requêtes RAG
        });

        const data = await ragRes.json();

        if (!ragRes.ok) {
            return NextResponse.json(
                { error: data.error || "Erreur du service IA" },
                { status: ragRes.status }
            );
        }

        return NextResponse.json(data);
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            return NextResponse.json(
                { error: "Le service IA met trop de temps à répondre. Réessayez." },
                { status: 504 }
            );
        }
        return NextResponse.json(
            { error: "Impossible de contacter le service IA. Vérifiez qu'il est démarré." },
            { status: 502 }
        );
    }
}
