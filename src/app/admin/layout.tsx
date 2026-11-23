import type { Metadata } from "next";
import { requireUser, hasRole } from "@/lib/auth";
import { SignOutButton } from "@/app/signin/sign-in-buttons";
import { WorkspaceNav } from "./workspace-nav";

export const metadata: Metadata = { title: { default: "Clerk workspace", template: "%s · Clerk workspace" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <div className="ws-bar" style={{ marginTop: -32, marginBottom: 32 }}>
        <div className="wrap">
          <WorkspaceNav admin={hasRole(user, "ADMIN")} />
          <div className="ws-user">
            <span>
              {user.name ?? user.email} · {user.role === "ADMIN" ? "Admin" : "Clerk"}
            </span>
            <SignOutButton />
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
