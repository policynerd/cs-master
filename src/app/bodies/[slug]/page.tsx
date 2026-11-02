import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBody, getOrganization, listMeetings } from "@/lib/public";
import { BODY_TYPE_LABELS, formatShortDate, personName, SEAT_ROLE_LABELS } from "@/lib/format";
import { activeVotingSeats, expiringSoon, isSeatActive, quorumFor, vacancyCount } from "@/lib/seats";
import { MeetingRow } from "@/components/meeting-bits";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBody(slug);
  return { title: b?.name ?? "Not found" };
}

export default async function BodyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const now = new Date();
  const [org, body] = await Promise.all([getOrganization(), getBody(slug)]);
  if (!body) notFound();
  const meetings = await listMeetings({ when: "upcoming", bodySlug: slug, take: 5, now, tz: org.timezone });

  const current = body.seats.filter((s) => isSeatActive(s, now));
  const open = vacancyCount(body, body.seats, now);
  const expiring = new Set(expiringSoon(body.seats, 90, now).map((s) => s.id));
  const voting = activeVotingSeats(body.seats, now).length;

  return (
    <div className="wrap" data-accent={body.accent}>
      <div className="page-head">
        <span className="eyebrow">
          {BODY_TYPE_LABELS[body.type]}
          {body.parent && (
            <>
              {" "}
              of the <Link href={`/bodies/${body.parent.slug}`}>{body.parent.name}</Link>
            </>
          )}
        </span>
        <h1>{body.name}</h1>
        {body.description && <p>{body.description}</p>}
      </div>

      <div className="grid-2">
        <div className="stack" style={{ gap: 36 }}>
          <section aria-labelledby="members-h">
            <h2 id="members-h" className="section-title">
              Members
            </h2>
            <div className="roster-wrap">
              <table className="roster">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Role</th>
                    <th scope="col">Seat</th>
                    <th scope="col">Term ends</th>
                  </tr>
                </thead>
                <tbody>
                  {current.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {personName(s.person)}
                        {!s.isVoting && <div className="muted" style={{ fontSize: "0.85rem" }}>Non-voting</div>}
                      </td>
                      <td>{SEAT_ROLE_LABELS[s.role]}</td>
                      <td>{s.seatLabel ?? "—"}</td>
                      <td className="num">
                        {s.termEnd ? formatShortDate(s.termEnd, org.timezone) : "—"}
                        {expiring.has(s.id) && (
                          <div>
                            <span className="pill pill-warn">Expires soon</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {Array.from({ length: open }, (_, i) => (
                    <tr key={`vacant-${i}`} className="vacant">
                      <td>Vacant</td>
                      <td>Member</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="meetings-h">
            <h2 id="meetings-h" className="section-title">
              Upcoming meetings
            </h2>
            {meetings.length ? (
              <ul className="meeting-list">
                {meetings.map((m) => (
                  <MeetingRow key={m.id} m={m} tz={org.timezone} now={now} />
                ))}
              </ul>
            ) : (
              <p className="empty">No upcoming meetings are scheduled.</p>
            )}
            <p>
              <Link href={`/meetings?body=${body.slug}&when=past`}>Past meetings and minutes →</Link>
            </p>
          </section>
        </div>

        <aside className="stack" aria-label="About this body">
          <section className="panel">
            <h2>At a glance</h2>
            <dl className="facts">
              <dt>Seats</dt>
              <dd>{body.seatCount} voting</dd>
              <dt>Filled</dt>
              <dd>{voting}</dd>
              <dt>Vacant</dt>
              <dd>{open}</dd>
              <dt>Quorum</dt>
              <dd>{quorumFor(body)}</dd>
              {body.authority && (
                <>
                  <dt>Created by</dt>
                  <dd>{body.authority}</dd>
                </>
              )}
            </dl>
          </section>
          {body.children.length > 0 && (
            <section className="panel">
              <h2>Committees</h2>
              <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 6 }}>
                {body.children.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/bodies/${c.slug}`}>{c.name}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {open > 0 && (
            <section className="panel notice">
              <h2>Open seats</h2>
              <p style={{ margin: 0 }}>
                This body has {open} vacant {open === 1 ? "seat" : "seats"}. Contact the Office of the Clerk to apply.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
