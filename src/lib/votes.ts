/**
 * Roll-call vote tallies.
 *
 * Default rule: a motion passes when YES votes outnumber NO votes, with at
 * least one YES. Abstentions and recusals do not count either way. When a
 * motion needs a fixed number of votes (a supermajority, or a "majority of the
 * full body" rule), set `requiredVotes` and YES must reach it.
 */

export type VoteChoice = "YES" | "NO" | "ABSTAIN" | "RECUSED" | "ABSENT";

export interface Tally {
  yes: number;
  no: number;
  abstain: number;
  recused: number;
  absent: number;
  passes: boolean;
}

export function tally(
  votes: { choice: VoteChoice }[],
  requiredVotes: number | null = null,
): Tally {
  const t = { yes: 0, no: 0, abstain: 0, recused: 0, absent: 0 };
  for (const v of votes) {
    switch (v.choice) {
      case "YES":
        t.yes++;
        break;
      case "NO":
        t.no++;
        break;
      case "ABSTAIN":
        t.abstain++;
        break;
      case "RECUSED":
        t.recused++;
        break;
      case "ABSENT":
        t.absent++;
        break;
    }
  }
  const passes =
    requiredVotes !== null && requiredVotes > 0
      ? t.yes >= requiredVotes
      : t.yes > 0 && t.yes > t.no;
  return { ...t, passes };
}

/** "4–1 (1 abstaining)" style summary for minutes and the public record. */
export function tallyLabel(t: Tally): string {
  const extras: string[] = [];
  if (t.abstain) extras.push(`${t.abstain} abstaining`);
  if (t.recused) extras.push(`${t.recused} recused`);
  if (t.absent) extras.push(`${t.absent} absent`);
  return `${t.yes}–${t.no}${extras.length ? ` (${extras.join(", ")})` : ""}`;
}
