"use client";

import { useActionState } from "react";
import { submitComment, type CommentState } from "./actions";

export function CommentForm({ meetingId, items }: { meetingId: string; items: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<CommentState, FormData>(submitComment, { status: "idle" });

  if (state.status === "ok") {
    return (
      <p className="form-success" role="status">
        Thank you. Your comment was received and will be reviewed by the Clerk before it is added to the public
        record.
      </p>
    );
  }

  const err = state.status === "error" ? state.fieldErrors ?? {} : {};
  const fieldError = (name: string) =>
    err[name] ? (
      <span id={`${name}-error`} className="form-error">
        {err[name]}
      </span>
    ) : null;
  const describedBy = (name: string, hint?: string) =>
    [hint, err[name] ? `${name}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <form action={action} className="form" noValidate>
      <input type="hidden" name="meetingId" value={meetingId} />
      <div className="hp" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === "error" && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}

      <div className="field">
        <label htmlFor="agendaItemId">Agenda item</label>
        <select id="agendaItemId" name="agendaItemId" defaultValue="">
          <option value="">General comment (not about a specific item)</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="field radios">
        <legend>Your position</legend>
        {(["SUPPORT", "OPPOSE", "NEUTRAL"] as const).map((p) => (
          <label key={p}>
            <input type="radio" name="position" value={p} defaultChecked={p === "NEUTRAL"} />
            {p.charAt(0) + p.slice(1).toLowerCase()}
          </label>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor="body">Comment</label>
        <textarea id="body" name="body" required maxLength={5000} aria-invalid={!!err.body} aria-describedby={describedBy("body")} />
        {fieldError("body")}
      </div>

      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required autoComplete="name" aria-invalid={!!err.name} aria-describedby={describedBy("name")} />
        {fieldError("name")}
      </div>

      <div className="field">
        <label htmlFor="city">City or neighborhood (optional)</label>
        <input id="city" name="city" autoComplete="address-level2" />
      </div>

      <div className="field">
        <label htmlFor="email">Email (optional, not published)</label>
        <span id="email-hint" className="hint">
          Only used if the Clerk needs to contact you about your comment.
        </span>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!err.email}
          aria-describedby={describedBy("email", "email-hint")}
        />
        {fieldError("email")}
      </div>

      <div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit comment"}
        </button>
      </div>
    </form>
  );
}
