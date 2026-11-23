"use server";

import type { AgendaItemKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { done, fail, field, safeUrl } from "@/lib/flash";
import { SECTION_ORDER, type Section } from "@/lib/agenda";

const KINDS: AgendaItemKind[] = ["ACTION", "DISCUSSION", "INFORMATION", "CEREMONIAL"];

function readItem(form: FormData, back: string) {
  const section = field(form, "section") as Section | null;
  const kind = (field(form, "kind") ?? "ACTION") as AgendaItemKind;
  const title = field(form, "title");
  if (!section || !SECTION_ORDER.includes(section)) fail(back, "Choose an agenda section.");
  if (!KINDS.includes(kind)) fail(back, "Choose an item type.");
  if (!title) fail(back, "Give the item a title.");
  if (title.length > 500) fail(back, "Keep the title under 500 characters.");
  const isConfidential = form.get("isConfidential") === "on";
  const legalCitation = field(form, "legalCitation");
  if (isConfidential && !legalCitation) {
    fail(back, "Closed-session items need the legal authority for meeting in private (for example, the statute section).");
  }
  return {
    section: section!,
    kind,
    title: title!,
    summary: field(form, "summary"),
    recommendedAction: field(form, "recommendedAction"),
    fiscalImpact: field(form, "fiscalImpact"),
    presenter: field(form, "presenter"),
    department: field(form, "department"),
    isConfidential,
    legalCitation,
  };
}

/** Loads a meeting the workspace may still edit, or bounces back with a reason. */
async function editableMeeting(meetingId: string, back: string) {
  const m = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!m) fail("/admin", "That meeting no longer exists.");
  if (m.status === "CANCELLED" || m.status === "ADJOURNED") {
    fail(back, "The agenda of a cancelled or adjourned meeting is part of the record and can't be changed.");
  }
  return m;
}

function after(meetingId: string) {
  revalidatePath(`/meetings/${meetingId}`);
  return `/admin/meetings/${meetingId}?tab=agenda`;
}

export async function addAgendaItem(form: FormData) {
  const user = await requireUser();
  const meetingId = field(form, "meetingId") ?? "";
  const back = `/admin/meetings/${meetingId}?tab=agenda`;
  const m = await editableMeeting(meetingId, back);
  const data = readItem(form, back);
  await prisma.$transaction(async (tx) => {
    const last = await tx.agendaItem.findFirst({
      where: { meetingId, section: data.section },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const item = await tx.agendaItem.create({ data: { ...data, meetingId, position: (last?.position ?? 0) + 1 } });
    await audit(user, {
      action: "agenda.item.add",
      entityType: "Meeting",
      entityId: meetingId,
      summary: `Added agenda item “${item.title}”${m.agendaPublishedAt ? " after publication" : ""}`,
    }, tx);
  });
  done(after(meetingId) + "#add", m.agendaPublishedAt ? "Item added. The published agenda now shows it." : "Item added.");
}

export async function updateAgendaItem(form: FormData) {
  const user = await requireUser();
  const itemId = field(form, "itemId") ?? "";
  const item = await prisma.agendaItem.findUnique({ where: { id: itemId } });
  if (!item) fail("/admin", "That agenda item no longer exists.");
  const back = `/admin/meetings/${item.meetingId}?tab=agenda&edit=${itemId}`;
  const m = await editableMeeting(item.meetingId, back);
  const data = readItem(form, back);
  await prisma.$transaction(async (tx) => {
    let position = item.position;
    if (data.section !== item.section) {
      const last = await tx.agendaItem.findFirst({
        where: { meetingId: item.meetingId, section: data.section },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      position = (last?.position ?? 0) + 1;
    }
    await tx.agendaItem.update({ where: { id: itemId }, data: { ...data, position } });
    await audit(user, {
      action: "agenda.item.update",
      entityType: "Meeting",
      entityId: item.meetingId,
      summary: `Edited agenda item “${data.title}”${m.agendaPublishedAt ? " after publication" : ""}`,
    }, tx);
  });
  done(after(item.meetingId) + `#item-${itemId}`, "Item saved.");
}

export async function deleteAgendaItem(form: FormData) {
  const user = await requireUser();
  const itemId = field(form, "itemId") ?? "";
  const item = await prisma.agendaItem.findUnique({ where: { id: itemId }, include: { _count: { select: { motions: true } } } });
  if (!item) fail("/admin", "That agenda item no longer exists.");
  const back = `/admin/meetings/${item.meetingId}?tab=agenda`;
  await editableMeeting(item.meetingId, back);
  if (item._count.motions > 0) fail(back, "This item has recorded motions. Delete the motions first.");
  await prisma.$transaction(async (tx) => {
    await tx.agendaItem.delete({ where: { id: itemId } });
    await audit(user, { action: "agenda.item.delete", entityType: "Meeting", entityId: item.meetingId, summary: `Removed agenda item “${item.title}”` }, tx);
  });
  done(after(item.meetingId), "Item removed.");
}

/** Moves an item one place up or down within its section. */
export async function moveAgendaItem(form: FormData) {
  const user = await requireUser();
  const itemId = field(form, "itemId") ?? "";
  const dir = field(form, "dir");
  const item = await prisma.agendaItem.findUnique({ where: { id: itemId } });
  if (!item) fail("/admin", "That agenda item no longer exists.");
  const back = `/admin/meetings/${item.meetingId}?tab=agenda`;
  await editableMeeting(item.meetingId, back);
  const neighbor = await prisma.agendaItem.findFirst({
    where: {
      meetingId: item.meetingId,
      section: item.section,
      position: dir === "up" ? { lt: item.position } : { gt: item.position },
    },
    orderBy: { position: dir === "up" ? "desc" : "asc" },
  });
  if (!neighbor) done(back + `#item-${itemId}`, "Already in place.");
  await prisma.$transaction(async (tx) => {
    await tx.agendaItem.update({ where: { id: item.id }, data: { position: neighbor.position } });
    await tx.agendaItem.update({ where: { id: neighbor.id }, data: { position: item.position } });
    await audit(user, { action: "agenda.item.move", entityType: "Meeting", entityId: item.meetingId, summary: `Moved “${item.title}” ${dir === "up" ? "up" : "down"}` }, tx);
  });
  done(after(item.meetingId) + `#item-${itemId}`, "Order updated.");
}

export async function addAttachment(form: FormData) {
  const user = await requireUser();
  const itemId = field(form, "itemId") ?? "";
  const item = await prisma.agendaItem.findUnique({ where: { id: itemId } });
  if (!item) fail("/admin", "That agenda item no longer exists.");
  const back = `/admin/meetings/${item.meetingId}?tab=agenda&edit=${itemId}`;
  await editableMeeting(item.meetingId, back);
  const title = field(form, "title");
  const url = safeUrl(field(form, "url"));
  if (!title) fail(back, "Give the document a title.");
  if (!url) fail(back, "Enter the document's full web address, starting with https://.");
  const isPublic = form.get("isPublic") === "on";
  await prisma.$transaction(async (tx) => {
    await tx.attachment.create({ data: { agendaItemId: itemId, title: title!, url, isPublic } });
    await audit(user, {
      action: "agenda.attachment.add",
      entityType: "Meeting",
      entityId: item.meetingId,
      summary: `Attached “${title}” to “${item.title}”${isPublic ? "" : " (staff only)"}`,
    }, tx);
  });
  done(after(item.meetingId).replace("?tab=agenda", `?tab=agenda&edit=${itemId}`) + `#item-${itemId}`, "Document attached.");
}

export async function deleteAttachment(form: FormData) {
  const user = await requireUser();
  const attachmentId = field(form, "attachmentId") ?? "";
  const a = await prisma.attachment.findUnique({ where: { id: attachmentId }, include: { agendaItem: true } });
  if (!a) fail("/admin", "That document no longer exists.");
  const meetingId = a.agendaItem.meetingId;
  const back = `/admin/meetings/${meetingId}?tab=agenda&edit=${a.agendaItemId}`;
  await editableMeeting(meetingId, back);
  await prisma.$transaction(async (tx) => {
    await tx.attachment.delete({ where: { id: attachmentId } });
    await audit(user, { action: "agenda.attachment.delete", entityType: "Meeting", entityId: meetingId, summary: `Removed document “${a.title}”` }, tx);
  });
  done(back + `#item-${a.agendaItemId}`, "Document removed.");
}
