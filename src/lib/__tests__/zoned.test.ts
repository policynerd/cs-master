import { describe, expect, it } from "vitest";
import { utcToZonedInput, zonedInputToUtc } from "../zoned";

const NY = "America/New_York";

describe("zoned date entry", () => {
  it("reads wall-clock input in the organization timezone", () => {
    expect(zonedInputToUtc("2026-11-10T19:00", NY)?.toISOString()).toBe("2026-11-11T00:00:00.000Z"); // EST
    expect(zonedInputToUtc("2026-07-01T19:00", NY)?.toISOString()).toBe("2026-07-01T23:00:00.000Z"); // EDT
    expect(zonedInputToUtc("2026-07-01T19:00", "America/Los_Angeles")?.toISOString()).toBe("2026-07-02T02:00:00.000Z");
  });

  it("round-trips", () => {
    for (const v of ["2026-01-15T09:30", "2026-03-08T12:00", "2026-11-01T00:15", "2026-12-31T23:59"]) {
      expect(utcToZonedInput(zonedInputToUtc(v, NY)!, NY)).toBe(v);
    }
  });

  it("handles daylight-saving edges", () => {
    // 1:30 AM happens twice on 2026-11-01; take the first (EDT).
    expect(zonedInputToUtc("2026-11-01T01:30", NY)?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
    // 2:30 AM doesn't exist on 2026-03-08; move forward to 3:30 AM EDT.
    expect(utcToZonedInput(zonedInputToUtc("2026-03-08T02:30", NY)!, NY)).toBe("2026-03-08T03:30");
  });

  it("rejects malformed input", () => {
    expect(zonedInputToUtc("", NY)).toBeNull();
    expect(zonedInputToUtc("2026-13-01T10:00", NY)).toBeNull();
    expect(zonedInputToUtc("tomorrow at 7", NY)).toBeNull();
  });
});
