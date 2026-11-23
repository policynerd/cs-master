/**
 * Converting between UTC instants and wall-clock times in the organization's
 * timezone. Clerks type "7:00 PM" meaning 7:00 PM in the town, whatever the
 * server's or the clerk's own computer timezone is.
 */

/** Minutes `tz` is ahead of UTC at instant `d` (negative west of Greenwich). */
export function tzOffsetMinutes(d: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/**
 * Parses a `<input type="datetime-local">` value ("2026-11-10T19:00") as a
 * wall-clock time in `tz`. Returns null for malformed input.
 *
 * During the autumn daylight-saving overlap the earlier instant is used; a
 * time skipped by the spring change moves forward by the gap.
 */
export function zonedInputToUtc(value: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Try the offset in force a day either side; pick the earliest instant that
  // reads back as the requested wall time.
  const candidates = [-1, 1]
    .map((days) => tzOffsetMinutes(new Date(wall + days * 86_400_000), tz))
    .map((off) => new Date(wall - off * 60_000))
    .sort((a, b) => a.getTime() - b.getTime());
  for (const c of candidates) {
    if (utcToZonedInput(c, tz) === value.trim()) return c;
  }
  // Skipped hour (spring forward): use the later offset.
  return candidates[candidates.length - 1];
}

/** Formats an instant as a `datetime-local` value in `tz`. */
export function utcToZonedInput(d: Date, tz: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
