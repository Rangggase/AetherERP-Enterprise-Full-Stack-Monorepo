import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

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
const STYLE: Record<Tone, string> = { good: "text-good", warn: "text-warn", bad: "text-bad", info: "text-info", idle: "text-muted" };

export const statusText = (value: string): string => TONE[value]?.text ?? value;

/** A status is a square mark plus a word in the status colour: never colour alone, never a pill. */
export function Status({ value }: { value: string }) {
  const t = TONE[value] ?? { tone: "idle" as const, text: value };
  return <span className={clsx("st", STYLE[t.tone])}>{t.text}</span>;
}

export function PageHeader({ title, sub, note, actions }: { title: string; sub?: string; note?: string; actions?: ReactNode }) {
  const line = sub ?? note;
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-ink pb-4">
      <div className="min-w-0">
        <h1 className="font-serif text-xl font-medium tracking-[-0.005em] max-md:text-[26px] max-md:leading-8">{title}</h1>
        {line && <p className="mt-1 max-w-prose text-table text-muted">{line}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-table font-semibold">{children}</h2>;
}

export function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 border-y border-bad py-3 text-sm">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-bad" aria-hidden />
      <div className="flex-1">
        <p className="font-medium text-bad">Data tidak bisa dimuat</p>
        <p className="text-muted">{error instanceof Error ? error.message : "Terjadi kesalahan tak terduga."} Periksa koneksi, lalu coba lagi.</p>
      </div>
      {retry && <button className="btn btn-sm" onClick={retry}>Coba lagi</button>}
    </div>
  );
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-y border-line py-10 text-center">
      {/* One colour, 1 px line, no fill: an open box and a blank ledger sheet. Decorative. */}
      <svg aria-hidden viewBox="0 0 200 120" className="mx-auto mb-3 h-24 w-auto" fill="none" stroke="#6B645A" strokeWidth={1} strokeLinejoin="round" strokeLinecap="round">
        <path d="M30 78 L100 113 L170 78 L100 43 Z" strokeDasharray="3 3" />
        <path d="M56 66 V92 L100 114 V88 Z M100 88 V114 L144 92 V66 Z" />
        <path d="M56 66 L100 88 L144 66 L100 44 Z" />
        <path d="M56 66 L40 56 L84 34 L100 44 M144 66 L160 56 L116 34 L100 44" />
        <path d="M76 62 L100 50 L124 62 L100 74 Z" />
        <path d="M84 62 L100 54 M92 66 L108 58" />
      </svg>
      <p className="mx-auto max-w-md text-muted">{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Loading placeholder that copies the final layout: ruled lines and grey bars. */
export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="border-t border-ink">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-6 border-b border-line py-3.5">
          <div className="h-3.5 w-28 animate-pulse bg-sunken" /><div className="h-3.5 flex-1 animate-pulse bg-sunken" /><div className="h-3.5 w-20 animate-pulse bg-sunken" />
        </div>
      ))}
    </div>
  );
}
