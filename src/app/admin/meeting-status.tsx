import { noticeStatus, type NoticeRules } from "@/lib/notice";

type M = {
  status: string;
  type: "REGULAR" | "SPECIAL" | "EMERGENCY" | "WORKSHOP" | "PUBLIC_HEARING";
  startsAt: Date;
  noticePostedAt: Date | null;
  agendaPublishedAt: Date | null;
  minutes: { status: string } | null;
};

/** The one thing a clerk most needs to know about a meeting, as a pill. */
export function WorkspaceStatus({ m, rules, now }: { m: M; rules: NoticeRules; now: Date }) {
  if (m.status === "CANCELLED") return <span className="pill pill-neutral">Cancelled</span>;
  if (m.status === "IN_PROGRESS") return <span className="pill pill-ok">In session</span>;
  if (m.status === "ADJOURNED") {
    if (m.minutes?.status === "APPROVED") return <span className="pill pill-ok">Complete</span>;
    return <span className="pill pill-warn">{m.minutes ? "Minutes in draft" : "Minutes needed"}</span>;
  }
  const ns = noticeStatus(m, rules, now);
  if (m.status === "DRAFT") {
    if (ns.state === "missed") return <span className="pill pill-bad">Notice deadline passed</span>;
    return <span className="pill pill-neutral">Draft</span>;
  }
  if (!m.agendaPublishedAt) {
    return ns.deadline < now ? <span className="pill pill-bad">Agenda late</span> : <span className="pill pill-warn">Agenda not published</span>;
  }
  return <span className="pill pill-ok">Agenda published</span>;
}
