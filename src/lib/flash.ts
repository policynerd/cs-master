/**
 * Post/redirect/get feedback for workspace forms. Actions redirect back to the
 * page with `?ok=` or `?error=`, so every form works without client-side
 * JavaScript and a refresh never re-submits.
 */
import { redirect } from "next/navigation";

function withParam(path: string, key: "ok" | "error", message: string): string {
  const [base, hash] = path.split("#");
  const url = new URL(base, "http://x");
  url.searchParams.delete("ok");
  url.searchParams.delete("error");
  url.searchParams.set(key, message);
  return url.pathname + url.search + (hash ? `#${hash}` : "");
}

export function done(path: string, message: string): never {
  redirect(withParam(path, "ok", message));
}

export function fail(path: string, message: string): never {
  redirect(withParam(path, "error", message));
}

/** Reads a trimmed string field; empty strings become null. */
export function field(form: FormData, name: string): string | null {
  const v = form.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Accepts only http(s) URLs, so a stored link can never run script. */
export function safeUrl(v: string | null): string | null | undefined {
  if (v === null) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
