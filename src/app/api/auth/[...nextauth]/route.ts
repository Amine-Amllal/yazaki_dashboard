import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { applyRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

export const { GET } = handlers;

// Wrapper POST avec rate limiting anti brute-force (5 tentatives/min)
export async function POST(request: NextRequest) {
    const rateLimitError = applyRateLimit(request, RATE_LIMIT_PRESETS.AUTH, "auth");
    if (rateLimitError) return rateLimitError;

    return handlers.POST(request);
}
