"use client";
import { useEffect, useRef, useState } from "react";
import type { Theme } from "@/lib/viz/theme";
import type { Hit } from "@/lib/viz/face";
import { useTheme } from "@/components/theme";

/** Size a canvas to its CSS box at device resolution; returns CSS width/height. */
export function fit(c: HTMLCanvasElement): [number, number] {
  const b = c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2), x = c.getContext("2d")!;
  c.width = Math.max(1, b.width * d); c.height = Math.max(1, b.height * d);
  x.setTransform(d, 0, 0, d, 0, 0);
  return [b.width, b.height];
}

export interface Canvas2DProps {
  draw: (x: CanvasRenderingContext2D, w: number, h: number, T: Theme) => Hit[] | void;
  height?: number | string;
  label: string;
  tipFor?: (h: Hit) => string;
  /** Any values that should trigger a redraw. */
  deps?: unknown[];
  className?: string;
}

/** A themed canvas that redraws on resize, theme change or deps change, with hover tooltips for returned hits. */
export default function Canvas2D({ draw, height = 320, label, tipFor, deps = [], className }: Canvas2DProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hits = useRef<Hit[]>([]);
  const T = useTheme();
  const [tip, setTip] = useState<{ x: number; y: number; html: string; above: boolean } | null>(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const run = () => { const [w, h] = fit(c); hits.current = draw(c.getContext("2d")!, w, h, T) ?? []; };
    run();
    const ro = new ResizeObserver(run); ro.observe(c);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [T, draw, ...deps]);

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!tipFor) return;
    const b = e.currentTarget.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
    let best: Hit | null = null, bd = 100;
    hits.current.forEach((h) => { const d = (h.x - mx) ** 2 + (h.y - my) ** 2; if (d < bd) { bd = d; best = h; } });
    if (!best) { setTip(null); return; }
    const hb = best as Hit;
    setTip({ x: hb.x, y: hb.y, html: tipFor(hb), above: hb.y > 90 });
  };

  return (
    <div className={"cwrap " + (className ?? "")} style={{ position: "relative" }}>
      <canvas ref={ref} role="img" aria-label={label} style={{ width: "100%", height, display: "block" }} onPointerMove={onMove} onPointerLeave={() => setTip(null)} />
      {tip && (
        <div className="tip" style={{ left: Math.max(0, tip.x + 12), top: tip.above ? undefined : tip.y + 14, bottom: tip.above ? `calc(100% - ${tip.y - 10}px)` : undefined }}
          dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}
    </div>
  );
}
