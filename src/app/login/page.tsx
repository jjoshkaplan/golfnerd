"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        throw new Error("Supabase isn't configured on this deployment (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback?next=/sessions` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Sign in</h1>
      <p className="sub" style={{ marginBottom: 12 }}>No password. We email you a link that signs you in.</p>
      {error && <p className="card" style={{ borderColor: "var(--warn)", color: "var(--warn)", marginBottom: 12 }}>{error}</p>}
      {sent ? (
        <p className="card">Link sent to <strong>{email}</strong>. Open it on this device; it expires in an hour. Not there? Check spam, or wait a minute and try again (the free tier limits emails per hour).</p>
      ) : (
        <form onSubmit={submit} className="card" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 240 }}>Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
              style={{ flex: 1, font: "inherit", padding: "6px 10px", background: "var(--panel2)", color: "var(--fg)", border: "1px solid var(--line)", borderRadius: 6 }} />
          </label>
          <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send link"}</button>
        </form>
      )}
    </>
  );
}

export default function Login() {
  return <Suspense><LoginForm /></Suspense>;
}