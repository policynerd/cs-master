import type { WorkspaceMeeting } from "@/lib/admin-data";
import { formatDateTime } from "@/lib/format";
import type { getOrganization } from "@/lib/public";
import { reviewComment } from "../../_actions/record";

type Org = Awaited<ReturnType<typeof getOrganization>>;

const STATUS = { PENDING: "pill-warn", ACCEPTED: "pill-ok", REJECTED: "pill-neutral" } as const;

export function CommentsTab({ m, org }: { m: WorkspaceMeeting; org: Org }) {
  if (!m.publicComments.length) return <p className="empty">No written comments have been submitted for this meeting.</p>;
  const order = { PENDING: 0, ACCEPTED: 1, REJECTED: 2 };
  const comments = [...m.publicComments].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>
        Accepted comments appear on the public meeting page with the commenter&apos;s name and city. Email addresses are never published.
        Reject only comments your public-comment policy excludes, such as spam or threats.
      </p>
      {comments.map((c) => (
        <article key={c.id} className="panel stack" style={{ gap: 8 }}>
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <span>
              <strong>{c.name}</strong>
              {c.city && <span className="muted">, {c.city}</span>}
              <span className="muted"> · {c.position.charAt(0) + c.position.slice(1).toLowerCase()}</span>
            </span>
            <span className={`pill ${STATUS[c.status]}`}>{c.status.charAt(0) + c.status.slice(1).toLowerCase()}</span>
          </div>
          <span className="muted" style={{ fontSize: "0.88rem" }}>
            {c.agendaItem ? `On “${c.agendaItem.title}”` : "General comment"} · Received {formatDateTime(c.submittedAt, org.timezone)}
            {c.email && <> · {c.email}</>}
          </span>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.body}</p>
          <form action={reviewComment} className="row-actions">
            <input type="hidden" name="commentId" value={c.id} />
            {c.status !== "ACCEPTED" && (
              <button className="btn btn-sm" type="submit" name="decision" value="ACCEPTED">
                Accept
              </button>
            )}
            {c.status !== "REJECTED" && (
              <button className="btn btn-quiet btn-sm" type="submit" name="decision" value="REJECTED">
                Reject
              </button>
            )}
          </form>
        </article>
      ))}
    </div>
  );
}
