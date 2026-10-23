"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/sessions` } });
    setSent(true);
  }
  return (
    <>
      <h1>Sign in</h1>
      {sent ? <p>Check your email for a sign-in link.</p> : (
        <form onSubmit={submit} className="card">
          <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <button type="submit">Send link</button>
        </form>
      )}
    </>
  );
}
