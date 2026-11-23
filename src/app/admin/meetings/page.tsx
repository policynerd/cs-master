import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listWorkspaceMeetings } from "@/lib/admin-data";
import { formatDateTime, meetingTitle } from "@/lib/format";
import { getOrganization } from "@/lib/public";
import { Flash } from "@/components/flash";
import { WorkspaceStatus } from "../meeting-status";

export const metadata: Metadata = { title: "Meetings" };

export default async function WorkspaceMeetings({ searchParams }: { searchParams: Promise<{ when?: string; ok?: string; error?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const past = sp.when === "past";
  const now = new Date();
  const org = await getOrganization();
  const meetings = await listWorkspaceMeetings(past ? { to: now, order: "desc", take: 200 } : { from: now, take: 200 });
  return (
    <div className="wrap">
      <div className="page-head">
        <span className="eyebrow">Clerk workspace</span>
        <h1>Meetings</h1>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="row-actions" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <nav className="filters" aria-label="Meeting date" style={{ margin: 0 }}>
          <Link className="chip" href="/admin/meetings" aria-current={!past ? "page" : undefined}>
            Upcoming
          </Link>
          <Link className="chip" href="/admin/meetings?when=past" aria-current={past ? "page" : undefined}>
            Past
          </Link>
        </nav>
        <Link href="/admin/meetings/new" className="btn">
          Schedule a meeting
        </Link>
      </div>
      {meetings.length ? (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Meeting</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id}>
                  <td className="num">{formatDateTime(m.startsAt, org.timezone).replace(/^\w+, /, "")}</td>
                  <td>
                    <Link href={`/admin/meetings/${m.id}`}>{meetingTitle(m)}</Link>
                  </td>
                  <td>
                    <WorkspaceStatus m={m} rules={org} now={now} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No {past ? "past" : "upcoming"} meetings.</p>
      )}
    </div>
  );
}
