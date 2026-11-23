/**
 * Staff sign-in for the clerk workspace.
 *
 * - Production: Microsoft Entra ID (Azure AD). Set AZURE_AD_CLIENT_ID,
 *   AZURE_AD_CLIENT_SECRET and AZURE_AD_TENANT_ID.
 * - Development: a password-less "sign in as" form, enabled only when
 *   DEV_LOGIN=true and NODE_ENV is not "production".
 *
 * Either way, sign-in is invite-only: the email must belong to an active row
 * in the User table. The role is read from the database on every request, so
 * deactivating a user or changing their role takes effect immediately.
 */
import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { prisma } from "./db";

export const devLoginEnabled =
  process.env.DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

export const entraEnabled = Boolean(
  process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID,
);

const providers: NextAuthOptions["providers"] = [];
if (entraEnabled) {
  providers.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  );
}
if (devLoginEnabled) {
  providers.push(
    CredentialsProvider({
      id: "dev",
      name: "Development sign-in",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        if (!email) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        return user?.isActive ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;
      const staff = await prisma.user.findUnique({ where: { email } });
      if (!staff?.isActive) return "/signin?error=NotInvited";
      await prisma.user.update({
        where: { id: staff.id },
        data: { lastLoginAt: new Date(), name: staff.name ?? user.name ?? null },
      });
      return true;
    },
    async jwt({ token }) {
      // Keep only the email in the token; role and status come from the DB.
      if (token.email) token.email = token.email.toLowerCase();
      return token;
    },
  },
};

export type StaffUser = { id: string; email: string; name: string | null; role: UserRole };

/** The signed-in, active staff member, or null. */
export async function getCurrentUser(): Promise<StaffUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!user?.isActive) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

const RANK: Record<UserRole, number> = { CLERK: 1, ADMIN: 2 };

export function hasRole(user: StaffUser, min: UserRole): boolean {
  return RANK[user.role] >= RANK[min];
}

/**
 * Use at the top of every workspace page and every server action. Server
 * actions are public HTTP endpoints, so a page-level check alone is not
 * enough.
 */
export async function requireUser(min: UserRole = "CLERK"): Promise<StaffUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!hasRole(user, min)) redirect("/admin?error=" + encodeURIComponent("You don't have permission to do that."));
  return user;
}
