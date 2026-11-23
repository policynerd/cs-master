import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listWorkspaceMeetings } from "@/lib/admin-data";
import { formatDateTime, formatShortDate, meetingTitle } from "@/lib/format";
import { noticeStatus } from "@/lib/notice";
import { getOrganization } from "@/lib/public";
import { Flash } from "@/components/flash";
import { WorkspaceStatus } from "./meeting-status";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const org = await getOrganization();
  const [upcoming, recent, pendingComments] = await Promise.all([
    listWorkspaceMeetings({ from: new Date(now.getTime() - 12 * 3600_000), take: 20 }),
    listWorkspaceMeetings({ to: now, take: 30, order: "desc" }),
    prisma.publicComment.count({ where: { status: "PENDING" } }),
  ]);

  const live = upcoming.filter((m) => m.status !== "CANCELLED");
  const agendaDue = live.filter((m) => {
    if (m.agendaPublishedAt || m.status === "ADJOURNED" || m.status === "IN_PROGRESS") return false;
    const ns = noticeStatus(m, org, now);
    return ns.deadline.getTime() - now.getTime() < 7 * 86_400_000;
  });
  const minutesDue = recent.filter((m) => m.status === "ADJOURNED" && m.minutes?.status !== "APPROVED");
  const needsAttention = recent.filter((m) => m.startsAt < now && (m.status === "SCHEDULED" || m.status === "IN_PROGRESS"));

  return (
    <div className="wrap">
      <div className="page-head">
        <span className="eyebrow">Clerk workspace</span>
        <h1>Good {greeting(now, org.timezone)}, {user.name?.split(" ")[0] ?? "there"}</h1>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="stat-row">
        <a className={`stat${agendaDue.length ? " attention" : ""}`} href="#upcoming">
          <span className="eyebrow">Agendas due this week</span>
          <strong className="num">{agendaDue.length}</strong>
        </a>
        <a className={`stat${minutesDue.length ? " attention" : ""}`} href="#minutes">
          <span className="eyebrow">Minutes to finish</span>
          <strong className="num">{minutesDue.length}</strong>
        </a>
        <a className={`stat${pendingComments ? " attention" : ""}`} href="#upcoming">
          <span className="eyebrow">Comments to review</span>
          <strong className="num">{pendingComments}</strong>
        </a>
      </div>

      {needsAttention.length > 0 && (
        <section className="panel notice" style={{ marginBottom: 28 }}>
          <h2>Still open</h2>
          <p style={{ margin: "0 0 8px" }}>These meetings have started but aren&apos;t marked adjourned:</p>
          <ul style={{ margin: 0 }}>
            {needsAttention.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/meetings/${m.id}?tab=record`}>{meetingTitle(m)}</Link>, {formatShortDate(m.startsAt, org.timezone)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="upcoming" aria-labelledby="upcoming-h" style={{ marginBottom: 36 }}>
        <div className="row-actions" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2 id="upcoming-h" className="section-title" style={{ margin: 0 }}>
            Upcoming
          </h2>
          <Link href="/admin/meetings/new" className="btn">
            Schedule a meeting
          </Link>
        </div>
        <MeetingTable meetings={upcoming} org={org} now={now} />
      </section>

      <section id="minutes" aria-labelledby="minutes-h">
        <h2 id="minutes-h" className="section-title">
          Minutes to finish
        </h2>
        {minutesDue.length ? <MeetingTable meetings={minutesDue} org={org} now={now} tab="minutes" /> : <p className="empty">All minutes are approved.</p>}
      </section>
    </div>
  );
}

function MeetingTable({
  meetings,
  org,
  now,
  tab,
}: {
  meetings: Awaited<ReturnType<typeof listWorkspaceMeetings>>;
  org: Awaited<ReturnType<typeof getOrganization>>;
  now: Date;
  tab?: string;
}) {
  if (!meetings.length) return <p className="empty">Nothing scheduled.</p>;
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Meeting</th>
            <th scope="col">Status</th>
            <th scope="col">Items</th>
            <th scope="col">Comments</th>
          </tr>
        </thead>
        <tbody>
          {meetings.map((m) => (
            <tr key={m.id}>
              <td className="num">{formatDateTime(m.startsAt, org.timezone).replace(/^\w+, /, "")}</td>
              <td>
                <Link href={`/admin/meetings/${m.id}${tab ? `?tab=${tab}` : ""}`}>{meetingTitle(m)}</Link>
              </td>
              <td>
                <WorkspaceStatus m={m} rules={org} now={now} />
              </td>
              <td className="num">{m._count.agendaItems}</td>
              <td className="num">
                {m._count.publicComments ? (
                  <Link href={`/admin/meetings/${m.id}?tab=comments`}>{m._count.publicComments} pending</Link>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function greeting(now: Date, tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}
