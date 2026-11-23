import { MEETING_TYPE_LABELS } from "@/lib/format";

type Values = {
  bodyId?: string;
  type?: string;
  title?: string | null;
  startsAt?: string;
  location?: string | null;
  address?: string | null;
  virtualUrl?: string | null;
  livestreamUrl?: string | null;
  recordingUrl?: string | null;
};

/** Shared fields for creating and editing a meeting. */
export function MeetingFields({
  bodies,
  values = {},
  tz,
  lockTime,
}: {
  bodies: { id: string; name: string }[];
  values?: Values;
  tz: string;
  lockTime?: boolean;
}) {
  return (
    <div className="form-grid">
      <div className="field">
        <label htmlFor="bodyId">Board or commission</label>
        <select id="bodyId" name="bodyId" required defaultValue={values.bodyId ?? ""}>
          <option value="" disabled>
            Choose…
          </option>
          {bodies.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="type">Meeting type</label>
        <select id="type" name="type" required defaultValue={values.type ?? "REGULAR"}>
          {Object.entries(MEETING_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="startsAt">Date and start time</label>
        <span className="hint" id="startsAt-hint">
          {tz.replace("_", " ")} time.{lockTime ? " Notice is posted, so the time can't change." : ""}
        </span>
        <input
          id="startsAt"
          name="startsAt"
          type="datetime-local"
          required
          defaultValue={values.startsAt}
          readOnly={lockTime}
          aria-describedby="startsAt-hint"
        />
      </div>
      <div className="field">
        <label htmlFor="title">Title (optional)</label>
        <span className="hint" id="title-hint">
          Leave blank to use the body name and meeting type.
        </span>
        <input id="title" name="title" defaultValue={values.title ?? ""} aria-describedby="title-hint" />
      </div>
      <div className="field">
        <label htmlFor="location">Room</label>
        <input id="location" name="location" defaultValue={values.location ?? ""} placeholder="Council Chambers, Town Hall" />
      </div>
      <div className="field">
        <label htmlFor="address">Street address</label>
        <input id="address" name="address" defaultValue={values.address ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="livestreamUrl">Livestream link</label>
        <input id="livestreamUrl" name="livestreamUrl" type="url" defaultValue={values.livestreamUrl ?? ""} placeholder="https://" />
      </div>
      <div className="field">
        <label htmlFor="virtualUrl">Remote attendance link</label>
        <input id="virtualUrl" name="virtualUrl" type="url" defaultValue={values.virtualUrl ?? ""} placeholder="https://" />
      </div>
      <div className="field span-2">
        <label htmlFor="recordingUrl">Recording link (after the meeting)</label>
        <input id="recordingUrl" name="recordingUrl" type="url" defaultValue={values.recordingUrl ?? ""} placeholder="https://" />
      </div>
    </div>
  );
}
