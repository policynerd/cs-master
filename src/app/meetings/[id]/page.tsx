import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMeeting, getOrganization, type PublicMeeting } from "@/lib/public";
import { numberAgenda, SECTION_NOTES } from "@/lib/agenda";
import { noticeStatus } from "@/lib/notice";
import { quorumFor } from "@/lib/seats";
import { tally, tallyLabel } from "@/lib/votes";
import {
  formatDate,
  formatDateTime,
  formatTime,
  MEETING_TYPE_LABELS,
  meetingTitle,
  personName,
  VOTE_LABELS,
} from "@/lib/format";
import { BodyTag, DateLeaf } from "@/components/meeting-bits";
import { MinutesText } from "@/components/minutes-text";
import { CommentForm } from "./comment-form";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const m = await getMeeting(id);
  return { title: m ? meetingTitle(m) : "Meeting not found" };
}

export default async function MeetingPage({ params }: { params: Params }) {
  const { id } = await params;
  const now = new Date();
  const [org, m] = await Promise.all([getOrganization(), getMeeting(id, now)]);
  if (!m) notFound();

  const tz = org.timezone;
  const upcoming = m.startsAt > now;
  const cancelled = m.status === "CANCELLED";
  const notice = noticeStatus(m, org, now);
  const agenda = numberAgenda(m.agendaItems);
  const itemNumber = new Map(agenda.flatMap((s) => s.items.map((i) => [i.id, i.number] as const)));
  const canComment = !cancelled && upcoming && m.status === "SCHEDULED" && m.agendaIsPublic;
  const commentableItems = agenda.flatMap((s) =>
    s.items.filter((i) => !i.isConfidential && i.kind !== "CEREMONIAL").map((i) => ({ id: i.id, label: `${i.number}. ${i.title}` })),
  );

  return (
    <div data-accent={m.body.accent}>
      <section className="meeting-hero">
        <div className="wrap">
          <DateLeaf date={m.startsAt} tz={tz} accent={m.body.accent} />
          <div className="meeting-hero-main">
            <div className="meeting-row-links">
              <BodyTag body={m.body} />
              <span className="pill pill-neutral">{MEETING_TYPE_LABELS[m.type]}</span>
              {cancelled && <span className="pill pill-bad">Cancelled</span>}
            </div>
            <h1>{meetingTitle(m)}</h1>
            <p className="num" style={{ margin: 0, fontSize: "1.05rem" }}>
              {formatDate(m.startsAt, tz)} · {formatTime(m.startsAt, tz)}
              {m.location ? ` · ${m.location}` : ""}
            </p>
            {cancelled && m.cancelledReason && <p className="notice">{m.cancelledReason}</p>}
            <div className="actions no-print">
              {m.livestreamUrl && !cancelled && upcoming && (
                <a className="btn" href={m.livestreamUrl} target="_blank" rel="noreferrer">
                  Watch live
                </a>
              )}
              {m.recordingUrl && (
                <a className="btn" href={m.recordingUrl} target="_blank" rel="noreferrer">
                  Watch recording
                </a>
              )}
              {m.virtualUrl && !cancelled && upcoming && (
                <a className="btn btn-quiet" href={m.virtualUrl} target="_blank" rel="noreferrer">
                  Join remotely
                </a>
              )}
              {canComment && (
                <a className="btn btn-quiet" href="#comment">
                  Submit a written comment
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="wrap grid-2">
        <div className="stack" style={{ gap: 40 }}>
          <section aria-labelledby="agenda-h">
            <h2 id="agenda-h" className="section-title">
              Agenda
            </h2>
            {m.agendaIsPublic ? (
              <Agenda agenda={agenda} />
            ) : (
              <p className="empty">
                The agenda has not been posted yet. It will appear here no later than the legal notice deadline,{" "}
                {formatDateTime(notice.deadline, tz)}.
              </p>
            )}
          </section>

          {m.minutes && (
            <section id="minutes" aria-labelledby="minutes-h">
              <h2 id="minutes-h" className="section-title">
                Minutes
              </h2>
              {m.minutes.approvedAt && (
                <p className="muted" style={{ marginTop: 0 }}>
                  Approved {formatDate(m.minutes.approvedAt, tz)}
                </p>
              )}
              <MinutesText source={m.minutes.body} />
            </section>
          )}

          {m.publicComments.length > 0 && (
            <section aria-labelledby="comments-h">
              <h2 id="comments-h" className="section-title">
                Written public comment
              </h2>
              {m.publicComments.map((c) => (
                <article key={c.id} className="comment">
                  <strong>{c.name}</strong>
                  {c.city ? <span className="muted">, {c.city}</span> : null}
                  <span className="muted">
                    {" "}
                    · {c.position.charAt(0) + c.position.slice(1).toLowerCase()}
                    {c.agendaItemId && itemNumber.get(c.agendaItemId) ? ` · Item ${itemNumber.get(c.agendaItemId)}` : ""}
                  </span>
                  <p>{c.body}</p>
                </article>
              ))}
            </section>
          )}

          {canComment && (
            <section id="comment" aria-labelledby="comment-h" className="panel no-print">
              <h2 id="comment-h" style={{ fontSize: "1.3rem", textTransform: "none", letterSpacing: 0, color: "var(--ink)", fontFamily: "var(--font-display)", fontWeight: 400 }}>
                Submit a written comment
              </h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Comments received before the meeting starts are shared with members and become part of the public
                record once reviewed by the Clerk. Your email address is not published.
              </p>
              <CommentForm meetingId={m.id} items={commentableItems} />
            </section>
          )}
        </div>

        <aside className="stack" aria-label="Meeting details">
          <section className="panel">
            <h2>Details</h2>
            <dl className="facts">
              <dt>Date</dt>
              <dd>{formatDate(m.startsAt, tz)}</dd>
              <dt>Time</dt>
              <dd className="num">{formatTime(m.startsAt, tz)}</dd>
              {m.location && (
                <>
                  <dt>Place</dt>
                  <dd>
                    {m.location}
                    {m.address && <div className="muted">{m.address}</div>}
                  </dd>
                </>
              )}
              <dt>Quorum</dt>
              <dd>
                {quorumFor(m.body)} of {m.body.seatCount} members
              </dd>
            </dl>
          </section>

          <NoticePanel m={m} notice={notice} tz={tz} />

          {m.attendance.length > 0 && (
            <section className="panel">
              <h2>Attendance</h2>
              <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 4 }}>
                {m.attendance.map((a) => (
                  <li key={a.person.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>{personName(a.person)}</span>
                    <span className="muted">{a.status.charAt(0) + a.status.slice(1).toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p>
            <Link href={`/meetings?body=${m.body.slug}`}>All {m.body.name} meetings →</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}

function NoticePanel({
  m,
  notice,
  tz,
}: {
  m: PublicMeeting;
  notice: ReturnType<typeof noticeStatus>;
  tz: string;
}) {
  const pill = {
    met: <span className="pill pill-ok">Notice requirement met</span>,
    late: <span className="pill pill-warn">Notice posted late</span>,
    due: <span className="pill pill-neutral">Notice not yet posted</span>,
    missed: <span className="pill pill-bad">Notice not posted</span>,
  }[notice.state];
  return (
    <section className="panel">
      <h2>Public notice</h2>
      <div style={{ marginBottom: 10 }}>{pill}</div>
      <dl className="facts">
        <dt>Required</dt>
        <dd>{notice.requiredHours} hours before the meeting</dd>
        {m.noticePostedAt && (
          <>
            <dt>Posted</dt>
            <dd>{formatDateTime(m.noticePostedAt, tz)}</dd>
          </>
        )}
        {m.agendaPublishedAt && m.agendaIsPublic && (
          <>
            <dt>Agenda</dt>
            <dd>{formatDateTime(m.agendaPublishedAt, tz)}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

function Agenda({ agenda }: { agenda: ReturnType<typeof numberAgenda<PublicMeeting["agendaItems"][number]>> }) {
  if (!agenda.length) return <p className="empty">No items are on this agenda.</p>;
  return (
    <ol className="agenda">
      {agenda.map((s) => (
        <li key={s.section} className="agenda-section">
          <div className="agenda-section-head">
            <span className="agenda-section-num">{s.number}</span>
            <h3 className="agenda-section-title">{s.label}</h3>
          </div>
          {SECTION_NOTES[s.section] && <p className="agenda-section-note">{SECTION_NOTES[s.section]}</p>}
          {/* Single procedural items ("Call to order") read fine from the section title alone. */}
          {!(s.items.length === 1 && s.items[0].kind === "CEREMONIAL" && !s.items[0].summary && !s.items[0].motions.length) && (
            <ol className="agenda-items">
              {s.items.map((item) => (
                <li key={item.id} className="agenda-item">
                  {/* A lone item shares its section's number, so don't print it twice. */}
                  <span className="agenda-item-num">{s.items.length > 1 ? item.number : ""}</span>
                  <div className="agenda-item-body">
                    <h4 className="agenda-item-title">{item.title}</h4>
                    {item.isConfidential && item.legalCitation && <p className="muted">Authority: {item.legalCitation}</p>}
                    {(item.department || item.presenter) && (
                      <p className="muted" style={{ fontSize: "0.9rem" }}>
                        {[item.department, item.presenter].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {item.summary && <p>{item.summary}</p>}
                    {item.recommendedAction && (
                      <p>
                        <span className="label">Recommended action:</span> {item.recommendedAction}
                      </p>
                    )}
                    {item.fiscalImpact && (
                      <p>
                        <span className="label">Fiscal impact:</span> {item.fiscalImpact}
                      </p>
                    )}
                    {item.attachments.length > 0 && (
                      <ul className="attachments">
                        {item.attachments.map((a) => (
                          <li key={a.id}>
                            <a href={a.url} target="_blank" rel="noreferrer">
                              {a.title}
                            </a>
                            {a.sizeBytes ? <span className="muted"> ({formatSize(a.sizeBytes)})</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.motions.map((mo) => {
                      const t = tally(mo.votes, mo.requiredVotes);
                      const resultPill =
                        mo.result === "PASSED" ? "pill-ok" : mo.result === "FAILED" ? "pill-bad" : "pill-neutral";
                      return (
                        <div key={mo.id} className="motion">
                          <div className="motion-head">
                            <span className={`pill ${resultPill}`}>
                              {mo.result.charAt(0) + mo.result.slice(1).toLowerCase()}
                            </span>
                            {mo.votes.length > 0 && <strong className="num">{tallyLabel(t)}</strong>}
                          </div>
                          <span>
                            {mo.text}
                            {mo.movedBy && (
                              <span className="muted">
                                {" "}
                                Moved by {personName(mo.movedBy)}
                                {mo.secondedBy ? `, seconded by ${personName(mo.secondedBy)}` : ""}.
                              </span>
                            )}
                          </span>
                          {mo.votes.length > 0 && (
                            <ul className="votes" aria-label="Roll call">
                              {mo.votes.map((v) => (
                                <li key={v.person.id} className={`v-${v.choice}`}>
                                  {v.person.lastName}: {VOTE_LABELS[v.choice]}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ol>
  );
}

function formatSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}
