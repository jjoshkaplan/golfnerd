"use client";
import { useMemo } from "react";
import { groupsFrom, type SessionLike } from "@/lib/viz/build";
import type { Status } from "@/lib/viz/groups";
import Dashboard from "./Dashboard";

/** Builds VizGroups on the client (dates format in the viewer's zone) and renders the dashboard. */
export default function SessionsDashboard({ sessions, initialTab, status }: { sessions: SessionLike[]; initialTab?: "replay" | "compare" | "dispersion" | "trends" | "notes"; status?: Status | null }) {
  const groups = useMemo(() => groupsFrom(sessions), [sessions]);
  if (!groups.length) return <p className="muted">Nothing to show yet.</p>;
  return <Dashboard groups={groups} initialTab={initialTab} status={status} />;
}
