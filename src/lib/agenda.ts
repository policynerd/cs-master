/**
 * Agenda structure: section order, labels and item numbering.
 */

export const SECTION_ORDER = [
  "CALL_TO_ORDER",
  "ROLL_CALL",
  "PLEDGE",
  "APPROVAL_OF_AGENDA",
  "APPROVAL_OF_MINUTES",
  "PUBLIC_COMMENT",
  "CONSENT",
  "PRESENTATIONS",
  "PUBLIC_HEARINGS",
  "UNFINISHED_BUSINESS",
  "NEW_BUSINESS",
  "REPORTS",
  "CLOSED_SESSION",
  "ADJOURNMENT",
] as const;

export type Section = (typeof SECTION_ORDER)[number];

export const SECTION_LABELS: Record<Section, string> = {
  CALL_TO_ORDER: "Call to Order",
  ROLL_CALL: "Roll Call",
  PLEDGE: "Pledge of Allegiance",
  APPROVAL_OF_AGENDA: "Approval of the Agenda",
  APPROVAL_OF_MINUTES: "Approval of Minutes",
  PUBLIC_COMMENT: "Public Comment",
  CONSENT: "Consent Agenda",
  PRESENTATIONS: "Presentations and Proclamations",
  PUBLIC_HEARINGS: "Public Hearings",
  UNFINISHED_BUSINESS: "Unfinished Business",
  NEW_BUSINESS: "New Business",
  REPORTS: "Reports",
  CLOSED_SESSION: "Closed Session",
  ADJOURNMENT: "Adjournment",
};

/** Short explanations shown under some section headings on the public agenda. */
export const SECTION_NOTES: Partial<Record<Section, string>> = {
  CONSENT:
    "Consent items are routine and are approved together in one vote unless a member asks to discuss one separately.",
  PUBLIC_COMMENT:
    "Members of the public may speak on items not on the agenda. Comments on agenda items are taken when the item is heard.",
  CLOSED_SESSION:
    "Closed session is not open to the public. Any action taken is reported out in open session.",
};

export interface NumberedSection<T> {
  section: Section;
  label: string;
  number: string;
  items: (T & { number: string })[];
}

/**
 * Groups items into sections in statutory order and numbers them. Sections are
 * numbered 1, 2, 3… in the order they appear on this agenda. A section with one
 * item uses the section number alone ("4"); a section with several letters each
 * item ("7.A", "7.B").
 */
export function numberAgenda<T extends { section: Section; position: number }>(
  items: T[],
): NumberedSection<T>[] {
  const bySection = new Map<Section, T[]>();
  for (const item of items) {
    const list = bySection.get(item.section) ?? [];
    list.push(item);
    bySection.set(item.section, list);
  }

  const result: NumberedSection<T>[] = [];
  let sectionNumber = 0;
  for (const section of SECTION_ORDER) {
    const list = bySection.get(section);
    if (!list?.length) continue;
    sectionNumber++;
    const sorted = [...list].sort((a, b) => a.position - b.position);
    result.push({
      section,
      label: SECTION_LABELS[section],
      number: String(sectionNumber),
      items: sorted.map((item, i) => ({
        ...item,
        number: sorted.length === 1 ? String(sectionNumber) : `${sectionNumber}.${letter(i)}`,
      })),
    });
  }
  return result;
}

/** 0 → A, 25 → Z, 26 → AA. */
export function letter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
