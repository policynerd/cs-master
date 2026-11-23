"use server";

import type { UserRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { done, fail, field } from "@/lib/flash";

const BACK = "/admin/users";
const ROLES: UserRole[] = ["CLERK", "ADMIN"];

export async function inviteUser(form: FormData) {
  const admin = await requireUser("ADMIN");
  const email = field(form, "email")?.toLowerCase();
  const name = field(form, "name");
  const role = (field(form, "role") ?? "CLERK") as UserRole;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(BACK, "Enter a valid work email address.");
  if (!ROLES.includes(role)) fail(BACK, "Choose a role.");
  if (await prisma.user.findUnique({ where: { email } })) fail(BACK, `${email} already has access.`);
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { email: email!, name, role } });
    await audit(admin, { action: "user.invite", entityType: "User", entityId: u.id, summary: `Gave ${email} ${role.toLowerCase()} access` }, tx);
  });
  done(BACK, `${email} can now sign in.`);
}

export async function updateUser(form: FormData) {
  const admin = await requireUser("ADMIN");
  const id = field(form, "userId") ?? "";
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) fail(BACK, "That account no longer exists.");
  const role = (field(form, "role") ?? target.role) as UserRole;
  const isActive = field(form, "isActive") === "true";
  if (!ROLES.includes(role)) fail(BACK, "Choose a role.");
  if (target.id === admin.id && (role !== "ADMIN" || !isActive)) {
    fail(BACK, "You can't remove your own admin access. Ask another admin.");
  }
  if (target.role === "ADMIN" && (role !== "ADMIN" || !isActive)) {
    const admins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (admins <= 1) fail(BACK, "At least one active admin is required.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { role, isActive } });
    await audit(admin, {
      action: "user.update",
      entityType: "User",
      entityId: id,
      summary: `Set ${target.email} to ${role.toLowerCase()}${isActive ? "" : " (deactivated)"}`,
    }, tx);
  });
  done(BACK, `Updated ${target.email}.`);
}
