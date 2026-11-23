import { meetingActivity } from "@/lib/admin-data";
import { formatDateTime } from "@/lib/format";

export async function ActivityTab({ meetingId, tz }: { meetingId: string; tz: string }) {
  const events = await meetingActivity(meetingId);
  if (!events.length) return <p className="empty">No changes recorded yet.</p>;
  return (
    <ol className="log" aria-label="Activity, newest first">
      {events.map((e) => (
        <li key={e.id}>
          <span className="muted num">{formatDateTime(e.createdAt, tz).replace(/^\w+, /, "")}</span>
          <span>
            {e.summary}
            <span className="muted"> · {e.user?.name ?? e.user?.email ?? "Former user"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
