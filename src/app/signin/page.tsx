import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { devLoginEnabled, entraEnabled, getCurrentUser } from "@/lib/auth";
import { SignInButtons } from "./sign-in-buttons";

export const metadata: Metadata = { title: "Staff sign-in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  NotInvited: "That account doesn't have access to the clerk workspace. Ask an administrator to add you.",
  CredentialsSignin: "That email isn't on the staff list, or the account is deactivated.",
  AccessDenied: "That account doesn't have access to the clerk workspace. Ask an administrator to add you.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <div className="wrap" style={{ maxWidth: "34rem" }}>
      <div className="page-head">
        <span className="eyebrow">Office of the Clerk</span>
        <h1>Staff sign-in</h1>
        <p>The clerk workspace is for staff who prepare meetings, agendas and minutes.</p>
      </div>
      {error && (
        <p className="flash flash-error" role="alert">
          {ERRORS[error] ?? "Sign-in didn't work. Try again, or contact your administrator."}
        </p>
      )}
      {!entraEnabled && !devLoginEnabled ? (
        <p className="empty">
          No sign-in method is configured. Set the Microsoft Entra ID variables described in the README.
        </p>
      ) : (
        <div className="panel">
          <SignInButtons entra={entraEnabled} dev={devLoginEnabled} />
        </div>
      )}
    </div>
  );
}
