import type { Metadata } from "next";
import Link from "next/link";
import { getOrganization, listBodies, listMeetings } from "@/lib/public";
import { MeetingRow } from "@/components/meeting-bits";

export const metadata: Metadata = { title: "Meetings" };

type Search = Promise<{ when?: string; body?: string }>;

export default async function MeetingsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const when = sp.when === "past" ? "past" : "upcoming";
  const bodySlug = sp.body || undefined;
  const now = new Date();
  const org = await getOrganization();
  const [bodies, meetings] = await Promise.all([
    listBodies(),
    listMeetings({ when, bodySlug, take: 100, now, tz: org.timezone }),
  ]);
  const current = bodies.find((b) => b.slug === bodySlug);

  const href = (next: { when?: string; body?: string | undefined }) => {
    const params = new URLSearchParams();
    const w = next.when ?? when;
    const b = "body" in next ? next.body : bodySlug;
    if (w !== "upcoming") params.set("when", w);
    if (b) params.set("body", b);
    const q = params.toString();
    return q ? `/meetings?${q}` : "/meetings";
  };

  return (
    <div className="wrap">
      <div className="page-head">
        <span className="eyebrow">Meetings</span>
        <h1>{current ? current.name : "All meetings"}</h1>
        <p>
          {when === "upcoming"
            ? "Scheduled meetings, soonest first. Agendas are posted before each meeting as required by law."
            : "Past meetings, most recent first, with minutes and recorded votes once approved."}
        </p>
      </div>

      <nav className="filters" aria-label="Meeting date">
        <Link className="chip" href={href({ when: "upcoming" })} aria-current={when === "upcoming" ? "page" : undefined}>
          Upcoming
        </Link>
        <Link className="chip" href={href({ when: "past" })} aria-current={when === "past" ? "page" : undefined}>
          Past
        </Link>
      </nav>
      <nav className="filters" aria-label="Board or commission">
        <Link className="chip" href={href({ body: undefined })} aria-current={!bodySlug ? "page" : undefined}>
          All bodies
        </Link>
        {bodies.map((b) => (
          <Link
            key={b.id}
            className="chip"
            href={href({ body: b.slug })}
            aria-current={bodySlug === b.slug ? "page" : undefined}
          >
            {b.name}
          </Link>
        ))}
      </nav>

      {meetings.length ? (
        <ul className="meeting-list">
          {meetings.map((m) => (
            <MeetingRow key={m.id} m={m} tz={org.timezone} now={now} />
          ))}
        </ul>
      ) : (
        <p className="empty">
          No {when} meetings{current ? ` for the ${current.name}` : ""}.
        </p>
      )}
    </div>
  );
}
