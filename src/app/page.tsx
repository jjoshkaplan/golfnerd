import Link from "next/link";

export default function Home() {
  return (
    <>
      <div className="eyebrow">Launch monitor sessions, compared</div>
      <h1>See what actually changed between sessions.</h1>
      <p className="sub" style={{ marginBottom: 16 }}>Upload a session from your simulator, tag the stretch where the swing clicked, and replay it against every session before it: path and face through impact, strike on the face, the flight in 3D, landing dispersion and session-over-session trends.</p>
      <p><Link href="/demo">Try the demo</Link> with eight real driver sessions, or <Link href="/login">sign in</Link> to <Link href="/upload">upload</Link> your own.</p>
    </>
  );
}
