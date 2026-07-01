import { describe, expect, it } from "vitest";
import { resolveDateRange, yesterday } from "../src/dateRange.js";

describe("date range helpers", () => {
  it("selects yesterday from a reference date", () => {
    expect(yesterday(new Date("2026-07-01T00:00:00Z"))).toBe("2026-06-30");
  });

  it("defaults automation runs to yesterday", () => {
    expect(resolveDateRange({}, new Date("2026-07-01T15:00:00Z"))).toEqual({
      fromDate: "2026-06-30",
      toDate: "2026-06-30"
    });
  });

  it("keeps an explicit custom date range", () => {
    expect(
      resolveDateRange({
        dateMode: "custom",
        fromDate: "2026-06-01",
        toDate: "2026-06-15"
      })
    ).toEqual({
      fromDate: "2026-06-01",
      toDate: "2026-06-15"
    });
  });
});
