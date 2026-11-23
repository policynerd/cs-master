/**
 * Public-portal data access.
 *
 * Every read the public site makes goes through this file, and each query
 * applies the publication rules in one place:
 *   - Draft meetings are never shown.
 *   - An agenda appears only once `agendaPublishedAt` has passed.
 *   - Confidential (closed-session) items show only their title and citation.
 *   - Private attachments, member contact details and pending public comments
 *     are never selected.
 *   - Minutes appear only after they are approved.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { DEFAULT_TZ, startOfDayInTz } from "./format";

const publicMeeting = { status: { not: "DRAFT" } } satisfies Prisma.MeetingWhereInput;

const bodyCard = {
  select: { id: true, slug: true, name: true, type: true, accent: true },
} as const;

export async function getOrganization() {
  const org = await prisma.organization.findFirst();
  return (
    org ?? {
      name: "Board Portal",
      shortName: null,
      timezone: "America/New_York",
      regularNoticeHours: 72,
      specialNoticeHours: 24,
      emergencyNoticeHours: 1,
    }
  );
}

export async function listMeetings(opts: {
  when: "upcoming" | "past";
  bodySlug?: string;
  take?: number;
  now?: Date;
  /** Organization timezone; decides where "today" begins. */
  tz?: string;
}) {
  const now = opts.now ?? new Date();
  const today = startOfDayInTz(now, opts.tz ?? DEFAULT_TZ);
  return prisma.meeting.findMany({
    where: {
      ...publicMeeting,
      ...(opts.bodySlug ? { body: { slug: opts.bodySlug } } : {}),
      startsAt: opts.when === "upcoming" ? { gte: today } : { lt: today },
    },
    orderBy: { startsAt: opts.when === "upcoming" ? "asc" : "desc" },
    take: opts.take,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      startsAt: true,
      location: true,
      livestreamUrl: true,
      agendaPublishedAt: true,
      cancelledReason: true,
      body: bodyCard,
      minutes: { select: { status: true } },
    },
  });
}

export async function getMeeting(id: string, now: Date = new Date()) {
  const meeting = await prisma.meeting.findFirst({
    where: { id, ...publicMeeting },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      startsAt: true,
      endsAt: true,
      location: true,
      address: true,
      virtualUrl: true,
      livestreamUrl: true,
      recordingUrl: true,
      noticePostedAt: true,
      agendaPublishedAt: true,
      cancelledReason: true,
      body: {
        select: { id: true, slug: true, name: true, type: true, accent: true, seatCount: true, quorum: true },
      },
      agendaItems: {
        orderBy: [{ section: "asc" }, { position: "asc" }],
        select: {
          id: true,
          section: true,
          position: true,
          kind: true,
          title: true,
          summary: true,
          recommendedAction: true,
          fiscalImpact: true,
          presenter: true,
          department: true,
          isConfidential: true,
          legalCitation: true,
          attachments: {
            where: { isPublic: true },
            select: { id: true, title: true, url: true, mimeType: true, sizeBytes: true },
          },
          motions: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              text: true,
              result: true,
              requiredVotes: true,
              movedBy: { select: { firstName: true, lastName: true, honorific: true } },
              secondedBy: { select: { firstName: true, lastName: true, honorific: true } },
              votes: {
                select: {
                  choice: true,
                  person: { select: { id: true, firstName: true, lastName: true, honorific: true } },
                },
              },
            },
          },
        },
      },
      attendance: {
        select: {
          status: true,
          person: { select: { id: true, firstName: true, lastName: true, honorific: true } },
        },
      },
      minutes: {
        where: { status: "APPROVED" },
        select: { body: true, approvedAt: true },
      },
      publicComments: {
        where: { status: "ACCEPTED" },
        orderBy: { submittedAt: "asc" },
        select: { id: true, name: true, city: true, position: true, body: true, agendaItemId: true },
      },
    },
  });
  if (!meeting) return null;

  const agendaIsPublic =
    meeting.agendaPublishedAt !== null && meeting.agendaPublishedAt.getTime() <= now.getTime();

  // Closed-session items keep only what the law requires to be disclosed.
  const agendaItems = agendaIsPublic
    ? meeting.agendaItems.map((item) =>
        item.isConfidential
          ? {
              ...item,
              summary: null,
              recommendedAction: null,
              fiscalImpact: null,
              presenter: null,
              attachments: [],
            }
          : item,
      )
    : [];

  return { ...meeting, agendaIsPublic, agendaItems };
}

export type PublicMeeting = NonNullable<Awaited<ReturnType<typeof getMeeting>>>;

export async function listBodies() {
  return prisma.body.findMany({
    where: { isActive: true },
    orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      description: true,
      accent: true,
      seatCount: true,
      parent: { select: { name: true, slug: true } },
      seats: { select: { isVoting: true, termStart: true, termEnd: true, endedAt: true } },
    },
  });
}

export async function getBody(slug: string) {
  return prisma.body.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      description: true,
      authority: true,
      accent: true,
      seatCount: true,
      quorum: true,
      parent: { select: { name: true, slug: true } },
      children: { where: { isActive: true }, select: { name: true, slug: true, type: true } },
      seats: {
        orderBy: [{ role: "asc" }, { termStart: "asc" }],
        select: {
          id: true,
          role: true,
          seatLabel: true,
          isVoting: true,
          appointedBy: true,
          termStart: true,
          termEnd: true,
          endedAt: true,
          // Public profile only; email and phone stay private.
          person: { select: { id: true, firstName: true, lastName: true, honorific: true, title: true } },
        },
      },
    },
  });
}

/** Meetings that can still take written comment: agenda public, not yet started. */
export async function getCommentableMeeting(id: string, now: Date = new Date()) {
  return prisma.meeting.findFirst({
    where: {
      id,
      status: "SCHEDULED",
      startsAt: { gt: now },
      agendaPublishedAt: { lte: now },
    },
    select: {
      id: true,
      agendaItems: { where: { isConfidential: false }, select: { id: true } },
    },
  });
}
