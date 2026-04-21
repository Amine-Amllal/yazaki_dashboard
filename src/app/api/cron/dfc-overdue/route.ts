import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionOrFail } from "@/lib/api-helpers";
import { syncOverdueDfcsAndNotify } from "@/lib/sla";

function hasValidCronSecret(request: NextRequest) {
    const expected = process.env.CRON_SECRET;
    if (!expected) return false;

    const authHeader = request.headers.get("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    return bearer === expected;
}

export async function GET(request: NextRequest) {
    const authorizedBySecret = hasValidCronSecret(request);

    if (!authorizedBySecret) {
        const { error } = await getAdminSessionOrFail();
        if (error) return error;
    }

    const result = await syncOverdueDfcsAndNotify();
    return NextResponse.json({ ok: true, ...result });
}
