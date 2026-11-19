import clsx from "clsx";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Glyph, Tick, type GlyphName } from "./glyphs";

type Tone = "primary" | "secondary" | "danger" | "text";
type Visual = "idle" | "loading" | "success" | "error";

/** The parts of a TanStack Query mutation a key needs to show the real request state. */
export interface MutationLike { status: "idle" | "pending" | "success" | "error"; submittedAt?: number }

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Key state follows the request: pending → loading; a new success → tick for 1.5 s; a new error → "!" for 2 s.
 * Nothing here is timed for show: without a mutation (or `pending`) the key stays idle.
 */
function useVisual(m?: MutationLike, pending?: boolean): Visual {
  const [flash, setFlash] = useState<Visual | null>(null);
  const seen = useRef<string | null>(null);
  const status = m?.status;
  const at = m?.submittedAt ?? 0;
  useEffect(() => {
    if (!status) return;
    const sig = `${status}:${at}`;
    if (seen.current === null) { seen.current = sig; return; } // first render: no flash for an old result
    if (seen.current === sig) return;
    seen.current = sig;
    if (status === "success" || status === "error") {
      setFlash(status);
      const t = window.setTimeout(() => setFlash(null), status === "success" ? 1500 : 2000);
      return () => window.clearTimeout(t);
    }
    setFlash(null);
  }, [status, at]);
  if (pending || status === "pending") return "loading";
  return flash ?? "idle";
}

const toneClass = (tone: Tone, size?: "sm") => clsx("btn", tone === "primary" && "btn-primary", tone === "danger" && "btn-danger", tone === "text" && "btn-text", size === "sm" && "btn-sm");

function Inner({ glyph, visual, children, size }: { glyph?: GlyphName; visual: Visual; children: ReactNode; size?: "sm" }) {
  const g = size === "sm" ? 16 : 18;
  return (
    <>
      {glyph && (
        <span className="cap" aria-hidden="true">
          {visual === "success" ? <Tick size={g} /> : <Glyph name={visual === "error" ? "gagal" : glyph} size={g} />}
        </span>
      )}
      <span className="label">{children}</span>
      {/* The label is hidden while loading, so the key keeps a spoken state. */}
      {visual === "loading" && <span className="sr-only">Memproses…</span>}
      <span className="bar" aria-hidden="true" />
    </>
  );
}

type KeyProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  tone?: Tone;
  glyph?: GlyphName;
  size?: "sm";
  /** The mutation this key submits; its status drives loading, success and error. */
  m?: MutationLike;
  /** For requests that are not mutations (sign-in). */
  pending?: boolean;
  children: ReactNode;
};

/** A key (C1). Primary is the cash-register key; secondary and danger are paper keys; text is a plain action. */
export function Key({ tone = "secondary", glyph, size, m, pending, className, onClick, type = "button", children, ...rest }: KeyProps) {
  const visual = useVisual(m, pending);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (visual === "error" && !reduced()) ref.current?.animate([0, -4, 4, -4, 4, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: 300, easing: "linear" });
  }, [visual]);
  const loading = visual === "loading";
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(toneClass(tone, size), glyph && "has-cap", className)}
      data-state={visual === "idle" ? undefined : visual}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (loading) { e.preventDefault(); return; } // no double submit
        onClick?.(e);
      }}
      {...rest}
    >
      <Inner glyph={glyph} visual={visual} size={size}>{children}</Inner>
    </button>
  );
}

/** A key that navigates. */
export function KeyLink({ to, tone = "secondary", glyph, size, className, children, ...rest }: { to: string; tone?: Tone; glyph?: GlyphName; size?: "sm"; className?: string; children: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link to={to} className={clsx(toneClass(tone, size), glyph && "has-cap", className)} {...rest}>
      <Inner glyph={glyph} visual="idle" size={size}>{children}</Inner>
    </Link>
  );
}
