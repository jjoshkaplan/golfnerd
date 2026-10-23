import seed from "../../../data/seed/sessions.json";
import status from "../../../data/seed/status.json";
import SessionsDashboard from "@/components/viz/SessionsDashboard";
import type { SessionLike } from "@/lib/viz/build";

export const metadata = { title: "Demo · golfnerds" };

/** Public demo: the eight prototype driver sessions, no sign-in needed. */
export default function Demo() {
  const sessions = seed as unknown as SessionLike[];
  const n = sessions.reduce((a, s) => a + s.shots.length, 0);
  return (
    <>
      <div className="eyebrow">Demo · {sessions.length} sim sessions · {n} drives · two driver heads</div>
      <h1>R9 vs Qi4D Max, shot by shot</h1>
      <p className="sub" style={{ marginBottom: 16 }}>Every drive from ten launch-monitor sessions, in the order it happens: the club&apos;s path and face through impact, where the ball met the face, then the flight in 3D. Each session has a highlighted stretch.</p>
      <SessionsDashboard sessions={sessions} status={status} />
    </>
  );
}
