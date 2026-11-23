import Link from "next/link";
import type { WorkspaceMeeting } from "@/lib/admin-data";
import { numberAgenda, SECTION_LABELS, SECTION_ORDER } from "@/lib/agenda";
import { formatDateTime } from "@/lib/format";
import { noticeStatus } from "@/lib/notice";
import type { getOrganization } from "@/lib/public";
import {
  addAgendaItem,
  addAttachment,
  deleteAgendaItem,
  deleteAttachment,
  moveAgendaItem,
  updateAgendaItem,
} from "../../_actions/agenda";
import { publishAgenda } from "../../_actions/meetings";

type Org = Awaited<ReturnType<typeof getOrganization>>;
type Item = WorkspaceMeeting["agendaItems"][number];

const KIND_LABELS = { ACTION: "Action", DISCUSSION: "Discussion", INFORMATION: "Information", CEREMONIAL: "Procedural" };

export function AgendaTab({ m, org, now, editId }: { m: WorkspaceMeeting; org: Org; now: Date; editId?: string }) {
  const locked = m.status === "CANCELLED" || m.status === "ADJOURNED";
  const agenda = numberAgenda(m.agendaItems);
  const ns = noticeStatus(m, org, now);

  return (
    <div className="stack" style={{ gap: 28 }}>
      <PublishPanel m={m} org={org} now={now} deadline={ns.deadline} locked={locked} />

      {agenda.length === 0 ? (
        <p className="empty">No items yet. Add the first one below. A typical agenda starts with Call to Order and Roll Call.</p>
      ) : (
        agenda.map((s) => (
          <section key={s.section} className="ws-section" aria-label={s.label}>
            <h3>
              <span className="n">{s.number}</span>
              {s.label}
            </h3>
            {s.items.map((item, idx) => (
              <ItemRow
                key={item.id}
                item={item}
                first={idx === 0}
                last={idx === s.items.length - 1}
                editing={editId === item.id}
                locked={locked}
                meetingId={m.id}
              />
            ))}
          </section>
        ))
      )}

      {!locked && (
        <section id="add" className="panel">
          <h2>Add an agenda item</h2>
          <form action={addAgendaItem} className="form">
            <input type="hidden" name="meetingId" value={m.id} />
            <ItemFields />
            <div>
              <button className="btn" type="submit">
                Add item
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

function PublishPanel({ m, org, now, deadline, locked }: { m: WorkspaceMeeting; org: Org; now: Date; deadline: Date; locked: boolean }) {
  if (m.agendaPublishedAt) {
    return (
      <p className="flash flash-ok" style={{ margin: 0 }}>
        Published {formatDateTime(m.agendaPublishedAt, org.timezone)}.{" "}
        {!locked && "Changes appear on the public agenda right away and are recorded in the activity log."}
      </p>
    );
  }
  if (locked) return null;
  const late = deadline < now && m.type !== "EMERGENCY";
  return (
    <section className="panel notice">
      <h2>Not yet public</h2>
      <p style={{ marginTop: 0 }}>
        {late ? (
          <>The publication deadline was {formatDateTime(deadline, org.timezone)}. This agenda can no longer be published for this meeting.</>
        ) : (
          <>
            Publish by <strong>{formatDateTime(deadline, org.timezone)}</strong> to meet the {Math.round((m.startsAt.getTime() - deadline.getTime()) / 3600_000)}-hour notice requirement.
            Publishing also posts notice if you haven&apos;t already.
          </>
        )}
      </p>
      {!late && (
        <form action={publishAgenda}>
          <input type="hidden" name="meetingId" value={m.id} />
          <button className="btn" type="submit" disabled={m.agendaItems.length === 0}>
            Publish agenda
          </button>
        </form>
      )}
    </section>
  );
}

function ItemRow({
  item,
  first,
  last,
  editing,
  locked,
  meetingId,
}: {
  item: Item & { number: string };
  first: boolean;
  last: boolean;
  editing: boolean;
  locked: boolean;
  meetingId: string;
}) {
  return (
    <article id={`item-${item.id}`} className="ws-item">
      <span className="agenda-item-num">{item.number}</span>
      <div className="stack" style={{ gap: 4, minWidth: 0 }}>
        <span className="ws-item-title">{item.title}</span>
        <span className="meta">
          {KIND_LABELS[item.kind]}
          {item.isConfidential && " · Closed session"}
          {item.department && ` · ${item.department}`}
          {item.attachments.length > 0 && ` · ${item.attachments.length} document${item.attachments.length === 1 ? "" : "s"}`}
          {item.attachments.some((a) => !a.isPublic) && " (some staff only)"}
          {item.motions.length > 0 && ` · ${item.motions.length} motion${item.motions.length === 1 ? "" : "s"}`}
        </span>
      </div>
      {!locked && (
        <div className="row-actions">
          <form action={moveAgendaItem}>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="dir" value="up" />
            <button className="btn btn-quiet btn-sm" type="submit" disabled={first} aria-label={`Move “${item.title}” up`}>
              ↑
            </button>
          </form>
          <form action={moveAgendaItem}>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="dir" value="down" />
            <button className="btn btn-quiet btn-sm" type="submit" disabled={last} aria-label={`Move “${item.title}” down`}>
              ↓
            </button>
          </form>
          {editing ? (
            <Link className="btn btn-quiet btn-sm" href={`/admin/meetings/${meetingId}?tab=agenda#item-${item.id}`}>
              Close
            </Link>
          ) : (
            <Link className="btn btn-quiet btn-sm" href={`/admin/meetings/${meetingId}?tab=agenda&edit=${item.id}#item-${item.id}`}>
              Edit
            </Link>
          )}
        </div>
      )}
      {editing && !locked && (
        <div className="ws-edit stack" style={{ gap: 18 }}>
          <form action={updateAgendaItem} className="form">
            <input type="hidden" name="itemId" value={item.id} />
            <ItemFields item={item} />
            <div className="row-actions">
              <button className="btn" type="submit">
                Save item
              </button>
            </div>
          </form>

          <div className="stack" style={{ gap: 8 }}>
            <strong>Documents</strong>
            {item.attachments.length ? (
              <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 6 }}>
                {item.attachments.map((a) => (
                  <li key={a.id} className="row-actions" style={{ justifyContent: "space-between" }}>
                    <span>
                      <a href={a.url} target="_blank" rel="noreferrer">
                        {a.title}
                      </a>
                      {!a.isPublic && <span className="pill pill-warn" style={{ marginLeft: 8 }}>Staff only</span>}
                    </span>
                    <form action={deleteAttachment}>
                      <input type="hidden" name="attachmentId" value={a.id} />
                      <button className="btn btn-danger btn-sm" type="submit">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="muted">No documents attached.</span>
            )}
            <form action={addAttachment} className="form-grid">
              <input type="hidden" name="itemId" value={item.id} />
              <div className="field">
                <label htmlFor={`att-title-${item.id}`}>Document title</label>
                <input id={`att-title-${item.id}`} name="title" required />
              </div>
              <div className="field">
                <label htmlFor={`att-url-${item.id}`}>Link</label>
                <input id={`att-url-${item.id}`} name="url" type="url" required placeholder="https://" />
              </div>
              <label className="check span-2">
                <input type="checkbox" name="isPublic" defaultChecked /> Public (uncheck for staff-only working documents)
              </label>
              <div className="span-2">
                <button className="btn btn-quiet" type="submit">
                  Attach document
                </button>
              </div>
            </form>
          </div>

          <form action={deleteAgendaItem}>
            <input type="hidden" name="itemId" value={item.id} />
            <button className="btn btn-danger btn-sm" type="submit" disabled={item.motions.length > 0}>
              Delete item
            </button>
            {item.motions.length > 0 && <span className="muted"> Items with recorded motions can&apos;t be deleted.</span>}
          </form>
        </div>
      )}
    </article>
  );
}

function ItemFields({ item }: { item?: Item }) {
  const id = (name: string) => `${name}-${item?.id ?? "new"}`;
  return (
    <div className="form-grid">
      <div className="field">
        <label htmlFor={id("section")}>Section</label>
        <select id={id("section")} name="section" required defaultValue={item?.section ?? "NEW_BUSINESS"}>
          {SECTION_ORDER.map((s) => (
            <option key={s} value={s}>
              {SECTION_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={id("kind")}>Type</label>
        <select id={id("kind")} name="kind" defaultValue={item?.kind ?? "ACTION"}>
          {Object.entries(KIND_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="field span-2">
        <label htmlFor={id("title")}>Title</label>
        <input id={id("title")} name="title" required maxLength={500} defaultValue={item?.title} />
      </div>
      <div className="field span-2">
        <label htmlFor={id("summary")}>Summary</label>
        <textarea id={id("summary")} name="summary" style={{ minHeight: 90 }} defaultValue={item?.summary ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={id("recommendedAction")}>Recommended action</label>
        <input id={id("recommendedAction")} name="recommendedAction" defaultValue={item?.recommendedAction ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={id("fiscalImpact")}>Fiscal impact</label>
        <input id={id("fiscalImpact")} name="fiscalImpact" defaultValue={item?.fiscalImpact ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={id("department")}>Department</label>
        <input id={id("department")} name="department" defaultValue={item?.department ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={id("presenter")}>Presenter</label>
        <input id={id("presenter")} name="presenter" defaultValue={item?.presenter ?? ""} />
      </div>
      <label className="check">
        <input type="checkbox" name="isConfidential" defaultChecked={item?.isConfidential} />
        <span>
          Closed session item
          <span className="hint" style={{ display: "block" }}>The public sees only the title and legal authority.</span>
        </span>
      </label>
      <div className="field">
        <label htmlFor={id("legalCitation")}>Legal authority (closed session)</label>
        <input id={id("legalCitation")} name="legalCitation" defaultValue={item?.legalCitation ?? ""} placeholder="Open Meetings Act § 2(c)(11)" />
      </div>
    </div>
  );
}
