/**
 * Seats, vacancies and quorum.
 */

export interface SeatLike {
  isVoting: boolean;
  termStart: Date;
  termEnd: Date | null;
  endedAt: Date | null;
}

/** A seat is active on `at` when its term has started and has not ended. */
export function isSeatActive(seat: SeatLike, at: Date = new Date()): boolean {
  const t = at.getTime();
  if (seat.termStart.getTime() > t) return false;
  if (seat.endedAt && seat.endedAt.getTime() <= t) return false;
  if (seat.termEnd && seat.termEnd.getTime() <= t) return false;
  return true;
}

export function activeVotingSeats<T extends SeatLike>(seats: T[], at: Date = new Date()): T[] {
  return seats.filter((s) => s.isVoting && isSeatActive(s, at));
}

export function vacancyCount(
  body: { seatCount: number },
  seats: SeatLike[],
  at: Date = new Date(),
): number {
  return Math.max(0, body.seatCount - activeVotingSeats(seats, at).length);
}

/**
 * Votes needed for a quorum. Uses the body's configured quorum, otherwise a
 * simple majority of the authorized seats (vacant seats still count, which is
 * the common rule).
 */
export function quorumFor(body: { seatCount: number; quorum: number | null }): number {
  if (body.quorum && body.quorum > 0) return body.quorum;
  return Math.floor(body.seatCount / 2) + 1;
}

/** Terms ending within `days` of `at`, for reappointment planning. */
export function expiringSoon<T extends SeatLike>(
  seats: T[],
  days: number,
  at: Date = new Date(),
): T[] {
  const horizon = at.getTime() + days * 24 * 60 * 60 * 1000;
  return activeVotingSeats(seats, at).filter(
    (s) => s.termEnd !== null && s.termEnd.getTime() <= horizon,
  );
}
