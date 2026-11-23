import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getOrganization } from "@/lib/public";
import { Flash } from "@/components/flash";
import { inviteUser, updateUser } from "../_actions/users";

export const metadata: Metadata = { title: "Staff access" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser("ADMIN");
  const sp = await searchParams;
  const [org, users] = await Promise.all([getOrganization(), prisma.user.findMany({ orderBy: [{ isActive: "desc" }, { email: "asc" }] })]);
  return (
    <div className="wrap">
      <div className="page-head">
        <span className="eyebrow">Clerk workspace</span>
        <h1>Staff access</h1>
        <p>Only people listed here can sign in. Clerks manage meetings; admins also manage this list.</p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid-2">
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Last sign-in</th>
                <th scope="col">Access</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={u.isActive ? undefined : { opacity: 0.7 }}>
                  <td>
                    {u.name ?? "—"}
                    <div className="muted" style={{ fontSize: "0.88rem", overflowWrap: "anywhere" }}>
                      {u.email}
                    </div>
                  </td>
                  <td className="num">{u.lastLoginAt ? formatDateTime(u.lastLoginAt, org.timezone).replace(/^\w+, /, "") : "Never"}</td>
                  <td>
                    <form action={updateUser} className="row-actions">
                      <input type="hidden" name="userId" value={u.id} />
                      <label className="sr-only" htmlFor={`role-${u.id}`}>
                        Role for {u.email}
                      </label>
                      <select id={`role-${u.id}`} name="role" defaultValue={u.role} disabled={u.id === me.id}>
                        <option value="CLERK">Clerk</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <label className="sr-only" htmlFor={`active-${u.id}`}>
                        Status for {u.email}
                      </label>
                      <select id={`active-${u.id}`} name="isActive" defaultValue={String(u.isActive)} disabled={u.id === me.id}>
                        <option value="true">Active</option>
                        <option value="false">Deactivated</option>
                      </select>
                      {u.id === me.id ? (
                        <span className="muted">You</span>
                      ) : (
                        <button className="btn btn-quiet btn-sm" type="submit">
                          Save
                        </button>
                      )}
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="panel">
          <h2>Add a staff member</h2>
          <form action={inviteUser} className="form">
            <div className="field">
              <label htmlFor="email">Work email</label>
              <span className="hint" id="email-hint">
                Must match the account they sign in with.
              </span>
              <input id="email" name="email" type="email" required aria-describedby="email-hint" />
            </div>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" />
            </div>
            <div className="field">
              <label htmlFor="role">Role</label>
              <select id="role" name="role" defaultValue="CLERK">
                <option value="CLERK">Clerk</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <button className="btn" type="submit">
                Give access
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
