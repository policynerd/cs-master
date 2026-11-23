/**
 * Drafts minutes from the structured meeting record: attendance, quorum, each
 * agenda item in order, and every motion with its mover, seconder, result and
 * roll call. The clerk edits the draft before approval; narrative such as
 * public testimony still has to be written by hand.
 */
import { numberAgenda, type Section } from "./agenda";
import { tally, tallyLabel, type VoteChoice } from "./votes";

type Name = { honorific?: string | null; firstName: string; lastName: string };

export interface MinutesInput {
  bodyName: string;
  meetingLabel: string;
  dateLabel: string;
  timeLabel: string;
  location: string | null;
  quorum: number;
  attendance: { status: "PRESENT" | "REMOTE" | "ABSENT" | "EXCUSED" | "LATE"; person: Name }[];
  items: {
    id: string;
    section: Section;
    position: number;
    title: string;
    isConfidential: boolean;
    motions: {
      text: string;
      result: string;
      requiredVotes: number | null;
      movedBy: Name | null;
      secondedBy: Name | null;
      votes: { choice: VoteChoice; person: Name }[];
    }[];
  }[];
}

const full = (p: Name) => [p.honorific, p.firstName, p.lastName].filter(Boolean).join(" ");

export function draftMinutes(m: MinutesInput): string {
  const out: string[] = [];
  const present = m.attendance.filter((a) => ["PRESENT", "REMOTE", "LATE"].includes(a.status));
  const absent = m.attendance.filter((a) => ["ABSENT", "EXCUSED"].includes(a.status));

  out.push(
    `The ${m.bodyName} held a ${m.meetingLabel.toLowerCase()} on ${m.dateLabel} at ${m.timeLabel}` +
      (m.location ? ` in ${m.location}.` : "."),
  );

  if (m.attendance.length) {
    const presentNames = present.map((a) => full(a.person) + (a.status === "REMOTE" ? " (remote)" : a.status === "LATE" ? " (arrived late)" : ""));
    out.push(`**Present:** ${presentNames.length ? presentNames.join(", ") : "None"}.`);
    if (absent.length) {
      out.push(`**Absent:** ${absent.map((a) => full(a.person) + (a.status === "EXCUSED" ? " (excused)" : "")).join(", ")}.`);
    }
    out.push(
      present.length >= m.quorum
        ? `A quorum (${m.quorum}) was present.`
        : `A quorum (${m.quorum}) was **not** present; ${present.length} ${present.length === 1 ? "member was" : "members were"} in attendance.`,
    );
  }

  for (const section of numberAgenda(m.items)) {
    // Procedural sections read as standard sentences rather than item summaries.
    if (!section.items.some((i) => i.motions.length)) {
      if (section.section === "CALL_TO_ORDER") {
        out.push(`**${section.number}. Call to Order.** The presiding officer called the meeting to order at [time].`);
        continue;
      }
      if (section.section === "ROLL_CALL" || section.section === "PLEDGE") continue;
      if (section.section === "ADJOURNMENT") {
        out.push(`**${section.number}. Adjournment.** The meeting adjourned at [time].`);
        continue;
      }
    }
    for (const item of section.items) {
      const heading = section.items.length > 1 || item.title.toLowerCase() !== section.label.toLowerCase()
        ? `**${item.number}. ${item.title}.**`
        : `**${item.number}. ${section.label}.**`;
      if (!item.motions.length) {
        out.push(item.isConfidential ? `${heading} The body met in closed session. [Report any action taken.]` : `${heading} [Summary of discussion.]`);
        continue;
      }
      const sentences = item.motions.map((mo) => {
        const t = tally(mo.votes, mo.requiredVotes);
        const who = mo.movedBy
          ? ` ${full(mo.movedBy)} moved${mo.secondedBy ? `, seconded by ${full(mo.secondedBy)},` : ""} to`
          : " A motion was made to";
        const text = mo.text.replace(/^(move|moved)\s+(to\s+)?/i, "");
        const verb = lowerFirst(text.replace(/\.$/, ""));
        const outcome = describeResult(mo.result, t, mo.votes.length > 0);
        const roll = rollCall(mo.votes);
        return `${who} ${verb}. ${outcome}${roll ? ` ${roll}` : ""}`.trim();
      });
      out.push(`${heading} ${sentences.join(" ")}`);
    }
  }

  return out.join("\n\n");
}

function describeResult(result: string, t: ReturnType<typeof tally>, hasVotes: boolean): string {
  const count = hasVotes ? ` ${tallyLabel(t)}` : "";
  switch (result) {
    case "PASSED":
      return `The motion passed${count}.`;
    case "FAILED":
      return `The motion failed${count}.`;
    case "TABLED":
      return "The motion was tabled.";
    case "WITHDRAWN":
      return "The motion was withdrawn.";
    default:
      return "[Result not recorded.]";
  }
}

function rollCall(votes: { choice: VoteChoice; person: Name }[]): string {
  if (!votes.length) return "";
  const groups: [VoteChoice, string][] = [
    ["YES", "Ayes"],
    ["NO", "Noes"],
    ["ABSTAIN", "Abstaining"],
    ["RECUSED", "Recused"],
    ["ABSENT", "Absent"],
  ];
  return groups
    .map(([choice, label]) => {
      const names = votes.filter((v) => v.choice === choice).map((v) => v.person.lastName);
      return names.length ? `${label}: ${names.join(", ")}.` : "";
    })
    .filter(Boolean)
    .join(" ");
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
