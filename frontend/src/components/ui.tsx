import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import type { ReactNode } from "react";

const TONE: Record<string, { tone: "good" | "warn" | "bad" | "info" | "idle"; text: string }> = {
  DRAFT: { tone: "idle", text: "Draft" },
  QUOTATION: { tone: "idle", text: "Quotation" },
  REQUESTED: { tone: "idle", text: "Requested" },
  PENDING_APPROVAL: { tone: "warn", text: "Needs approval" },
  APPROVED: { tone: "info", text: "Approved" },
  CONFIRMED_SO: { tone: "info", text: "Confirmed" },
  IN_TRANSIT: { tone: "info", text: "In transit" },
  PARTIALLY_RECEIVED: { tone: "warn", text: "Part received" },
  RECEIVED: { tone: "good", text: "Received" },
  DELIVERED: { tone: "info", text: "Delivered" },
  BILLED: { tone: "info", text: "Billed" },
  INVOICED: { tone: "info", text: "Invoiced" },
  OPEN: { tone: "info", text: "Open" },
  PARTIALLY_PAID: { tone: "warn", text: "Part paid" },
  PAID: { tone: "good", text: "Paid" },
  POSTED: { tone: "good", text: "Posted" },
  COMPLETED: { tone: "good", text: "Completed" },
  CLOSED: { tone: "idle", text: "Closed" },
  REVERSED: { tone: "bad", text: "Reversed" },
  CANCELLED: { tone: "bad", text: "Cancelled" },
};
const ICON = { good: CheckCircle2, warn: Clock, bad: XCircle, info: Circle, idle: Circle };
const COLOR = { good: "text-good", warn: "text-warn", bad: "text-bad", info: "text-brand", idle: "text-muted" };

/** Status uses icon + text, never colour alone. */
export function Status({ value }: { value: string }) {
  const t = TONE[value] ?? { tone: "idle" as const, text: value };
  const Icon = ICON[t.tone];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap font-medium", COLOR[t.tone])}>
      <Icon size={13} aria-hidden />
      {t.text}
    </span>
  );
}

export function PageHeader({ title, note, actions }: { title: string; note?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {note && <p className="mt-0.5 max-w-prose text-sm text-muted">{note}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-bad/40 bg-bad/5 p-3 text-sm">
      <AlertTriangle size={16} className="mt-0.5 text-bad" aria-hidden />
      <div className="flex-1">
        <p className="font-medium text-bad">Could not load this data</p>
        <p className="text-muted">{error instanceof Error ? error.message : "Unexpected error."}</p>
      </div>
      {retry && (
        <button className="btn h-7" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
