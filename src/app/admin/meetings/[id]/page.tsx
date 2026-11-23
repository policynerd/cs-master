import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getWorkspaceMeeting } from "@/lib/admin-data";
import { formatDateTime, meetingTitle } from "@/lib/format";
import { getOrganization } from "@/lib/public";
import { Flash } from "@/components/flash";
import { BodyTag } from "@/components/meeting-bits";
import { WorkspaceStatus } from "../../meeting-status";
import { DetailsTab } from "./details-tab";
import { AgendaTab } from "./agenda-tab";
import { RecordTab } from "./record-tab";
import { MinutesTab } from "./minutes-tab";
import { CommentsTab } from "./comments-tab";
import { ActivityTab } from "./activity-tab";

type Params = Promise<{ id: string }>;
type Search = Promise<{ tab?: string; ok?: string; error?: string; edit?: string }>;

const TABS = [
  ["details", "Details & notice"],
  ["agenda", "Agenda"],
  ["record", "Attendance & votes"],
  ["minutes", "Minutes"],
  ["comments", "Public comment"],
  ["activity", "Activity"],
] as const;
type Tab = (typeof TABS)[number][0];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  await requireUser();
  const m = await getWorkspaceMeeting(id);
  return { title: m ? meetingTitle(m) : "Meeting" };
}

export default async function WorkspaceMeetingPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [org, m] = await Promise.all([getOrganization(), getWorkspaceMeeting(id)]);
  if (!m) notFound();
  const now = new Date();
  const tab: Tab = (TABS.find(([k]) => k === sp.tab)?.[0] ?? (m.status === "ADJOURNED" ? "minutes" : "agenda")) as Tab;
  const pending = m.publicComments.filter((c) => c.status === "PENDING").length;

  return (
    <div className="wrap" data-accent={m.body.accent}>
      <div className="page-head">
        <div className="row-actions">
          <BodyTag body={m.body} />
          <WorkspaceStatus m={m} rules={org} now={now} />
        </div>
        <h1>{meetingTitle(m)}</h1>
        <p className="num">
          {formatDateTime(m.startsAt, org.timezone)}
          {m.location ? ` · ${m.location}` : ""}
          {m.status !== "DRAFT" && (
            <>
              {" · "}
              <Link href={`/meetings/${m.id}`} target="_blank">
                View public page
              </Link>
            </>
          )}
        </p>
      </div>

      <nav className="tabs" aria-label="Meeting sections">
        {TABS.map(([key, label]) => (
          <Link key={key} href={`/admin/meetings/${m.id}?tab=${key}`} aria-current={tab === key ? "page" : undefined}>
            {label}
            {key === "comments" && pending > 0 && <span className="count">{pending}</span>}
          </Link>
        ))}
      </nav>

      <Flash ok={sp.ok} error={sp.error} />

      {tab === "details" && <DetailsTab m={m} org={org} now={now} />}
      {tab === "agenda" && <AgendaTab m={m} org={org} now={now} editId={sp.edit} />}
      {tab === "record" && <RecordTab m={m} />}
      {tab === "minutes" && <MinutesTab m={m} org={org} />}
      {tab === "comments" && <CommentsTab m={m} org={org} />}
      {tab === "activity" && <ActivityTab meetingId={m.id} tz={org.timezone} />}
    </div>
  );
}
