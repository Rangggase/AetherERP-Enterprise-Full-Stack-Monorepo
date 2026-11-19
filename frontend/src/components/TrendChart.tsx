import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { drawStroke, play } from "../motion/animate";
import { ms } from "../motion/tokens";

export interface Point { month: string; a: number; b?: number }

const fmt = (v: number) => v.toFixed(1).replace(".", ",");
/** Satu sumbu y dengan batas "rapi": 1, 2, 2,5, atau 5 kali pangkat sepuluh. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

let drawnOnce = false;
const readDrawn = () => { try { return drawnOnce || sessionStorage.getItem("aether.chart-drawn") === "1"; } catch { return drawnOnce; } };
const markDrawn = () => { drawnOnce = true; try { sessionStorage.setItem("aether.chart-drawn", "1"); } catch { /* abaikan */ } };

/**
 * Grafik tinta (8, skill dataviz): garis 2 px, "ujung pena" 4 px dengan nilai terakhir, garis bantu titik-titik tipis,
 * label langsung di ujung garis, isi area maksimal 6%, legenda untuk dua seri (seri kedua juga putus-putus, jadi identitas
 * tidak hanya warna). Garis tergambar sekali saat pertama terlihat. Hover atau panah menampilkan garis bidik dan slip.
 * Palet tinta data dari brief (marun, grafit) gagal pita kecerahan validator dataviz; karena itu penanda sekunder wajib di sini.
 */
export function TrendChart({ data, aLabel, bLabel, unit = "jt", label }: { data: Point[]; aLabel: string; bLabel?: string; unit?: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const lineA = useRef<SVGPathElement>(null);
  const lineB = useRef<SVGPathElement>(null);
  const tips = useRef<SVGGElement>(null);
  const [w, setW] = useState(640);
  const [idx, setIdx] = useState<number | null>(null);
  const two = bLabel !== undefined && data.some((d) => d.b !== undefined);
  const empty = data.length === 0 || data.every((d) => d.a === 0 && (d.b ?? 0) === 0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Tergambar sekali per sesi browser, saat grafik pertama kali terlihat.
  useEffect(() => {
    const el = box.current;
    if (!el || empty || readDrawn()) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      markDrawn();
      drawStroke(lineA.current, { duration: "dur-draw" });
      // Garis pembanding putus-putus muncul memudar (stroke-dashoffset dipakai garis utama).
      play(lineB.current, [{ opacity: 0 }, { opacity: 1 }], { duration: "dur-draw", fill: "backwards" });
      play(tips.current, [{ opacity: 0 }, { opacity: 1 }], { duration: "dur-fast", delay: ms("dur-draw") * 0.75, fill: "backwards" });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [empty]);

  if (empty) {
    return <p className="py-6 text-center text-table text-muted">Belum ada angka untuk 6 bulan terakhir, jadi grafik belum ditampilkan.</p>;
  }

  const H = 240, L = 36, R = w < 480 ? 96 : 132, T = 14, B = 26;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.a, d.b ?? 0))));
  const n = data.length;
  const x = (i: number) => L + (n === 1 ? 0 : (i * (w - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const path = (k: "a" | "b") => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[k] ?? 0).toFixed(1)}`).join(" ");
  const area = `${path("a")} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)}Z`;
  const last = n - 1;
  const at = idx ?? last;
  const endA = data[last]!;

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

  return (
    <div>
      {two && (
        <p className="mb-1 flex flex-wrap gap-x-5 gap-y-1 text-table" aria-hidden="true">
          <span className="inline-flex items-center gap-2"><svg width="22" height="8" className="text-accent"><line x1="0" y1="4" x2="22" y2="4" stroke="currentColor" strokeWidth="2" /></svg>{aLabel}</span>
          <span className="inline-flex items-center gap-2"><svg width="22" height="8" className="text-muted"><line x1="0" y1="4" x2="22" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray="5 3" /></svg>{bLabel}</span>
          <span className="text-muted">{unit === "jt" ? "Jutaan rupiah per bulan" : unit}</span>
        </p>
      )}
      <div ref={box} className="relative" tabIndex={0} role="img" onKeyDown={onKey} onBlur={() => setIdx(null)}
        aria-label={`${label}. ${data.map((d) => `${d.month}: ${aLabel} ${fmt(d.a)}${two ? `, ${bLabel} ${fmt(d.b ?? 0)}` : ""}`).join("; ")}. Panah kiri dan kanan menampilkan nilai per bulan.`}>
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="block overflow-visible" aria-hidden="true" onPointerMove={onMove} onPointerLeave={() => setIdx(null)}>
          {[0, max / 2, max].map((v) => (
            <g key={v}>
              <line x1={L} x2={w - R} y1={y(v)} y2={y(v)} className="text-rule" stroke="currentColor" strokeDasharray={v === 0 ? undefined : "1 3"} strokeLinecap="round" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[12px]">{fmt(v).replace(/,0$/, "")}</text>
            </g>
          ))}
          {data.map((d, i) => <text key={d.month + i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted text-[12px]">{d.month}</text>)}
          <path d={area} className="text-accent" fill="currentColor" fillOpacity={0.06} stroke="none" />
          {two && <path ref={lineB} d={path("b")} pathLength={1} className="text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="0.012 0.008" />}
          <path ref={lineA} d={path("a")} pathLength={1} className="text-accent" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <g ref={tips}>
            <circle cx={x(last)} cy={y(endA.a)} r={4} className="fill-accent" />
            <text x={x(last) + 10} y={y(endA.a) + 4} className="fill-ink text-[12px] font-semibold">{aLabel} {fmt(endA.a)}</text>
            {two && <><circle cx={x(last)} cy={y(endA.b ?? 0)} r={4} className="fill-muted" /><text x={x(last) + 10} y={y(endA.b ?? 0) + 4} className="fill-muted text-[12px]">{bLabel} {fmt(endA.b ?? 0)}</text></>}
          </g>
          {idx !== null && (
            <g pointerEvents="none">
              <line x1={x(at)} x2={x(at)} y1={T} y2={H - B} className="text-muted" stroke="currentColor" />
              <circle cx={x(at)} cy={y(data[at]!.a)} r={4} className="fill-paper text-accent" stroke="currentColor" strokeWidth={2} />
              {two && <circle cx={x(at)} cy={y(data[at]!.b ?? 0)} r={4} className="fill-paper text-muted" stroke="currentColor" strokeWidth={2} />}
            </g>
          )}
        </svg>
        {idx !== null && (
          <div className="tip !absolute !pointer-events-none min-w-[150px] px-2.5 pb-2 pt-1.5 text-[12.5px]" style={{ left: Math.min(x(at) + 12, w - 170), top: Math.max(0, y(data[at]!.a) - 64) }} aria-hidden="true">
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
        <table className="mt-2 w-full max-w-md text-table"><thead><tr className="border-b border-ink text-muted"><th className="py-1 font-medium">Bulan</th><th className="py-1 text-right font-medium">{aLabel} ({unit})</th>{two && <th className="py-1 text-right font-medium">{bLabel} ({unit})</th>}</tr></thead>
          <tbody>{data.map((d, i) => (<tr key={d.month + i} className="border-b border-line"><td className="py-1">{d.month}</td><td className="num py-1">{fmt(d.a)}</td>{two && <td className="num py-1">{fmt(d.b ?? 0)}</td>}</tr>))}</tbody></table>
      </details>
    </div>
  );
}

/** Sparkline tinta 6 bulan di bawah KPI, dengan ujung pena di nilai terakhir. Dekoratif: angka dan kata membawa maknanya. */
export function Sparkline({ values, tone = "accent" }: { values: number[]; tone?: "accent" | "muted" }) {
  if (values.length < 2) return null;
  const W = 160, H = 32, max = Math.max(...values, 1), min = Math.min(...values, 0);
  const x = (i: number) => 2 + (i * (W - 8)) / (values.length - 1);
  const y = (v: number) => 4 + (1 - (v - min) / (max - min || 1)) * (H - 8);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={tone === "accent" ? "block text-accent" : "block text-muted"} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1]!)} r={2.5} fill="currentColor" />
    </svg>
  );
}
