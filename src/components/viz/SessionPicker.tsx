"use client";
import { useEffect, useRef, useState } from "react";
import type { VizGroup } from "@/lib/viz/groups";
import { seriesColor } from "@/lib/viz/theme";

/** Checklist dropdown: pick any combination of groups. */
export default function SessionPicker({ groups, selected, onChange }: { groups: VizGroup[]; selected: Set<string>; onChange: (keys: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", h); return () => document.removeEventListener("pointerdown", h);
  }, []);
  const n = selected.size;
  const label = n === groups.length ? "All sessions" : n === 0 ? "No sessions" : n === 1 ? groups.find((g) => selected.has(g.key))?.name ?? "1 session" : `${n} of ${groups.length} sessions`;
  const names = [...new Set(groups.map((g) => g.short.split(" ")[0]))];
  return (
    <div className="dd" ref={ref}>
      <button type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}><span>{label}</span><span aria-hidden>▾</span></button>
      {open && (
        <div className="menu">
          {[...groups].reverse().map((g) => (
            <label key={g.key}>
              <input type="checkbox" checked={selected.has(g.key)} onChange={(e) => onChange(groups.map((x) => x.key).filter((k) => (k === g.key ? e.target.checked : selected.has(k))))} />
              <span className="sw" style={{ background: seriesColor(g.color).hex, margin: 0 }} />{g.name}
            </label>
          ))}
          <div className="acts">
            <button type="button" onClick={() => onChange(groups.map((g) => g.key))}>All</button>
            <button type="button" onClick={() => onChange([])}>None</button>
            {names.length > 1 && names.map((nm) => <button type="button" key={nm} onClick={() => onChange(groups.filter((g) => g.short.startsWith(nm)).map((g) => g.key))}>{nm} only</button>)}
          </div>
        </div>
      )}
    </div>
  );
}
