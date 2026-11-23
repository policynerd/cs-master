import Link from "next/link";
import { getOrganization, listBodies, listMeetings } from "@/lib/public";
import { MeetingRow } from "@/components/meeting-bits";
import { formatShortDate, meetingTitle } from "@/lib/format";
import { vacancyCount } from "@/lib/seats";

export default async function Home() {
  const now = new Date();
  const org = await getOrganization();
  const [upcoming, recent, bodies] = await Promise.all([
    listMeetings({ when: "upcoming", take: 6, now, tz: org.timezone }),
    listMeetings({ when: "past", take: 8, now, tz: org.timezone }),
    listBodies(),
  ]);
  const withMinutes = recent.filter((m) => m.minutes?.status === "APPROVED").slice(0, 4);
  const vacancies = bodies
    .map((b) => ({ ...b, open: vacancyCount(b, b.seats, now) }))
    .filter((b) => b.open > 0);

  return (
    <div className="wrap">
      <div className="page-head">
        <span className="eyebrow">Office of the Clerk</span>
        <h1>Meetings, agendas and the public record</h1>
        <p>
          Find upcoming meetings of the {org.name} council, boards and commissions, read agendas and supporting
          documents, see how members voted, and submit written comment before a meeting.
        </p>
      </div>

      <div className="grid-2">
        <section aria-labelledby="upcoming-h">
          <h2 id="upcoming-h" className="section-title">
            Upcoming meetings
          </h2>
          {upcoming.length ? (
            <ul className="meeting-list">
              {upcoming.map((m) => (
                <MeetingRow key={m.id} m={m} tz={org.timezone} now={now} />
              ))}
            </ul>
          ) : (
            <p className="empty">No meetings are scheduled yet.</p>
          )}
          <p>
            <Link href="/meetings">All meetings →</Link>
          </p>
        </section>

        <aside className="stack" aria-label="The record">
          <section className="panel" aria-labelledby="minutes-h">
            <h2 id="minutes-h">Recently approved minutes</h2>
            {withMinutes.length ? (
              <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {withMinutes.map((m) => (
                  <li key={m.id}>
                    <Link href={`/meetings/${m.id}#minutes`}>{meetingTitle(m)}</Link>
                    <div className="muted num" style={{ fontSize: "0.88rem" }}>
                      {formatShortDate(m.startsAt, org.timezone)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No approved minutes yet.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="vacancies-h">
            <h2 id="vacancies-h">Open seats</h2>
            {vacancies.length ? (
              <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {vacancies.map((b) => (
                  <li key={b.id}>
                    <Link href={`/bodies/${b.slug}`}>{b.name}</Link>
                    <div className="muted" style={{ fontSize: "0.88rem" }}>
                      {b.open} of {b.seatCount} seats vacant
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Every seat is currently filled.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
