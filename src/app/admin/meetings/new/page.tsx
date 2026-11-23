import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrganization } from "@/lib/public";
import { Flash } from "@/components/flash";
import { createMeeting } from "../../_actions/meetings";
import { MeetingFields } from "../../meeting-fields";

export const metadata: Metadata = { title: "Schedule a meeting" };

export default async function NewMeetingPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; body?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const [org, bodies] = await Promise.all([
    getOrganization(),
    prisma.body.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
  ]);
  const preset = bodies.find((b) => b.slug === sp.body)?.id;
  return (
    <div className="wrap" style={{ maxWidth: "52rem" }}>
      <div className="page-head">
        <span className="eyebrow">
          <Link href="/admin/meetings">Meetings</Link>
        </span>
        <h1>Schedule a meeting</h1>
        <p>The meeting starts as a private draft. Nothing appears on the public portal until you post notice.</p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <form action={createMeeting} className="panel form">
        <MeetingFields bodies={bodies} tz={org.timezone} values={{ bodyId: preset }} />
        <div className="row-actions">
          <button className="btn" type="submit">
            Create draft
          </button>
          <Link href="/admin/meetings" className="btn btn-quiet">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
