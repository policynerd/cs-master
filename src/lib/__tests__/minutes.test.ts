import { describe, expect, it } from "vitest";
import { draftMinutes, type MinutesInput } from "../minutes";

const p = (firstName: string, lastName: string, honorific?: string) => ({ firstName, lastName, honorific });
const vega = p("Marisol", "Vega"), ortiz = p("Samuel", "Ortiz"), nwosu = p("Ada", "Nwosu");

const base: MinutesInput = {
  bodyName: "Planning Commission",
  meetingLabel: "Regular Meeting",
  dateLabel: "Thursday, November 12, 2026",
  timeLabel: "6:00 PM EST",
  location: "Room 201, Town Hall",
  quorum: 2,
  attendance: [
    { status: "PRESENT", person: vega },
    { status: "REMOTE", person: ortiz },
    { status: "EXCUSED", person: nwosu },
  ],
  items: [
    { id: "a", section: "CALL_TO_ORDER", position: 1, title: "Call to order", isConfidential: false, motions: [] },
    {
      id: "b",
      section: "PUBLIC_HEARINGS",
      position: 1,
      title: "SP-26-07: Creekside Commons site plan",
      isConfidential: false,
      motions: [
        {
          text: "Approve SP-26-07 with the 14 conditions in the staff report.",
          result: "PASSED",
          requiredVotes: null,
          movedBy: ortiz,
          secondedBy: vega,
          votes: [
            { choice: "YES", person: vega },
            { choice: "YES", person: ortiz },
            { choice: "ABSENT", person: nwosu },
          ],
        },
      ],
    },
    { id: "c", section: "CLOSED_SESSION", position: 1, title: "Pending litigation", isConfidential: true, motions: [] },
  ],
};

describe("draftMinutes", () => {
  const text = draftMinutes(base);

  it("opens with the meeting and attendance", () => {
    expect(text).toContain("The Planning Commission held a regular meeting on Thursday, November 12, 2026 at 6:00 PM EST in Room 201, Town Hall.");
    expect(text).toContain("**Present:** Marisol Vega, Samuel Ortiz (remote).");
    expect(text).toContain("**Absent:** Ada Nwosu (excused).");
    expect(text).toContain("A quorum (2) was present.");
  });

  it("records motions with mover, result, tally and roll call", () => {
    expect(text).toContain(
      "**2. SP-26-07: Creekside Commons site plan.** Samuel Ortiz moved, seconded by Marisol Vega, to approve SP-26-07 with the 14 conditions in the staff report. The motion passed 2–0 (1 absent). Ayes: Vega, Ortiz. Absent: Nwosu.",
    );
  });

  it("leaves placeholders for narrative and closed session", () => {
    expect(text).toContain("**1. Call to Order.** The presiding officer called the meeting to order at [time].");
    expect(text).toContain("**3. Pending litigation.** The body met in closed session. [Report any action taken.]");
  });

  it("flags a missing quorum", () => {
    const t = draftMinutes({ ...base, quorum: 3 });
    expect(t).toContain("A quorum (3) was **not** present; 2 members were in attendance.");
  });
});
