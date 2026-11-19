import clsx from "clsx";
import { useEffect, useRef, type ReactNode } from "react";
import { Glyph, type GlyphName } from "./glyphs";
import { ApiError } from "../lib/api";

type Tone = "good" | "warn" | "bad" | "info" | "idle";

const TONE: Record<string, { tone: Tone; text: string }> = {
  DRAFT: { tone: "idle", text: "Draf" },
  QUOTATION: { tone: "idle", text: "Penawaran" },
  REQUESTED: { tone: "idle", text: "Diminta" },
  PENDING_APPROVAL: { tone: "warn", text: "Perlu persetujuan" },
  APPROVED: { tone: "info", text: "Disetujui" },
  CONFIRMED_SO: { tone: "info", text: "Terkonfirmasi" },
  IN_TRANSIT: { tone: "info", text: "Dalam perjalanan" },
  PARTIALLY_RECEIVED: { tone: "warn", text: "Diterima sebagian" },
  RECEIVED: { tone: "good", text: "Diterima" },
  DELIVERED: { tone: "info", text: "Terkirim" },
  BILLED: { tone: "info", text: "Ditagih" },
  INVOICED: { tone: "info", text: "Terfaktur" },
  OPEN: { tone: "info", text: "Terbuka" },
  PARTIALLY_PAID: { tone: "warn", text: "Dibayar sebagian" },
  PAID: { tone: "good", text: "Lunas" },
  POSTED: { tone: "good", text: "Terposting" },
  COMPLETED: { tone: "good", text: "Selesai" },
  CLOSED: { tone: "idle", text: "Ditutup" },
  REVERSED: { tone: "bad", text: "Dibalik" },
  CANCELLED: { tone: "bad", text: "Dibatalkan" },
};
const GLYPH: Record<Tone, GlyphName> = { good: "berhasil", warn: "peringatan", bad: "tutup", info: "kirim", idle: "edit" };
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const statusText = (value: string): string => TONE[value]?.text ?? value;
const toneOf = (value: string) => TONE[value] ?? { tone: "idle" as const, text: value };

/** A status in a table or list: glyph plus word on a light tint of the status colour. Never colour alone. */
export function Status({ value }: { value: string }) {
  const t = toneOf(value);
  return <span className={clsx("badge", t.tone)}><Glyph name={GLYPH[t.tone]} size={14} />{t.text}</span>;
}

/** The ink filter stamps use (static, never animated). Rendered once by the app frame. */
export function InkFilter() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <filter id="ink" x="-5%" y="-10%" width="110%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" xChannelSelector="R" yChannelSelector="G" result="d" />
        <feComponentTransfer in="n" result="speck"><feFuncA type="discrete" tableValues="1 1 1 1 1 1 1 0" /></feComponentTransfer>
        <feComposite in="d" in2="speck" operator="in" />
      </filter>
    </svg>
  );
}

/**
 * The status of a document as an ink stamp (C5). It is stamped (scale 1.15 to 1, spring) only when the
 * status changes while the page is open; a page opened normally shows the stamp at rest.
 */
export function Stamp({ value }: { value: string }) {
  const t = toneOf(value);
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    const frames = reduced()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: "rotate(-4deg) scale(1.15)" }, { opacity: 1, transform: "rotate(-4deg) scale(1)" }];
    ref.current?.animate(frames, { duration: 220, easing: "cubic-bezier(0.3, 1.35, 0.5, 1)" });
  }, [value]);
  return <span ref={ref} className={clsx("stamp", t.tone)} role="status" aria-label={`Status: ${t.text}`}>{t.text}</span>;
}

export function PageHeader({ title, sub, note, actions, cta }: { title: string; sub?: string; note?: string; actions?: ReactNode; cta?: boolean }) {
  const line = sub ?? note;
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-ink pb-4">
      <div className="min-w-0">
        <h1 className="font-serif text-xl font-medium tracking-[-0.005em] max-md:text-[26px] max-md:leading-8">{title}</h1>
        {line && <p className="mt-1 max-w-prose text-table text-muted">{line}</p>}
      </div>
      {actions && <div className={clsx("flex flex-wrap items-center gap-2", cta && "page-cta")}>{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-table font-semibold">{children}</h2>;
}

/** Small isometric line drawings for states (C9): one colour #6B645A, 1 px, no fill, decorative. */
const ART = {
  rak: <><path d="M30 30 75 8l45 22-45 22z" /><path d="M30 56 75 34l45 22-45 22z" /><path d="M30 82 75 60l45 22-45 22z" /><path d="M30 30v52M120 30v52M75 52v52" /><path d="M75 8v26" strokeDasharray="2 3" /></>,
  map: <><path d="M24 34h32l7 9h63v55H24z" /><path d="M24 98 37 54h101l-12 44" /><path d="M60 72h40" strokeDasharray="2 3" /></>,
  struk: <><path d="M50 8h50v92l-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4z" /><path d="M58 24h34M58 36h34M58 48h22M58 70h34" strokeDasharray="2 3" /></>,
  sobek: <><path d="M44 6h62v38l-7 6-8-5-8 6-8-5-8 6-8-5-8 6-7-5z" /><path d="M50 66l7 5 8-6 8 5 8-6 8 5 8-6 9 5v40H50z" /><path d="M54 18h40M54 28h30M58 84h40M58 94h28" /></>,
  gembok: <><path d="M53 50h44v40H53z" /><path d="M62 50V38a13 13 0 0 1 26 0v12" /><circle cx="75" cy="66" r="4" /><path d="M75 70v8" /></>,
  grafik: <><path d="M20 96h110M20 96V14" /><path d="M28 80h20M56 70h20M84 76h20" strokeDasharray="2 3" /></>,
};
export type Art = keyof typeof ART;
export function Illustration({ art, className = "h-[88px] w-auto" }: { art: Art; className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 150 110" className={clsx("mx-auto", className)} fill="none" stroke="#6B645A" strokeWidth={1} strokeLinejoin="round" strokeLinecap="round">{ART[art]}</svg>;
}

export function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  const denied = status === 403;
  // Network failures and server faults are worth retrying; a refusal or a validation problem is not.
  const retryable = !denied && (status === 0 || status >= 500);
  return (
    <div role="alert" className="sheet grid justify-items-center gap-2 px-4 py-8 text-center text-sm">
      <Illustration art={denied ? "gembok" : "sobek"} className="h-[72px] w-auto" />
      <p className="font-medium text-ink">{denied ? "Anda tidak punya izin untuk data ini" : "Data tidak bisa dimuat"}</p>
      <p className="max-w-md text-muted">
        {denied ? "Minta administrator menambahkan izin jika Anda memerlukannya." : `${error instanceof Error ? error.message : "Terjadi kesalahan tak terduga."}${retryable ? " Periksa koneksi, lalu coba lagi." : ""}`}
      </p>
      {retry && retryable && <button className="btn btn-sm mt-1" onClick={retry}>Coba lagi</button>}
    </div>
  );
}

/** Empty list: a small drawing, one sentence, one action. */
export function EmptyState({ children, action, art = "map" }: { children: ReactNode; action?: ReactNode; art?: Art }) {
  return (
    <div className="sheet grid justify-items-center gap-3 px-4 py-9 text-center">
      <Illustration art={art} />
      <p className="mx-auto max-w-md text-muted">{children}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

const Bar = ({ className }: { className: string }) => <div className={clsx("sk", className)} />;

/** Placeholder for a document page: title block, stage line, then ruled rows. Same rhythm as the loaded page. */
export function DetailSkeleton() {
  return (
    <div aria-hidden>
      <div className="mb-6 border-b border-ink pb-4"><Bar className="h-7 w-56" /><Bar className="mt-2 h-3.5 w-80 max-w-full" /></div>
      <Bar className="mb-8 h-3.5 w-full max-w-xl" />
      <Skeleton rows={4} />
    </div>
  );
}

/** Loading placeholder that copies the final layout: a ruled sheet with grey bars and a very soft paper sheen. */
export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="sheet px-3">
      <div className="flex gap-6 border-b border-ink py-3"><Bar className="h-3 w-20" /><Bar className="h-3 w-32" /><Bar className="ml-auto h-3 w-16" /></div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-6 border-b border-line py-3.5 last:border-b-0">
          <Bar className="h-3.5 w-28" /><Bar className="h-3.5 flex-1" /><Bar className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}
