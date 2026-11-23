import { laterMeetingsOfBody, type WorkspaceMeeting } from "@/lib/admin-data";
import { formatDate, formatShortDate, formatTime, MEETING_TYPE_LABELS, meetingTitle } from "@/lib/format";
import { draftMinutes } from "@/lib/minutes";
import type { getOrganization } from "@/lib/public";
import { quorumFor } from "@/lib/seats";
import { MinutesText } from "@/components/minutes-text";
import { approveMinutes, saveMinutes } from "../../_actions/record";

type Org = Awaited<ReturnType<typeof getOrganization>>;

export async function MinutesTab({ m, org }: { m: WorkspaceMeeting; org: Org }) {
  if (m.status !== "ADJOURNED") {
    return <p className="empty">Minutes can be written once the meeting is adjourned.</p>;
  }
  const tz = org.timezone;

  if (m.minutes?.status === "APPROVED") {
    return (
      <section className="panel">
        <h2>Approved {m.minutes.approvedAt ? formatDate(m.minutes.approvedAt, tz) : ""}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Approved minutes are the official record and can&apos;t be edited. They are published on the public meeting page.
        </p>
        <MinutesText source={m.minutes.body} />
      </section>
    );
  }

  const generated = draftMinutes({
    bodyName: m.body.name,
    meetingLabel: MEETING_TYPE_LABELS[m.type],
    dateLabel: formatDate(m.startsAt, tz),
    timeLabel: formatTime(m.startsAt, tz),
    location: m.location,
    quorum: quorumFor(m.body),
    attendance: m.attendance,
    items: m.agendaItems,
  });
  const later = await laterMeetingsOfBody(m.bodyId, m.startsAt);

  return (
    <div className="grid-2">
      <form action={saveMinutes} className="form">
        <input type="hidden" name="meetingId" value={m.id} />
        <div className="field">
          <label htmlFor="body">{m.minutes ? "Draft minutes" : "Draft minutes (generated from the record)"}</label>
          <span className="hint" id="body-hint">
            Separate paragraphs with a blank line. Wrap text in **double asterisks** for bold. Replace each [bracketed] placeholder.
          </span>
          <textarea id="body" name="body" className="minutes-editor" defaultValue={m.minutes?.body ?? generated} aria-describedby="body-hint" />
        </div>
        <div className="row-actions">
          <button className="btn" type="submit">
            Save draft
          </button>
          <span className="muted">Drafts are private.</span>
        </div>
      </form>

      <div className="stack">
        {m.minutes && (
          <section className="panel">
            <h2>Approve</h2>
            {/\[[^\]]+\]/.test(m.minutes.body) && (
              <p className="flash flash-error" style={{ marginTop: 0 }}>
                The draft still has [bracketed] placeholders.
              </p>
            )}
            <form action={approveMinutes} className="form">
              <input type="hidden" name="meetingId" value={m.id} />
              <div className="field">
                <label htmlFor="approvedAtMeetingId">Approved at</label>
                <select id="approvedAtMeetingId" name="approvedAtMeetingId" defaultValue="">
                  <option value="">Not recorded</option>
                  {later.map((l) => (
                    <option key={l.id} value={l.id}>
                      {meetingTitle({ ...l, body: m.body })}, {formatShortDate(l.startsAt, tz)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button className="btn" type="submit">
                  Approve and publish
                </button>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Approval locks the minutes, the attendance and the votes for this meeting.
              </p>
            </form>
          </section>
        )}
        <section className="panel">
          <h2>Preview</h2>
          <MinutesText source={m.minutes?.body ?? generated} />
        </section>
      </div>
    </div>
  );
}
