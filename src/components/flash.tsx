/** Shows the `?ok=` / `?error=` message left by a workspace action. */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error)
    return (
      <p className="flash flash-error" role="alert">
        {error}
      </p>
    );
  if (ok)
    return (
      <p className="flash flash-ok" role="status">
        {ok}
      </p>
    );
  return null;
}
