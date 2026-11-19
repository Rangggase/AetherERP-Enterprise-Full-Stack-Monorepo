import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FEATURES } from "../../config/features";
import { finishAll, play, settled } from "../../motion/animate";
import { motionLevel, ms } from "../../motion/tokens";
import "./signature.css";

const isDigit = (c: string | undefined) => !!c && c >= "0" && c <= "9";

/**
 * M3 Angka Mekanis: tiap digit yang berubah bergulir vertikal seperti mesin hitung (--dur-roll), digit paling kanan
 * lebih dulu dengan jeda --stagger-digit. Arah gulir mengikuti naik atau turun. "Rp" dan pemisah ribuan tidak bergulir.
 * Hanya saat nilai berubah, tidak saat pertama tampil. Masukan cepat di-debounce; nilai baru membatalkan gulir sebelumnya.
 * Dikurangi: crossfade --dur-fade. Minimal: langsung berganti. Nilai akhir dibacakan lewat aria-live setelah debounce.
 */
export function MechanicalNumber({ value, format = String, className, srLabel }: { value: number; format?: (n: number) => string; className?: string; srLabel?: string }) {
  const [shown, setShown] = useState(value);
  const [roll, setRoll] = useState<{ from: string; to: string; up: boolean; seq: number } | null>(null);
  const last = useRef(value);
  const anims = useRef<(Animation | null)[]>([]);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value === shown) return;
    const t = window.setTimeout(() => setShown(value), ms("debounce-number"));
    return () => window.clearTimeout(t);
  }, [value, shown]);

  useLayoutEffect(() => {
    const from = last.current;
    if (from === shown) return;
    last.current = shown;
    finishAll(anims.current);
    anims.current = [];
    const level = motionLevel();
    if (!FEATURES.mechanicalNumber || level === "minimal") { setRoll(null); return; }
    if (level === "reduced") { setRoll(null); anims.current = [play(wrap.current, [{ opacity: 0.25 }, { opacity: 1 }], { duration: "dur-fade" })]; return; }
    setRoll({ from: format(from), to: format(shown), up: shown > from, seq: performance.now() });
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!roll || !wrap.current) return;
    const strips = [...wrap.current.querySelectorAll<HTMLElement>("[data-strip]")];
    const list = strips.map((el, i) => play(el, roll.up ? [{ transform: "translateY(0)" }, { transform: "translateY(-50%)" }] : [{ transform: "translateY(-50%)" }, { transform: "translateY(0)" }],
      { duration: "dur-roll", delay: (strips.length - 1 - i) * ms("stagger-digit"), easing: "out", fill: "backwards" }));
    anims.current = list;
    const seq = roll.seq;
    void settled(list).then(() => setRoll((r) => (r && r.seq === seq ? null : r)));
  }, [roll]);

  useEffect(() => () => finishAll(anims.current), []);

  const text = format(shown);
  let content: React.ReactNode = text;
  if (roll) {
    const L = Math.max(roll.from.length, roll.to.length);
    const A = roll.from.padStart(L), B = roll.to.padStart(L);
    content = [...B].map((ch, i) => {
      const old = A[i];
      if (ch === " ") return null;
      if (isDigit(ch) && old !== ch && (isDigit(old) || old === " ")) {
        const top = roll.up ? old : ch, bottom = roll.up ? ch : old;
        return (
          <span key={i} className="mn-cell">
            <span data-strip="" className="mn-strip" style={{ transform: roll.up ? "translateY(-50%)" : "translateY(0)" }}>
              <span>{top === " " ? " " : top}</span><span>{bottom === " " ? " " : bottom}</span>
            </span>
          </span>
        );
      }
      return <span key={i}>{ch}</span>;
    });
  }
  return (
    <span className={className}>
      <span ref={wrap} className="mn" aria-hidden="true">{content}</span>
      <span className="sr-live" aria-live="polite">{srLabel ? `${srLabel}: ` : ""}{text}</span>
    </span>
  );
}
