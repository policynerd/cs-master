"use server";

import type { AttendanceStatus, MotionResult, VoteChoice } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { done, fail, field } from "@/lib/flash";
import { tally } from "@/lib/votes";
import { meetingMembers } from "@/lib/admin-data";

const ATTENDANCE: AttendanceStatus[] = ["PRESENT", "REMOTE", "LATE", "ABSENT", "EXCUSED"];
const CHOICES: VoteChoice[] = ["YES", "NO", "ABSTAIN", "RECUSED", "ABSENT"];

/** The record can be kept while a meeting is in session and after it adjourns. */
async function recordableMeeting(meetingId: string, back: string) {
  const m = await prisma.meeting.findUnique({ where: { id: meetingId }, include: { minutes: { select: { status: true } } } });
  if (!m) fail("/admin", "That meeting no longer exists.");
  if (m.status !== "IN_PROGRESS" && m.status !== "ADJOURNED") {
    fail(back, "Call the meeting to order before recording attendance or votes.");
  }
  if (m.minutes?.status === "APPROVED") fail(back, "The minutes are approved, so the record is closed.");
  return m;
}

export async function saveAttendance(form: FormData) {
  const user = await requireUser();
  const meetingId = field(form, "meetingId") ?? "";
  const back = `/admin/meetings/${meetingId}?tab=record`;
  await recordableMeeting(meetingId, back);
  const members = await meetingMembers(meetingId);
  const rows = members.map((p) => ({ personId: p.id, status: field(form, `att-${p.id}`) as AttendanceStatus | null }));
  if (rows.some((r) => !r.status || !ATTENDANCE.includes(r.status))) fail(back, "Mark every member present, remote, late, absent or excused.");
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      await tx.attendance.upsert({
        where: { meetingId_personId: { meetingId, personId: r.personId } },
        create: { meetingId, personId: r.personId, status: r.status! },
        update: { status: r.status! },
      });
    }
    const here = rows.filter((r) => r.status !== "ABSENT" && r.status !== "EXCUSED").length;
    await audit(user, { action: "attendance.save", entityType: "Meeting", entityId: meetingId, summary: `Recorded attendance (${here} of ${rows.length} present)` }, tx);
  });
  revalidatePath(`/meetings/${meetingId}`);
  done(back + "#attendance", "Attendance saved.");
}

export async function addMotion(form: FormData) {
  const user = await requireUser();
  const meetingId = field(form, "meetingId") ?? "";
  const back = `/admin/meetings/${meetingId}?tab=record`;
  await recordableMeeting(meetingId, back);
  const agendaItemId = field(form, "agendaItemId") ?? "";
  const item = await prisma.agendaItem.findFirst({ where: { id: agendaItemId, meetingId } });
  if (!item) fail(back, "Choose the agenda item the motion is on.");
  const text = field(form, "text");
  if (!text) fail(back, "Enter the wording of the motion.");
  const members = new Set((await meetingMembers(meetingId)).map((p) => p.id));
  const movedById = field(form, "movedById");
  const secondedById = field(form, "secondedById");
  for (const id of [movedById, secondedById]) if (id && !members.has(id)) fail(back, "The mover and seconder must be members of this body.");
  if (movedById && movedById === secondedById) fail(back, "A member can't second their own motion.");
  const reqRaw = field(form, "requiredVotes");
  const requiredVotes = reqRaw ? Number(reqRaw) : null;
  if (requiredVotes !== null && (!Number.isInteger(requiredVotes) || requiredVotes < 1)) fail(back, "Votes required must be a whole number.");
  const motion = await prisma.$transaction(async (tx) => {
    const mo = await tx.motion.create({ data: { agendaItemId, text: text!, movedById, secondedById, requiredVotes } });
    await audit(user, { action: "motion.add", entityType: "Meeting", entityId: meetingId, summary: `Recorded a motion on “${item.title}”` }, tx);
    return mo;
  });
  done(back + `#motion-${motion.id}`, "Motion recorded. Now take the roll call.");
}

/**
 * Saves the roll call for a motion and sets its result from the tally, unless
 * the clerk marks it tabled or withdrawn.
 */
export async function recordVotes(form: FormData) {
  const user = await requireUser();
  const motionId = field(form, "motionId") ?? "";
  const motion = await prisma.motion.findUnique({ where: { id: motionId }, include: { agendaItem: true } });
  if (!motion) fail("/admin", "That motion no longer exists.");
  const meetingId = motion.agendaItem.meetingId;
  const back = `/admin/meetings/${meetingId}?tab=record`;
  await recordableMeeting(meetingId, back);
  const members = await meetingMembers(meetingId);
  const outcome = field(form, "outcome");
  const votes = members
    .map((p) => ({ personId: p.id, choice: field(form, `vote-${p.id}`) as VoteChoice | null }))
    .filter((v) => v.choice);
  if (votes.some((v) => !CHOICES.includes(v.choice!))) fail(back, "Unrecognized vote.");
  if (outcome !== "TABLED" && outcome !== "WITHDRAWN" && votes.length !== members.length) {
    fail(back + `#motion-${motionId}`, "Record a vote (or absent) for every member.");
  }
  const t = tally(votes as { choice: VoteChoice }[], motion.requiredVotes);
  const result: MotionResult = outcome === "TABLED" || outcome === "WITHDRAWN" ? outcome : t.passes ? "PASSED" : "FAILED";
  await prisma.$transaction(async (tx) => {
    await tx.voteRecord.deleteMany({ where: { motionId } });
    if (votes.length) await tx.voteRecord.createMany({ data: votes.map((v) => ({ motionId, personId: v.personId, choice: v.choice! })) });
    await tx.motion.update({ where: { id: motionId }, data: { result } });
    await audit(user, {
      action: "vote.record",
      entityType: "Meeting",
      entityId: meetingId,
      summary: `Recorded vote on “${motion.agendaItem.title}”: ${result.toLowerCase()}${votes.length ? ` ${t.yes}–${t.no}` : ""}`,
      data: { motionId, votes: votes.map((v) => [v.personId, v.choice]) },
    }, tx);
  });
  revalidatePath(`/meetings/${meetingId}`);
  done(back + `#motion-${motionId}`, `Vote recorded: motion ${result.toLowerCase()}.`);
}

export async function deleteMotion(form: FormData) {
  const user = await requireUser();
  const motionId = field(form, "motionId") ?? "";
  const motion = await prisma.motion.findUnique({ where: { id: motionId }, include: { agendaItem: true } });
  if (!motion) fail("/admin", "That motion no longer exists.");
  const meetingId = motion.agendaItem.meetingId;
  const back = `/admin/meetings/${meetingId}?tab=record`;
  await recordableMeeting(meetingId, back);
  await prisma.$transaction(async (tx) => {
    await tx.motion.delete({ where: { id: motionId } });
    await audit(user, { action: "motion.delete", entityType: "Meeting", entityId: meetingId, summary: `Deleted a motion on “${motion.agendaItem.title}”`, data: { text: motion.text } }, tx);
  });
  revalidatePath(`/meetings/${meetingId}`);
  done(back, "Motion deleted.");
}

export async function saveMinutes(form: FormData) {
  const user = await requireUser();
  const meetingId = field(form, "meetingId") ?? "";
  const back = `/admin/meetings/${meetingId}?tab=minutes`;
  const m = await prisma.meeting.findUnique({ where: { id: meetingId }, include: { minutes: true } });
  if (!m) fail("/admin", "That meeting no longer exists.");
  if (m.status !== "ADJOURNED") fail(back, "Minutes can be written once the meeting is adjourned.");
  if (m.minutes?.status === "APPROVED") fail(back, "Approved minutes can't be edited.");
  const body = field(form, "body");
  if (!body) fail(back, "The minutes are empty.");
  if (body.length > 100_000) fail(back, "The minutes are too long to save.");
  await prisma.$transaction(async (tx) => {
    await tx.minutes.upsert({ where: { meetingId }, create: { meetingId, body: body! }, update: { body: body! } });
    await audit(user, { action: "minutes.save", entityType: "Meeting", entityId: meetingId, summary: "Saved draft minutes" }, tx);
  });
  done(back, "Draft minutes saved. They stay private until approved.");
}

export async function approveMinutes(form: FormData) {
  const user = await requireUser();
  const meetingId = field(form, "meetingId") ?? "";
  const back = `/admin/meetings/${meetingId}?tab=minutes`;
  const m = await prisma.meeting.findUnique({ where: { id: meetingId }, include: { minutes: true } });
  if (!m) fail("/admin", "That meeting no longer exists.");
  if (!m.minutes) fail(back, "Save the draft minutes first.");
  if (m.minutes.status === "APPROVED") fail(back, "These minutes are already approved.");
  const approvedAtMeetingId = field(form, "approvedAtMeetingId");
  if (approvedAtMeetingId) {
    const later = await prisma.meeting.findFirst({
      where: { id: approvedAtMeetingId, bodyId: m.bodyId, startsAt: { gt: m.startsAt } },
    });
    if (!later) fail(back, "Choose a later meeting of the same body.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.minutes.update({
      where: { meetingId },
      data: { status: "APPROVED", approvedAt: new Date(), approvedAtMeetingId },
    });
    await audit(user, { action: "minutes.approve", entityType: "Meeting", entityId: meetingId, summary: "Approved the minutes and published them" }, tx);
  });
  revalidatePath("/", "layout");
  done(back, "Minutes approved and published.");
}

export async function reviewComment(form: FormData) {
  const user = await requireUser();
  const commentId = field(form, "commentId") ?? "";
  const decision = field(form, "decision");
  const c = await prisma.publicComment.findUnique({ where: { id: commentId } });
  if (!c) fail("/admin", "That comment no longer exists.");
  const back = `/admin/meetings/${c.meetingId}?tab=comments`;
  if (decision !== "ACCEPTED" && decision !== "REJECTED") fail(back, "Choose accept or reject.");
  await prisma.$transaction(async (tx) => {
    await tx.publicComment.update({ where: { id: commentId }, data: { status: decision, reviewedAt: new Date() } });
    await audit(user, {
      action: decision === "ACCEPTED" ? "comment.accept" : "comment.reject",
      entityType: "Meeting",
      entityId: c.meetingId,
      summary: `${decision === "ACCEPTED" ? "Accepted" : "Rejected"} a written comment from ${c.name}`,
    }, tx);
  });
  revalidatePath(`/meetings/${c.meetingId}`);
  done(back, decision === "ACCEPTED" ? "Comment accepted into the public record." : "Comment rejected.");
}
