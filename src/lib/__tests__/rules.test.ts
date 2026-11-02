import { describe, expect, it } from "vitest";
import { noticeStatus, requiredNoticeHours } from "../notice";
import { activeVotingSeats, expiringSoon, isSeatActive, quorumFor, vacancyCount } from "../seats";
import { tally, tallyLabel } from "../votes";
import { letter, numberAgenda } from "../agenda";

const rules = { regularNoticeHours: 72, specialNoticeHours: 24, emergencyNoticeHours: 1 };
const H = 3600 * 1000;
const start = new Date("2026-12-01T18:00:00Z");

describe("notice", () => {
  it("picks the hour count by meeting type", () => {
    expect(requiredNoticeHours("REGULAR", rules)).toBe(72);
    expect(requiredNoticeHours("SPECIAL", rules)).toBe(24);
    expect(requiredNoticeHours("EMERGENCY", rules)).toBe(1);
    expect(requiredNoticeHours("PUBLIC_HEARING", rules)).toBe(72);
  });

  it("is met when posted exactly at the deadline", () => {
    const s = noticeStatus(
      { type: "REGULAR", startsAt: start, noticePostedAt: new Date(start.getTime() - 72 * H) },
      rules,
    );
    expect(s.state).toBe("met");
    expect(s.hoursGiven).toBe(72);
  });

  it("is late when posted after the deadline", () => {
    const s = noticeStatus(
      { type: "REGULAR", startsAt: start, noticePostedAt: new Date(start.getTime() - 48 * H) },
      rules,
    );
    expect(s.state).toBe("late");
    expect(s.hoursGiven).toBe(48);
  });

  it("is due before the deadline and missed after it when not posted", () => {
    const meeting = { type: "SPECIAL" as const, startsAt: start, noticePostedAt: null };
    expect(noticeStatus(meeting, rules, new Date(start.getTime() - 30 * H)).state).toBe("due");
    expect(noticeStatus(meeting, rules, new Date(start.getTime() - 10 * H)).state).toBe("missed");
    expect(noticeStatus(meeting, rules).deadline.toISOString()).toBe("2026-11-30T18:00:00.000Z");
  });
});

describe("seats", () => {
  const at = new Date("2026-06-01T00:00:00Z");
  const seat = (o: Partial<Parameters<typeof isSeatActive>[0]> = {}) => ({
    isVoting: true,
    termStart: new Date("2025-01-01T00:00:00Z"),
    termEnd: new Date("2028-12-31T00:00:00Z"),
    endedAt: null,
    ...o,
  });

  it("knows when a seat is active", () => {
    expect(isSeatActive(seat(), at)).toBe(true);
    expect(isSeatActive(seat({ termStart: new Date("2027-01-01") }), at)).toBe(false);
    expect(isSeatActive(seat({ termEnd: new Date("2026-01-01") }), at)).toBe(false);
    expect(isSeatActive(seat({ endedAt: new Date("2026-03-01") }), at)).toBe(false);
    expect(isSeatActive(seat({ termEnd: null }), at)).toBe(true);
  });

  it("counts vacancies against authorized seats, ignoring non-voting seats", () => {
    const seats = [seat(), seat(), seat({ isVoting: false }), seat({ endedAt: new Date("2026-02-01") })];
    expect(activeVotingSeats(seats, at)).toHaveLength(2);
    expect(vacancyCount({ seatCount: 5 }, seats, at)).toBe(3);
    expect(vacancyCount({ seatCount: 1 }, seats, at)).toBe(0);
  });

  it("computes quorum as a majority of seats unless configured", () => {
    expect(quorumFor({ seatCount: 7, quorum: null })).toBe(4);
    expect(quorumFor({ seatCount: 6, quorum: null })).toBe(4);
    expect(quorumFor({ seatCount: 9, quorum: 6 })).toBe(6);
  });

  it("finds terms expiring within a window", () => {
    const soon = seat({ termEnd: new Date("2026-06-20T00:00:00Z") });
    expect(expiringSoon([seat(), soon], 30, at)).toEqual([soon]);
  });
});

describe("votes", () => {
  const v = (...choices: Parameters<typeof tally>[0][number]["choice"][]) =>
    choices.map((choice) => ({ choice }));

  it("passes on a simple majority of votes cast", () => {
    const t = tally(v("YES", "YES", "YES", "NO", "ABSTAIN"));
    expect(t.passes).toBe(true);
    expect(tallyLabel(t)).toBe("3–1 (1 abstaining)");
  });

  it("fails on a tie or with no yes votes", () => {
    expect(tally(v("YES", "NO")).passes).toBe(false);
    expect(tally(v("ABSTAIN", "ABSENT")).passes).toBe(false);
  });

  it("applies a required vote count", () => {
    expect(tally(v("YES", "YES", "YES", "YES", "NO"), 5).passes).toBe(false);
    expect(tally(v("YES", "YES", "YES", "YES", "YES", "NO", "RECUSED"), 5).passes).toBe(true);
  });
});

describe("agenda numbering", () => {
  it("orders sections statutorily and letters multi-item sections", () => {
    const out = numberAgenda([
      { section: "NEW_BUSINESS", position: 2, id: "nb2" },
      { section: "CALL_TO_ORDER", position: 1, id: "cto" },
      { section: "NEW_BUSINESS", position: 1, id: "nb1" },
      { section: "CONSENT", position: 1, id: "c1" },
    ]);
    expect(out.map((s) => [s.number, s.section])).toEqual([
      ["1", "CALL_TO_ORDER"],
      ["2", "CONSENT"],
      ["3", "NEW_BUSINESS"],
    ]);
    expect(out[0].items[0].number).toBe("1");
    expect(out[2].items.map((i) => [i.id, i.number])).toEqual([
      ["nb1", "3.A"],
      ["nb2", "3.B"],
    ]);
  });

  it("letters past Z", () => {
    expect([letter(0), letter(25), letter(26), letter(27)]).toEqual(["A", "Z", "AA", "AB"]);
  });
});

describe("timezone day boundary", async () => {
  const { startOfDayInTz } = await import("../format");
  it("finds local midnight across DST", () => {
    expect(startOfDayInTz(new Date("2026-11-02T03:30:00Z"), "America/New_York").toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(startOfDayInTz(new Date("2026-11-02T15:00:00Z"), "America/New_York").toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(startOfDayInTz(new Date("2026-07-01T12:00:00Z"), "America/Los_Angeles").toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });
});
