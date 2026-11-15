import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "../components/Toaster";
import { ErrorNote, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { date } from "../lib/format";
import { useSession } from "../lib/session";
import type { Period } from "../lib/types";

export function Periods() {
  const { can } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["periods"], queryFn: () => api<Period[]>("/accounting/periods") });
  const [confirmYear, setConfirmYear] = useState<number | null>(null);
  const refresh = () => { for (const k of ["periods", "journals", "overview", "report"]) void qc.invalidateQueries({ queryKey: [k] }); };
  const toggle = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "close" | "reopen" }) => api(`/accounting/periods/${id}/${action}`, { method: "POST" }),
    onSuccess: (_d, v) => { toast(v.action === "close" ? "Period closed." : "Period reopened."); refresh(); },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not change the period.", "error"),
  });
  const closeYear = useMutation({
    mutationFn: (year: number) => api<{ net_income: string }>(`/accounting/year-end/${year}/close`, { method: "POST" }),
    onSuccess: (_d, year) => { toast(`Year ${year} closed. Profit moved to retained earnings.`); setConfirmYear(null); refresh(); },
    onError: (e) => { toast(e instanceof Error ? e.message : "Could not close the year.", "error"); setConfirmYear(null); },
  });

  const periods = q.data ?? [];
  const years = [...new Set(periods.map((p) => Number(p.code.slice(0, 4))))];
  const allowed = can("accounting.close");

  return (
    <>
      <PageHeader title="Fiscal periods" note="Close months in order once their books are final. Closing the year clears revenue and expense accounts into retained earnings." />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : q.isLoading ? <div className="h-48 animate-pulse rounded-lg bg-sunken" /> : years.map((y) => {
        const rows = periods.filter((p) => p.code.startsWith(String(y)));
        const ready = rows.slice(0, 11).every((p) => p.status === "CLOSED") && rows[11]?.status === "OPEN";
        return (
          <section key={y} className="mb-6" aria-label={`Fiscal year ${y}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{y}</h2>
              {allowed && (confirmYear === y ? (
                <div className="flex items-center gap-2 text-sm" role="alertdialog" aria-label={`Confirm closing ${y}`}>
                  <span>Post closing entries and lock December? This cannot be reopened.</span>
                  <button className="btn" onClick={() => setConfirmYear(null)}>Keep open</button>
                  <button className="btn btn-primary" disabled={closeYear.isPending} onClick={() => closeYear.mutate(y)}>{closeYear.isPending ? "Closing…" : `Close ${y}`}</button>
                </div>
              ) : (
                <button className="btn" disabled={!ready} title={ready ? undefined : "Close January to November first and keep December open"} onClick={() => setConfirmYear(y)}>Close fiscal year</button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((p, i) => {
                const prevOpen = rows.slice(0, i).some((x) => x.status === "OPEN");
                const nextClosed = rows.slice(i + 1).some((x) => x.status === "CLOSED");
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2.5">
                    <div>
                      <p className="font-medium">{new Date(p.start_date).toLocaleDateString("id-ID", { month: "long" })}</p>
                      <p className="flex items-center gap-1 text-xs text-muted">
                        {p.status === "CLOSED" ? <Lock size={12} aria-hidden /> : <LockOpen size={12} aria-hidden />}
                        {p.status === "CLOSED" ? "Closed" : "Open"} · to {date(p.end_date)}
                      </p>
                    </div>
                    {allowed && (
                      <button
                        className="btn h-7 px-2 text-xs"
                        disabled={toggle.isPending || (p.status === "OPEN" ? prevOpen : nextClosed)}
                        title={p.status === "OPEN" ? (prevOpen ? "Close earlier months first" : undefined) : nextClosed ? "Reopen later months first" : undefined}
                        onClick={() => toggle.mutate({ id: p.id, action: p.status === "OPEN" ? "close" : "reopen" })}
                      >
                        {p.status === "OPEN" ? "Close" : "Reopen"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
