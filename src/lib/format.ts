/**
 * Date and label formatting. All dates render in the organization's timezone,
 * not the server's or the visitor's, because a meeting time is a legal fact.
 */

export const DEFAULT_TZ = "America/New_York";

/** Midnight at the start of `d`'s calendar day in `tz`, as a UTC instant. */
export function startOfDayInTz(d: Date, tz = DEFAULT_TZ): Date {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d).split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, day));
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(guess).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

export function formatDate(d: Date, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatShortDate(d: Date, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatTime(d: Date, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

export function formatDateTime(d: Date, tz = DEFAULT_TZ): string {
  return `${formatDate(d, tz)} at ${formatTime(d, tz)}`;
}

/** Month and day parts for the calendar-leaf date block. */
export function dateParts(d: Date, tz = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { month: get("month").toUpperCase(), day: get("day"), weekday: get("weekday") };
}

export const MEETING_TYPE_LABELS: Record<string, string> = {
  REGULAR: "Regular Meeting",
  SPECIAL: "Special Meeting",
  EMERGENCY: "Emergency Meeting",
  WORKSHOP: "Workshop",
  PUBLIC_HEARING: "Public Hearing",
};

export const BODY_TYPE_LABELS: Record<string, string> = {
  COUNCIL: "Council",
  BOARD: "Board",
  COMMISSION: "Commission",
  COMMITTEE: "Committee",
  AUTHORITY: "Authority",
  TASK_FORCE: "Task Force",
};

export const SEAT_ROLE_LABELS: Record<string, string> = {
  CHAIR: "Chair",
  VICE_CHAIR: "Vice Chair",
  MEMBER: "Member",
  SECRETARY: "Secretary",
  EX_OFFICIO: "Ex Officio",
  ALTERNATE: "Alternate",
};

export const VOTE_LABELS: Record<string, string> = {
  YES: "Yes",
  NO: "No",
  ABSTAIN: "Abstain",
  RECUSED: "Recused",
  ABSENT: "Absent",
};

export function personName(p: { honorific?: string | null; firstName: string; lastName: string }) {
  return [p.honorific, p.firstName, p.lastName].filter(Boolean).join(" ");
}

export function meetingTitle(m: { title: string | null; type: string; body: { name: string } }) {
  return m.title ?? `${m.body.name} ${MEETING_TYPE_LABELS[m.type] ?? "Meeting"}`;
}
