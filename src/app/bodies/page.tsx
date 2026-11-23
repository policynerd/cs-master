import type { Metadata } from "next";
import Link from "next/link";
import { listBodies } from "@/lib/public";
import { BODY_TYPE_LABELS } from "@/lib/format";
import { vacancyCount } from "@/lib/seats";

export const metadata: Metadata = { title: "Boards & Commissions" };

export default async function BodiesPage() {
  const now = new Date();
  const bodies = await listBodies();
  return (
    <div className="wrap">
      <div className="page-head">
        <span className="eyebrow">Boards & Commissions</span>
        <h1>Who serves</h1>
        <p>
          The council and the boards, commissions and committees that advise it. Each page lists current members,
          their terms, open seats and upcoming meetings.
        </p>
      </div>
      {bodies.length ? (
        <div className="body-grid">
          {bodies.map((b) => {
            const open = vacancyCount(b, b.seats, now);
            return (
              <Link key={b.id} href={`/bodies/${b.slug}`} className="body-card" data-accent={b.accent}>
                <span className="eyebrow">
                  {BODY_TYPE_LABELS[b.type]}
                  {b.parent ? ` of the ${b.parent.name}` : ""}
                </span>
                <h2>{b.name}</h2>
                {b.description && <p>{b.description}</p>}
                <div className="body-card-meta">
                  <span>{b.seatCount} seats</span>
                  {open > 0 ? <span className="pill pill-warn">{open} vacant</span> : <span>All seats filled</span>}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="empty">No boards or commissions have been set up yet.</p>
      )}
    </div>
  );
}
