import { describe, expect, it } from "vitest";
import { calculateElapsedDays } from "@/lib/sla";

describe("sla helper", () => {
    it("returns 0 when end date is before start", () => {
        const start = new Date("2026-04-21");
        const end = new Date("2026-04-20");

        expect(calculateElapsedDays(start, end)).toBe(0);
    });

    it("computes elapsed calendar days", () => {
        const start = new Date("2026-04-01");
        const end = new Date("2026-04-04");

        expect(calculateElapsedDays(start, end)).toBe(3);
    });

    it("ignores intra-day time differences", () => {
        const start = new Date("2026-04-01T00:00:00.000Z");
        const end = new Date("2026-04-02T23:59:59.999Z");

        expect(calculateElapsedDays(start, end)).toBe(1);
    });
});
