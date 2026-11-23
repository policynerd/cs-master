"use client";

import { signIn, signOut } from "next-auth/react";
import { useState } from "react";

export function SignInButtons({ entra, dev }: { entra: boolean; dev: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack" style={{ gap: 20 }}>
      {entra && (
        <button className="btn" type="button" onClick={() => signIn("azure-ad", { callbackUrl: "/admin" })}>
          Sign in with Microsoft
        </button>
      )}
      {dev && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            signIn("dev", { email, callbackUrl: "/admin" }).finally(() => setBusy(false));
          }}
        >
          <p className="notice" style={{ margin: 0 }}>
            Development sign-in is on. Anyone can sign in as any staff email without a password. Never enable it on a
            public server.
          </p>
          <div className="field">
            <label htmlFor="dev-email">Staff email</label>
            <input id="dev-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <button className="btn btn-quiet" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in (development)"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function SignOutButton() {
  return (
    <button type="button" className="linkish" onClick={() => signOut({ callbackUrl: "/" })}>
      Sign out
    </button>
  );
}
