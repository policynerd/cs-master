import Link from "next/link";
import { dateParts, formatTime, MEETING_TYPE_LABELS, meetingTitle } from "@/lib/format";

export function DateLeaf({ date, tz, accent }: { date: Date; tz: string; accent?: string }) {
  const p = dateParts(date, tz);
  return (
    <div className="leaf" data-accent={accent} aria-hidden="true">
      <span className="leaf-month">{p.month}</span>
      <span className="leaf-day">{p.day}</span>
      <span className="leaf-wd">{p.weekday}</span>
    </div>
  );
}

export function BodyTag({ body }: { body: { slug: string; name: string; accent: string } }) {
  return (
    <Link href={`/bodies/${body.slug}`} className="tag" data-accent={body.accent}>
      {body.name}
    </Link>
  );
}

type MeetingSummary = {
  id: string;
  title: string | null;
  type: string;
  status: string;
  startsAt: Date;
  location: string | null;
  livestreamUrl: string | null;
  agendaPublishedAt: Date | null;
  cancelledReason: string | null;
  body: { slug: string; name: string; accent: string };
  minutes: { status: string } | null;
};

export function MeetingStatus({ m, now }: { m: MeetingSummary; now: Date }) {
  if (m.status === "CANCELLED") return <span className="pill pill-bad">Cancelled</span>;
  if (m.status === "IN_PROGRESS") return <span className="pill pill-ok">In session</span>;
  if (m.startsAt > now) {
    return m.agendaPublishedAt && m.agendaPublishedAt <= now ? (
      <span className="pill pill-ok">Agenda posted</span>
    ) : (
      <span className="pill pill-neutral">Agenda pending</span>
    );
  }
  return m.minutes?.status === "APPROVED" ? (
    <span className="pill pill-ok">Minutes approved</span>
  ) : (
    <span className="pill pill-warn">Minutes pending</span>
  );
}

export function MeetingRow({ m, tz, now }: { m: MeetingSummary; tz: string; now: Date }) {
  const cancelled = m.status === "CANCELLED";
  return (
    <li className={`meeting-row${cancelled ? " cancelled" : ""}`}>
      <DateLeaf date={m.startsAt} tz={tz} accent={m.body.accent} />
      <div className="meeting-row-main">
        <Link href={`/meetings/${m.id}`} className="meeting-row-title">
          {meetingTitle(m)}
        </Link>
        <div className="meeting-row-meta">
          <span className="num">{formatTime(m.startsAt, tz)}</span>
          {m.location && <span>{m.location}</span>}
          <span>{MEETING_TYPE_LABELS[m.type]}</span>
        </div>
        <div className="meeting-row-links">
          <BodyTag body={m.body} />
          <MeetingStatus m={m} now={now} />
        </div>
        {cancelled && m.cancelledReason && <span className="muted">{m.cancelledReason}</span>}
      </div>
    </li>
  );
}
