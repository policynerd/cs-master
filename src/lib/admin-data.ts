/**
 * Workspace reads. Unlike `public.ts`, these return drafts, staff-only
 * documents, pending comments and contact details, so they must only be
 * called after `requireUser()`.
 */
import "server-only";
import { prisma } from "./db";
import { activeVotingSeats } from "./seats";

/**
 * Voting members for a meeting's attendance and roll calls: everyone holding a
 * voting seat on the meeting date, plus anyone already in the record (so a
 * member whose term has since ended still shows on past votes).
 */
export async function meetingMembers(meetingId: string) {
  const m = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      startsAt: true,
      body: {
        select: {
          seats: {
            select: {
              isVoting: true,
              termStart: true,
              termEnd: true,
              endedAt: true,
              role: true,
              person: { select: { id: true, firstName: true, lastName: true, honorific: true } },
            },
          },
        },
      },
      attendance: { select: { person: { select: { id: true, firstName: true, lastName: true, honorific: true } } } },
    },
  });
  if (!m) return [];
  const order = ["CHAIR", "VICE_CHAIR", "SECRETARY", "MEMBER", "ALTERNATE", "EX_OFFICIO"];
  const seated = activeVotingSeats(m.body.seats, m.startsAt).sort(
    (a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.person.lastName.localeCompare(b.person.lastName),
  );
  const people = new Map(seated.map((s) => [s.person.id, s.person]));
  for (const a of m.attendance) if (!people.has(a.person.id)) people.set(a.person.id, a.person);
  return [...people.values()];
}

export async function getWorkspaceMeeting(id: string) {
  return prisma.meeting.findUnique({
    where: { id },
    include: {
      body: true,
      agendaItems: {
        orderBy: [{ section: "asc" }, { position: "asc" }],
        include: {
          attachments: { orderBy: { createdAt: "asc" } },
          motions: {
            orderBy: { createdAt: "asc" },
            include: {
              movedBy: true,
              secondedBy: true,
              votes: { include: { person: true } },
            },
          },
        },
      },
      attendance: { include: { person: true } },
      minutes: true,
      publicComments: { orderBy: { submittedAt: "asc" }, include: { agendaItem: { select: { title: true } } } },
    },
  });
}

export type WorkspaceMeeting = NonNullable<Awaited<ReturnType<typeof getWorkspaceMeeting>>>;

export async function listWorkspaceMeetings(opts: { from?: Date; to?: Date; take?: number; order?: "asc" | "desc" }) {
  return prisma.meeting.findMany({
    where: { startsAt: { gte: opts.from, lt: opts.to } },
    orderBy: { startsAt: opts.order ?? "asc" },
    take: opts.take,
    include: {
      body: { select: { name: true, slug: true, accent: true } },
      minutes: { select: { status: true } },
      _count: { select: { agendaItems: true, publicComments: { where: { status: "PENDING" } } } },
    },
  });
}

export async function meetingActivity(meetingId: string) {
  return prisma.auditEvent.findMany({
    where: { entityType: "Meeting", entityId: meetingId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });
}

export async function laterMeetingsOfBody(bodyId: string, after: Date) {
  return prisma.meeting.findMany({
    where: { bodyId, startsAt: { gt: after }, status: { not: "CANCELLED" } },
    orderBy: { startsAt: "asc" },
    take: 10,
    select: { id: true, startsAt: true, type: true, title: true },
  });
}
