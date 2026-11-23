"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCommentableMeeting } from "@/lib/public";

export type CommentState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "ok" };

const schema = z.object({
  meetingId: z.string().min(1),
  agendaItemId: z.string().optional(),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.email("Enter a valid email address, or leave it blank.").optional()),
  city: z.string().trim().max(120).optional(),
  position: z.enum(["SUPPORT", "OPPOSE", "NEUTRAL"]),
  body: z.string().trim().min(10, "Your comment should be at least 10 characters.").max(5000, "Keep comments under 5,000 characters."),
});

export async function submitComment(_prev: CommentState, form: FormData): Promise<CommentState> {
  // Honeypot: real visitors never see or fill this field.
  if (form.get("website")) return { status: "ok" };

  const parsed = schema.safeParse({
    meetingId: form.get("meetingId"),
    agendaItemId: form.get("agendaItemId") || undefined,
    name: form.get("name") ?? "",
    email: form.get("email") ?? "",
    city: form.get("city") || undefined,
    position: form.get("position") ?? "NEUTRAL",
    body: form.get("body") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = parsed.data;
  const meeting = await getCommentableMeeting(data.meetingId);
  if (!meeting) {
    return { status: "error", message: "This meeting is no longer accepting written comment." };
  }
  if (data.agendaItemId && !meeting.agendaItems.some((i) => i.id === data.agendaItemId)) {
    return { status: "error", message: "Choose an item from this meeting's agenda." };
  }

  await prisma.publicComment.create({
    data: {
      meetingId: meeting.id,
      agendaItemId: data.agendaItemId ?? null,
      name: data.name,
      email: data.email ?? null,
      city: data.city ?? null,
      position: data.position,
      body: data.body,
    },
  });
  return { status: "ok" };
}
