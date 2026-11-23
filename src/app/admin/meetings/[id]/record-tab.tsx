import { meetingMembers, type WorkspaceMeeting } from "@/lib/admin-data";
import { numberAgenda } from "@/lib/agenda";
import { personName, VOTE_LABELS } from "@/lib/format";
import { quorumFor } from "@/lib/seats";
import { tally, tallyLabel } from "@/lib/votes";
import { setMeetingStatus } from "../../_actions/meetings";
import { addMotion, deleteMotion, recordVotes, saveAttendance } from "../../_actions/record";

const ATTENDANCE = [
  ["PRESENT", "Present"],
  ["REMOTE", "Remote"],
  ["LATE", "Late"],
  ["ABSENT", "Absent"],
  ["EXCUSED", "Excused"],
] as const;

export async function RecordTab({ m }: { m: WorkspaceMeeting }) {
  const members = await meetingMembers(m.id);
  const attendance = new Map(m.attendance.map((a) => [a.personId, a.status]));
  const here = m.attendance.filter((a) => !["ABSENT", "EXCUSED"].includes(a.status)).length;
  const quorum = quorumFor(m.body);
  const closed = m.minutes?.status === "APPROVED";
  const open = (m.status === "IN_PROGRESS" || m.status === "ADJOURNED") && !closed;

  if (m.status === "DRAFT" || m.status === "CANCELLED") {
    return <p className="empty">The record opens once the meeting has been noticed and called to order.</p>;
  }

  return (
    <div className="stack" style={{ gap: 28 }}>
      <section className="panel">
        <h2>Session</h2>
        {m.status === "SCHEDULED" && (
          <form action={setMeetingStatus} className="row-actions">
            <input type="hidden" name="meetingId" value={m.id} />
            <input type="hidden" name="status" value="IN_PROGRESS" />
            <span>When the presiding officer opens the meeting:</span>
            <button className="btn" type="submit">
              Call to order
            </button>
          </form>
        )}
        {m.status === "IN_PROGRESS" && (
          <form action={setMeetingStatus} className="row-actions">
            <input type="hidden" name="meetingId" value={m.id} />
            <input type="hidden" name="status" value="ADJOURNED" />
            <span className="pill pill-ok">In session</span>
            <button className="btn btn-quiet" type="submit">
              Adjourn meeting
            </button>
          </form>
        )}
        {m.status === "ADJOURNED" && (
          <p style={{ margin: 0 }}>
            Adjourned. {closed ? "The minutes are approved, so the record is closed." : "You can still correct attendance and votes until the minutes are approved."}
          </p>
        )}
      </section>

      {open && (
        <section id="attendance" className="panel">
          <h2>
            Attendance · <span className={here >= quorum ? "" : "pill pill-bad"}>{here} present, quorum {quorum}</span>
          </h2>
          {members.length === 0 ? (
            <p className="muted">This body has no seated voting members on the meeting date.</p>
          ) : (
            <form action={saveAttendance} className="form">
              <input type="hidden" name="meetingId" value={m.id} />
              <div className="vote-grid">
                {members.map((p) => (
                  <div key={p.id} className="vote-row">
                    <span id={`att-label-${p.id}`}>{personName(p)}</span>
                    <fieldset className="seg" aria-labelledby={`att-label-${p.id}`}>
                      {ATTENDANCE.map(([value, label]) => (
                        <label key={value}>
                          <input
                            type="radio"
                            name={`att-${p.id}`}
                            value={value}
                            required
                            defaultChecked={(attendance.get(p.id) ?? "PRESENT") === value}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </fieldset>
                  </div>
                ))}
              </div>
              <div>
                <button className="btn" type="submit">
                  Save attendance
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <section aria-labelledby="motions-h">
        <h2 id="motions-h" className="section-title">
          Motions and votes
        </h2>
        {numberAgenda(m.agendaItems)
          .flatMap((s) => s.items)
          .filter((i) => i.motions.length > 0)
          .map((item) => (
            <div key={item.id} className="ws-section">
              <h3>
                <span className="n">{item.number}</span>
                {item.title}
              </h3>
              {item.motions.map((mo) => (
                <MotionCard key={mo.id} motion={mo} members={members} open={open} />
              ))}
            </div>
          ))}
        {!m.agendaItems.some((i) => i.motions.length) && <p className="empty">No motions recorded yet.</p>}
      </section>

      {open && m.agendaItems.length > 0 && (
        <section className="panel" id="new-motion">
          <h2>Record a motion</h2>
          <form action={addMotion} className="form">
            <input type="hidden" name="meetingId" value={m.id} />
            <div className="form-grid">
              <div className="field span-2">
                <label htmlFor="agendaItemId">Agenda item</label>
                <select id="agendaItemId" name="agendaItemId" required defaultValue="">
                  <option value="" disabled>
                    Choose…
                  </option>
                  {numberAgenda(m.agendaItems)
                    .flatMap((s) => s.items)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.number}. {i.title}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field span-2">
                <label htmlFor="text">Motion</label>
                <textarea id="text" name="text" required style={{ minHeight: 70 }} placeholder="Approve the consent agenda as presented." />
              </div>
              <PersonSelect id="movedById" label="Moved by" members={members} />
              <PersonSelect id="secondedById" label="Seconded by" members={members} />
              <div className="field">
                <label htmlFor="requiredVotes">Votes required (optional)</label>
                <span className="hint" id="requiredVotes-hint">
                  Only for supermajority or full-body rules. Leave blank for a simple majority of votes cast.
                </span>
                <input id="requiredVotes" name="requiredVotes" type="number" min={1} inputMode="numeric" aria-describedby="requiredVotes-hint" />
              </div>
            </div>
            <div>
              <button className="btn" type="submit">
                Record motion
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

function PersonSelect({ id, label, members }: { id: string; label: string; members: { id: string; firstName: string; lastName: string; honorific: string | null }[] }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={id} defaultValue="">
        <option value="">Not recorded</option>
        {members.map((p) => (
          <option key={p.id} value={p.id}>
            {personName(p)}
          </option>
        ))}
      </select>
    </div>
  );
}

function MotionCard({
  motion,
  members,
  open,
}: {
  motion: WorkspaceMeeting["agendaItems"][number]["motions"][number];
  members: { id: string; firstName: string; lastName: string; honorific: string | null }[];
  open: boolean;
}) {
  const votes = new Map(motion.votes.map((v) => [v.personId, v.choice]));
  const t = tally(motion.votes, motion.requiredVotes);
  const pill = motion.result === "PASSED" ? "pill-ok" : motion.result === "FAILED" ? "pill-bad" : "pill-neutral";
  return (
    <article id={`motion-${motion.id}`} className="motion" style={{ background: "var(--surface)", marginBottom: 10 }}>
      <div className="motion-head">
        <span className={`pill ${pill}`}>{motion.result === "PENDING" ? "Vote not taken" : motion.result.charAt(0) + motion.result.slice(1).toLowerCase()}</span>
        {motion.votes.length > 0 && <strong className="num">{tallyLabel(t)}</strong>}
        {motion.requiredVotes && <span className="muted">needs {motion.requiredVotes}</span>}
      </div>
      <span>
        {motion.text}
        {motion.movedBy && (
          <span className="muted">
            {" "}
            Moved by {personName(motion.movedBy)}
            {motion.secondedBy ? `, seconded by ${personName(motion.secondedBy)}` : ""}.
          </span>
        )}
      </span>
      {open ? (
        <>
          <form action={recordVotes} className="form" style={{ marginTop: 6 }}>
            <input type="hidden" name="motionId" value={motion.id} />
            <div className="vote-grid">
              {members.map((p) => (
                <div key={p.id} className="vote-row">
                  <span id={`v-${motion.id}-${p.id}`}>{personName(p)}</span>
                  <fieldset className="seg" aria-labelledby={`v-${motion.id}-${p.id}`}>
                    {(["YES", "NO", "ABSTAIN", "RECUSED", "ABSENT"] as const).map((c) => (
                      <label key={c}>
                        <input type="radio" name={`vote-${p.id}`} value={c} defaultChecked={votes.get(p.id) === c} />
                        <span>{VOTE_LABELS[c]}</span>
                      </label>
                    ))}
                  </fieldset>
                </div>
              ))}
            </div>
            <div className="row-actions">
              <button className="btn btn-sm" type="submit" name="outcome" value="VOTE">
                Save roll call
              </button>
              <button className="btn btn-quiet btn-sm" type="submit" name="outcome" value="TABLED">
                Mark tabled
              </button>
              <button className="btn btn-quiet btn-sm" type="submit" name="outcome" value="WITHDRAWN">
                Mark withdrawn
              </button>
            </div>
          </form>
          <form action={deleteMotion}>
            <input type="hidden" name="motionId" value={motion.id} />
            <button className="btn btn-danger btn-sm" type="submit">
              Delete motion
            </button>
          </form>
        </>
      ) : (
        motion.votes.length > 0 && (
          <ul className="votes">
            {motion.votes.map((v) => (
              <li key={v.personId} className={`v-${v.choice}`}>
                {v.person.lastName}: {VOTE_LABELS[v.choice]}
              </li>
            ))}
          </ul>
        )
      )}
    </article>
  );
}
