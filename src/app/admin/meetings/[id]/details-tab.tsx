import { prisma } from "@/lib/db";
import type { WorkspaceMeeting } from "@/lib/admin-data";
import { formatDateTime } from "@/lib/format";
import { noticeStatus } from "@/lib/notice";
import type { getOrganization } from "@/lib/public";
import { utcToZonedInput } from "@/lib/zoned";
import { cancelMeeting, postNotice, updateMeeting } from "../../_actions/meetings";
import { MeetingFields } from "../../meeting-fields";

type Org = Awaited<ReturnType<typeof getOrganization>>;

export async function DetailsTab({ m, org, now }: { m: WorkspaceMeeting; org: Org; now: Date }) {
  const bodies = await prisma.body.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const ns = noticeStatus(m, org, now);
  const tz = org.timezone;
  const cancellable = m.status !== "CANCELLED" && m.status !== "ADJOURNED";

  return (
    <div className="grid-2">
      <form action={updateMeeting} className="panel form">
        <h2>Meeting details</h2>
        <input type="hidden" name="meetingId" value={m.id} />
        <MeetingFields
          bodies={bodies}
          tz={tz}
          lockTime={Boolean(m.noticePostedAt)}
          values={{ ...m, startsAt: utcToZonedInput(m.startsAt, tz) }}
        />
        <div>
          <button className="btn" type="submit" disabled={m.status === "CANCELLED"}>
            Save details
          </button>
        </div>
      </form>

      <div className="stack">
        <section className="panel">
          <h2>Public notice</h2>
          <dl className="facts">
            <dt>Required</dt>
            <dd>{ns.requiredHours} hours before the meeting</dd>
            <dt>Deadline</dt>
            <dd>{formatDateTime(ns.deadline, tz)}</dd>
            <dt>Posted</dt>
            <dd>{m.noticePostedAt ? formatDateTime(m.noticePostedAt, tz) : "Not yet"}</dd>
            <dt>Agenda</dt>
            <dd>{m.agendaPublishedAt ? `Published ${formatDateTime(m.agendaPublishedAt, tz)}` : "Not published"}</dd>
          </dl>
          {m.status === "DRAFT" && (
            <form action={postNotice} style={{ marginTop: 14 }}>
              <input type="hidden" name="meetingId" value={m.id} />
              <p className="muted" style={{ marginTop: 0 }}>
                Posting notice puts the meeting on the public calendar with its time and place. You can publish the agenda later,
                before the deadline.
              </p>
              <button className="btn" type="submit">
                Post notice now
              </button>
            </form>
          )}
          {ns.state === "missed" && m.status === "DRAFT" && (
            <p className="flash flash-error" style={{ marginTop: 14, marginBottom: 0 }}>
              The notice deadline has passed. Reschedule this meeting, or change its type if your rules allow a special or emergency
              meeting.
            </p>
          )}
        </section>

        {cancellable && (
          <section className="panel">
            <h2>Cancel meeting</h2>
            <details className="disclose">
              <summary>Cancel this meeting…</summary>
              <form action={cancelMeeting} className="form">
                <input type="hidden" name="meetingId" value={m.id} />
                <div className="field">
                  <label htmlFor="reason">Reason (shown to the public)</label>
                  <textarea id="reason" name="reason" required style={{ minHeight: 80 }} />
                </div>
                <div>
                  <button className="btn btn-danger" type="submit">
                    Cancel meeting
                  </button>
                </div>
              </form>
            </details>
          </section>
        )}
        {m.status === "CANCELLED" && (
          <section className="panel notice">
            <h2>Cancelled</h2>
            <p style={{ margin: 0 }}>{m.cancelledReason}</p>
          </section>
        )}
      </div>
    </div>
  );
}
