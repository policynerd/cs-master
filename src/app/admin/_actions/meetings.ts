"use server";

import type { MeetingType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { done, fail, field, safeUrl } from "@/lib/flash";
import { formatDateTime, MEETING_TYPE_LABELS } from "@/lib/format";
import { noticeStatus } from "@/lib/notice";
import { getOrganization } from "@/lib/public";
import { zonedInputToUtc } from "@/lib/zoned";

const TYPES = Object.keys(MEETING_TYPE_LABELS) as MeetingType[];

async function readMeetingForm(form: FormData, back: string) {
  const org = await getOrganization();
  const bodyId = field(form, "bodyId");
  const type = field(form, "type") as MeetingType | null;
  const startsRaw = field(form, "startsAt");
  if (!bodyId || !(await prisma.body.findUnique({ where: { id: bodyId }, select: { id: true } }))) {
    fail(back, "Choose the board or commission that is meeting.");
  }
  if (!type || !TYPES.includes(type)) fail(back, "Choose a meeting type.");
  const startsAt = startsRaw ? zonedInputToUtc(startsRaw, org.timezone) : null;
  if (!startsAt) fail(back, "Enter the meeting date and start time.");

  const links: Record<string, string | null> = {};
  for (const name of ["virtualUrl", "livestreamUrl", "recordingUrl"] as const) {
    const v = safeUrl(field(form, name));
    if (v === undefined) fail(back, "Links must be full web addresses starting with https://.");
    links[name] = v;
  }
  return {
    bodyId: bodyId!,
    type: type!,
    startsAt: startsAt!,
    title: field(form, "title"),
    location: field(form, "location"),
    address: field(form, "address"),
    ...links,
  };
}

export async function createMeeting(form: FormData) {
  const user = await requireUser();
  const back = "/admin/meetings/new";
  const data = await readMeetingForm(form, back);
  const meeting = await prisma.$transaction(async (tx) => {
    const m = await tx.meeting.create({ data: { ...data, status: "DRAFT" }, include: { body: true } });
    await audit(user, {
      action: "meeting.create",
      entityType: "Meeting",
      entityId: m.id,
      summary: `Created a draft ${MEETING_TYPE_LABELS[m.type].toLowerCase()} of the ${m.body.name}`,
    }, tx);
    return m;
  });
  done(`/admin/meetings/${meeting.id}?tab=agenda`, "Draft meeting created. Add agenda items, then post notice.");
}

export async function updateMeeting(form: FormData) {
  const user = await requireUser();
  const id = field(form, "meetingId") ?? "";
  const back = `/admin/meetings/${id}?tab=details`;
  const existing = await prisma.meeting.findUnique({ where: { id } });
  if (!existing) fail("/admin", "That meeting no longer exists.");
  if (existing.status === "CANCELLED") fail(back, "Cancelled meetings can't be edited.");
  const data = await readMeetingForm(form, back);
  if (existing.noticePostedAt && data.startsAt.getTime() !== existing.startsAt.getTime()) {
    fail(back, "Notice has already been posted for this time. Cancel this meeting and schedule a new one instead of moving it.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.meeting.update({ where: { id }, data });
    await audit(user, { action: "meeting.update", entityType: "Meeting", entityId: id, summary: "Updated meeting details" }, tx);
  });
  revalidatePath(`/meetings/${id}`);
  done(back, "Meeting details saved.");
}

/** Posts public notice. The meeting appears on the portal with "Agenda pending". */
export async function postNotice(form: FormData) {
  const user = await requireUser();
  const id = field(form, "meetingId") ?? "";
  const back = `/admin/meetings/${id}?tab=details`;
  const [org, m] = await Promise.all([getOrganization(), prisma.meeting.findUnique({ where: { id } })]);
  if (!m) fail("/admin", "That meeting no longer exists.");
  if (m.status !== "DRAFT") fail(back, "Notice has already been posted.");
  const now = new Date();
  const ns = noticeStatus({ ...m, noticePostedAt: now }, org, now);
  if (ns.state === "late" && m.type !== "EMERGENCY") {
    fail(back, lateMessage(m.type, ns.requiredHours, ns.deadline, org.timezone));
  }
  await prisma.$transaction(async (tx) => {
    await tx.meeting.update({ where: { id }, data: { status: "SCHEDULED", noticePostedAt: now } });
    await audit(user, { action: "meeting.notice", entityType: "Meeting", entityId: id, summary: "Posted public notice" }, tx);
  });
  revalidatePath("/", "layout");
  done(back, "Notice posted. The meeting now appears on the public calendar.");
}

/** Publishes the agenda (and posts notice if it hasn't been). */
export async function publishAgenda(form: FormData) {
  const user = await requireUser();
  const id = field(form, "meetingId") ?? "";
  const back = `/admin/meetings/${id}?tab=agenda`;
  const [org, m] = await Promise.all([
    getOrganization(),
    prisma.meeting.findUnique({ where: { id }, include: { _count: { select: { agendaItems: true } } } }),
  ]);
  if (!m) fail("/admin", "That meeting no longer exists.");
  if (m.status === "CANCELLED") fail(back, "This meeting is cancelled.");
  if (m.agendaPublishedAt) fail(back, "The agenda is already published.");
  if (m._count.agendaItems === 0) fail(back, "Add at least one agenda item before publishing.");
  const now = new Date();
  const ns = noticeStatus({ ...m, noticePostedAt: now }, org, now);
  if (ns.state === "late" && m.type !== "EMERGENCY") {
    fail(back, lateMessage(m.type, ns.requiredHours, ns.deadline, org.timezone));
  }
  await prisma.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id },
      data: {
        status: m.status === "DRAFT" ? "SCHEDULED" : m.status,
        noticePostedAt: m.noticePostedAt ?? now,
        agendaPublishedAt: now,
      },
    });
    await audit(user, {
      action: "agenda.publish",
      entityType: "Meeting",
      entityId: id,
      summary: `Published the agenda (${m._count.agendaItems} items)`,
    }, tx);
  });
  revalidatePath("/", "layout");
  done(back, "Agenda published to the public portal.");
}

export async function cancelMeeting(form: FormData) {
  const user = await requireUser();
  const id = field(form, "meetingId") ?? "";
  const back = `/admin/meetings/${id}?tab=details`;
  const reason = field(form, "reason");
  if (!reason) fail(back, "Give a reason for the cancellation. It is shown to the public.");
  const m = await prisma.meeting.findUnique({ where: { id } });
  if (!m) fail("/admin", "That meeting no longer exists.");
  if (m.status === "ADJOURNED" || m.status === "CANCELLED") fail(back, "This meeting can no longer be cancelled.");
  await prisma.$transaction(async (tx) => {
    // A draft that was never public is simply removed from view; a noticed meeting stays listed as cancelled.
    await tx.meeting.update({ where: { id }, data: { status: "CANCELLED", cancelledReason: reason } });
    await audit(user, { action: "meeting.cancel", entityType: "Meeting", entityId: id, summary: `Cancelled the meeting: ${reason}` }, tx);
  });
  revalidatePath("/", "layout");
  done(back, "Meeting cancelled.");
}

export async function setMeetingStatus(form: FormData) {
  const user = await requireUser();
  const id = field(form, "meetingId") ?? "";
  const to = field(form, "status");
  const back = `/admin/meetings/${id}?tab=record`;
  const m = await prisma.meeting.findUnique({ where: { id } });
  if (!m) fail("/admin", "That meeting no longer exists.");
  const allowed: Record<string, string[]> = { SCHEDULED: ["IN_PROGRESS"], IN_PROGRESS: ["ADJOURNED"] };
  if (!to || !allowed[m.status]?.includes(to)) fail(back, "That status change isn't allowed.");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id },
      data: { status: to as "IN_PROGRESS" | "ADJOURNED", ...(to === "ADJOURNED" ? { endsAt: now } : {}) },
    });
    await audit(user, {
      action: to === "IN_PROGRESS" ? "meeting.start" : "meeting.adjourn",
      entityType: "Meeting",
      entityId: id,
      summary: to === "IN_PROGRESS" ? "Called the meeting to order" : "Adjourned the meeting",
    }, tx);
  });
  revalidatePath("/", "layout");
  done(back, to === "IN_PROGRESS" ? "Meeting is in session." : "Meeting adjourned.");
}

function lateMessage(type: MeetingType, hours: number, deadline: Date, tz: string) {
  return (
    `It's too late to give the required ${hours} hours' notice for a ${MEETING_TYPE_LABELS[type].toLowerCase()}: ` +
    `the deadline was ${formatDateTime(deadline, tz)}. Reschedule the meeting, or change its type if your rules allow a special or emergency meeting.`
  );
}
