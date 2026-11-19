import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface Point { month: string; a: number; b?: number }

const ACCENT = "rgb(var(--accent))";
const MUTED = "rgb(var(--muted))";
const fmt = (v: number) => v.toFixed(1).replace(".", ",");
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Nice upper bound for the y axis: 1, 2, 2.5 or 5 times a power of ten. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

/**
 * Line chart for monthly figures (C10, dataviz method). Main series in accent, comparison in muted and dashed,
 * direct labels at the line ends, three gridlines, a legend for two series and a table alternative.
 * The lines draw once (600 ms, stroke-dashoffset; the comparison line takes its dash when drawing ends) when the chart first scrolls into view; later data changes crossfade without redrawing.
 * Hover or the arrow keys show a vertical crosshair and a slip-shaped tooltip.
 */
export function TrendChart({ data, aLabel, bLabel, unit = "jt", label }: { data: Point[]; aLabel: string; bLabel?: string; unit?: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  // hidden → drawing (stroke-dashoffset, 600 ms) → done (the comparison line gets its dash back).
  const [phase, setPhase] = useState<"hidden" | "drawing" | "done">("hidden");
  const drawn = phase !== "hidden";
  const [idx, setIdx] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const first = useRef(true);
  const two = bLabel !== undefined && data.some((d) => d.b !== undefined);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = box.current;
    if (!el || drawn) return;
    let seen = false;
    try { seen = sessionStorage.getItem("aether.chart-drawn") === "1"; } catch { /* ignore */ }
    if (reduced() || seen) { setPhase("done"); return; }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setPhase("drawing"); io.disconnect(); try { sessionStorage.setItem("aether.chart-drawn", "1"); } catch { /* ignore */ } window.setTimeout(() => setPhase("done"), 640); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [drawn]);
  // A data change after the first draw crossfades the plot instead of drawing again.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    svg.current?.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
  }, [data]);

  const H = 240, L = 36, R = w < 480 ? 92 : 128, T = 12, B = 26;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.a, d.b ?? 0))));
  const n = data.length;
  const x = (i: number) => L + (n === 1 ? 0 : (i * (w - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const path = (k: "a" | "b") => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[k] ?? 0).toFixed(1)}`).join(" ");
  const last = n - 1;
  const lastA = data[last]!, at = idx ?? last;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const vx = e.clientX - r.left;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - vx) < Math.abs(x(best) - vx)) best = i;
    setIdx(best);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); setIdx((i) => Math.max(0, Math.min(last, (i ?? last) + (e.key === "ArrowRight" ? 1 : -1)))); }
    else if (e.key === "Escape") setIdx(null);
  }
  const lineCls = phase === "drawing" ? "trend-line go" : "trend-line";

  return (
    <div>
      {two && (
        <p className="mb-1 flex flex-wrap gap-x-5 gap-y-1 text-table" aria-hidden="true">
          <span className="inline-flex items-center gap-2"><svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={ACCENT} strokeWidth="2" /></svg>{aLabel}</span>
          <span className="inline-flex items-center gap-2"><svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={MUTED} strokeWidth="2" strokeDasharray="5 3" /></svg>{bLabel}</span>
          <span className="text-muted">{unit === "jt" ? "Jutaan rupiah per bulan" : unit}</span>
        </p>
      )}
      <div ref={box} className="relative" tabIndex={0} role="img" onKeyDown={onKey} onBlur={() => setIdx(null)}
        aria-label={`${label}. ${data.map((d) => `${d.month}: ${aLabel} ${fmt(d.a)}${two ? `, ${bLabel} ${fmt(d.b ?? 0)}` : ""}`).join("; ")}. Panah kiri dan kanan menampilkan nilai per bulan.`}>
        <svg ref={svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="block overflow-visible" aria-hidden="true" onPointerMove={onMove} onPointerLeave={() => setIdx(null)}>
          {[0, max / 2, max].map((v) => (
            <g key={v}>
              <line x1={L} x2={w - R} y1={y(v)} y2={y(v)} stroke="rgb(var(--line))" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[12px]">{fmt(v).replace(/,0$/, "")}</text>
            </g>
          ))}
          {data.map((d, i) => <text key={d.month + i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted text-[12px]">{d.month}</text>)}
          {phase === "done" ? (
            <>
              {two && <path d={path("b")} fill="none" stroke={MUTED} strokeWidth={2} strokeLinejoin="round" strokeDasharray="5 3" />}
              <path d={path("a")} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" />
            </>
          ) : (
            <>
              {two && <path d={path("b")} pathLength={1} className={lineCls} fill="none" stroke={MUTED} strokeWidth={2} strokeLinejoin="round" />}
              <path d={path("a")} pathLength={1} className={lineCls} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" />
            </>
          )}
          <g className={drawn ? "trend-end drawn" : "trend-end"}>
            <circle cx={x(last)} cy={y(lastA.a)} r={4} fill={ACCENT} />
            <text x={x(last) + 10} y={y(lastA.a) + 4} className="fill-ink text-[12px] font-semibold">{aLabel} {fmt(lastA.a)}</text>
            {two && <><circle cx={x(last)} cy={y(lastA.b ?? 0)} r={4} fill={MUTED} /><text x={x(last) + 10} y={y(lastA.b ?? 0) + 4} className="fill-muted text-[12px]">{bLabel} {fmt(lastA.b ?? 0)}</text></>}
          </g>
          {idx !== null && (
            <g pointerEvents="none">
              <line x1={x(at)} x2={x(at)} y1={T} y2={H - B} stroke={MUTED} />
              <circle cx={x(at)} cy={y(data[at]!.a)} r={4} fill="rgb(var(--surface))" stroke={ACCENT} strokeWidth={2} />
              {two && <circle cx={x(at)} cy={y(data[at]!.b ?? 0)} r={4} fill="rgb(var(--surface))" stroke={MUTED} strokeWidth={2} />}
            </g>
          )}
        </svg>
        {idx !== null && (
          <div className="slip pointer-events-none absolute min-w-[150px] px-2.5 pb-3 pt-2 text-[12.5px]" style={{ left: Math.min(x(at) + 12, w - 170), top: Math.max(0, y(data[at]!.a) - 64) }} aria-hidden="true">
            <b className="font-semibold">{data[at]!.month}</b>
            <div className="mt-0.5 grid grid-cols-[1fr_auto] gap-x-3.5 font-num">
              <span>{aLabel}</span><span>Rp{fmt(data[at]!.a)} {unit}</span>
              {two && <><span className="text-muted">{bLabel}</span><span className="text-muted">Rp{fmt(data[at]!.b ?? 0)} {unit}</span></>}
            </div>
          </div>
        )}
      </div>
      <details className="mt-1 text-table">
        <summary className="inline-flex min-h-8 items-center text-brand">Lihat sebagai tabel</summary>
        <table className="tbl dense mt-2"><thead><tr><th>Bulan</th><th className="text-right">{aLabel} ({unit})</th>{two && <th className="text-right">{bLabel} ({unit})</th>}</tr></thead>
          <tbody>{data.map((d, i) => (<tr key={d.month + i}><td>{d.month}</td><td className="num">{fmt(d.a)}</td>{two && <td className="num">{fmt(d.b ?? 0)}</td>}</tr>))}</tbody></table>
      </details>
    </div>
  );
}

/** Six-month sparkline under a KPI. Decorative: the figure and the words carry the meaning. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 160, H = 32, max = Math.max(...values, 1), min = Math.min(...values, 0);
  const x = (i: number) => 2 + (i * (W - 6)) / (values.length - 1);
  const y = (v: number) => 4 + (1 - (v - min) / (max - min || 1)) * (H - 8);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1]!)} r={2.5} fill={ACCENT} />
    </svg>
  );
}
