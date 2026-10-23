/**
 * Canvas and scene palettes for the two themes. CSS handles the page chrome
 * through custom properties in globals.css; the canvases and the three.js
 * scene cannot read those cheaply, so they take a Theme object instead.
 */
export type ThemeName = "dark" | "light";

export interface Theme {
  name: ThemeName;
  fg: string; text: string; muted: string; faint: string; axis: string; empty: string; ghost: string;
  grid: string; cross: string; face: string; faceEdge: string; groove: string; ring: string; dash: string;
  bg: string; turf: string; fw: string; turfGrid: string; center: string; neutral: string; ball: string;
  good: string; warn: string; halo: string; flashRGB: string; band: string;
  // three.js hex colors
  ink3: number; bg3: number; turf3: number; fw3: number; edge3: number; grid3: number; center3: number; ball3: number; label3: string;
}

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    name: "dark",
    fg: "#f2f1ec", text: "#b9b8b1", muted: "#8a929a", faint: "#6f7880", axis: "#9aa2a8", empty: "#9aa39c", ghost: "#4b545c",
    grid: "#2c2c2a", cross: "#5d666e", face: "#1f2429", faceEdge: "#454b52", groove: "#2e353c", ring: "#3a434c", dash: "#3d4650",
    bg: "#14161a", turf: "#1a231d", fw: "#223328", turfGrid: "#2f3d33", center: "#56645a", neutral: "#8a8a85", ball: "#fff",
    good: "#7fd18f", warn: "#e9a36b", halo: "rgba(242,241,236,.4)", flashRGB: "rgba(255,255,255,", band: "rgba(236,234,228,.07)",
    ink3: 0xf2f1ec, bg3: 0x14161a, turf3: 0x1a231d, fw3: 0x223328, edge3: 0x33483a, grid3: 0x2f3d33, center3: 0x56645a, ball3: 0xffffff, label3: "#8f9a92",
  },
  light: {
    name: "light",
    fg: "#1a1d21", text: "#3d434a", muted: "#5e666e", faint: "#7c848c", axis: "#5e666e", empty: "#6f777e", ghost: "#9aa2a8",
    grid: "#e1e3e0", cross: "#8a929a", face: "#e6e8e6", faceEdge: "#b4bab6", groove: "#cfd4d0", ring: "#b4bab6", dash: "#b4bab6",
    bg: "#fbfbf9", turf: "#e1ebe0", fw: "#cfe1cf", turfGrid: "#b7cbb7", center: "#7f9a80", neutral: "#7a7a76", ball: "#1a1d21",
    good: "#2e8b57", warn: "#b85c17", halo: "rgba(26,29,33,.4)", flashRGB: "rgba(26,29,33,", band: "rgba(26,29,33,.06)",
    ink3: 0x2a2e33, bg3: 0xfbfbf9, turf3: 0xdfeadf, fw3: 0xcfe1cf, edge3: 0xa9c2a9, grid3: 0xb7cbb7, center3: 0x7f9a80, ball3: 0x1a1d21, label3: "#5f7a62",
  },
};

/** Eight session colors, assigned in order. `soft` is the dark-mode text tint; light mode uses the base color for text. */
export const SERIES = [
  { hex: "#e8a33d", soft: "#f0c07a", line: 0x8a7550 },
  { hex: "#3987e5", soft: "#7fb2f0", line: 0x5f7794 },
  { hex: "#2fbf8a", soft: "#8fe0c0", line: 0x5f8a7a },
  { hex: "#9085e9", soft: "#bdb6f5", line: 0x7d7a92 },
  { hex: "#e0608a", soft: "#f3a3bf", line: 0x8a5a68 },
  { hex: "#35b7c9", soft: "#8fdbe8", line: 0x4f7f88 },
  { hex: "#b58b5a", soft: "#dcbf98", line: 0x7d6a55 },
  { hex: "#6fd06a", soft: "#aee8aa", line: 0x5a8a58 },
] as const;

export const seriesColor = (i: number) => SERIES[i % SERIES.length];

/** Text color for a series label on the current theme. */
export const labelColor = (i: number, t: Theme) => (t.name === "dark" ? seriesColor(i).soft : seriesColor(i).hex);

export const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

export function txt(x: CanvasRenderingContext2D, t: string, px: number, py: number, color: string, size = 11, align: CanvasTextAlign = "left") {
  x.fillStyle = color;
  x.font = `${size}px ${MONO}`;
  x.textAlign = align;
  x.fillText(t, px, py);
}

export const fmtSigned = (v: number) => (v > 0 ? "+" : "") + v;
export const sideText = (v: number, round = false) => {
  const a = round ? Math.round(Math.abs(v)) : Math.abs(v);
  return v > 0 ? `${a} R` : v < 0 ? `${a} L` : "on line";
};
