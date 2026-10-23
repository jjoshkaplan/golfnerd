See the project doc "roadmap.md" in the golfnerds Claude project. Summary of the build order:

1. Repo, schema, env — done
2. First real CSV adapter from the sim export — waiting on a real export (adapter headers are guessed)
3. Port the dashboard into components — done (src/lib/viz, src/components/viz; /demo, /compare, /sessions/[id])
4. Upload -> parse -> review -> save — done for CSV; screenshot import still to do
5. Notes per session (findings, status) stored with the data
6. Coach summary export
7. Public /demo on Vercel, then beta with the GolfTec coach and 5-10 golfers
