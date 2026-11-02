/**
 * Open-meeting notice rules.
 *
 * Most open-meeting laws require public notice a fixed number of hours before
 * a meeting (for example 72 hours for a regular meeting and 24 hours for a
 * special meeting). The hour counts come from the Organization settings so
 * each jurisdiction can configure its own statute.
 */

export type MeetingKind =
  | "REGULAR"
  | "SPECIAL"
  | "EMERGENCY"
  | "WORKSHOP"
  | "PUBLIC_HEARING";

export interface NoticeRules {
  regularNoticeHours: number;
  specialNoticeHours: number;
  emergencyNoticeHours: number;
}

export type NoticeState =
  /** Notice was posted on or before the deadline. */
  | "met"
  /** Notice was posted, but after the deadline. */
  | "late"
  /** Not posted yet and the deadline is still ahead. */
  | "due"
  /** Not posted and the deadline has passed. */
  | "missed";

export interface NoticeStatus {
  state: NoticeState;
  requiredHours: number;
  /** Latest moment notice can be posted and still comply. */
  deadline: Date;
  /** Hours between posting and the meeting start, when posted. */
  hoursGiven: number | null;
}

const HOUR_MS = 60 * 60 * 1000;

export function requiredNoticeHours(kind: MeetingKind, rules: NoticeRules): number {
  switch (kind) {
    case "SPECIAL":
      return rules.specialNoticeHours;
    case "EMERGENCY":
      return rules.emergencyNoticeHours;
    // Workshops and public hearings are noticed like regular meetings unless a
    // jurisdiction configures otherwise.
    default:
      return rules.regularNoticeHours;
  }
}

export function noticeStatus(
  meeting: { type: MeetingKind; startsAt: Date; noticePostedAt: Date | null },
  rules: NoticeRules,
  now: Date = new Date(),
): NoticeStatus {
  const requiredHours = requiredNoticeHours(meeting.type, rules);
  const deadline = new Date(meeting.startsAt.getTime() - requiredHours * HOUR_MS);

  if (meeting.noticePostedAt) {
    const hoursGiven =
      (meeting.startsAt.getTime() - meeting.noticePostedAt.getTime()) / HOUR_MS;
    return {
      state: meeting.noticePostedAt.getTime() <= deadline.getTime() ? "met" : "late",
      requiredHours,
      deadline,
      hoursGiven: Math.round(hoursGiven * 10) / 10,
    };
  }

  return {
    state: now.getTime() <= deadline.getTime() ? "due" : "missed",
    requiredHours,
    deadline,
    hoursGiven: null,
  };
}
