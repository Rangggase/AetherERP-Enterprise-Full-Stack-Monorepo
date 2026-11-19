import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "../components/Layers";
import { toast } from "../components/Toaster";
import { ErrorNote, PageHeader, Skeleton } from "../components/ui";
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
    onSuccess: (_d, v) => { toast(v.action === "close" ? "Periode ditutup." : "Periode dibuka kembali."); refresh(); },
    onError: (e) => toast(e instanceof Error ? e.message : "Periode tidak bisa diubah. Coba lagi.", "error"),
  });
  const closeYear = useMutation({
    mutationFn: (year: number) => api<{ net_income: string }>(`/accounting/year-end/${year}/close`, { method: "POST" }),
    onSuccess: (_d, year) => { toast(`Tahun ${year} ditutup. Laba dipindahkan ke laba ditahan.`); setConfirmYear(null); refresh(); },
    onError: (e) => { toast(e instanceof Error ? e.message : "Tahun tidak bisa ditutup. Coba lagi.", "error"); setConfirmYear(null); },
  });

  const periods = q.data ?? [];
  const years = [...new Set(periods.map((p) => Number(p.code.slice(0, 4))))];
  const allowed = can("accounting.close");

  return (
    <>
      <PageHeader title="Periode fiskal" sub="Tutup bulan secara berurutan setelah pembukuannya final. Penutupan tahun memindahkan saldo pendapatan dan beban ke laba ditahan." />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : q.isLoading ? <Skeleton /> : years.map((y) => {
        const rows = periods.filter((p) => p.code.startsWith(String(y)));
        const ready = rows.slice(0, 11).every((p) => p.status === "CLOSED") && rows[11]?.status === "OPEN";
        const closed = rows.filter((p) => p.status === "CLOSED").length;
        return (
          <section key={y} className="mb-10" aria-label={`Tahun fiskal ${y}`}>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2 border-b border-ink pb-2">
              <div><h2 className="text-table font-semibold">{y}</h2><p className="text-table text-muted">{closed} dari {rows.length} periode ditutup</p></div>
              {allowed && <button className="btn" disabled={!ready} title={ready ? undefined : "Tutup Januari sampai November dulu dan biarkan Desember terbuka"} onClick={() => setConfirmYear(y)}>Tutup tahun fiskal</button>}
            </div>
            <ul>
              {rows.map((p, i) => {
                const prevOpen = rows.slice(0, i).some((x) => x.status === "OPEN");
                const nextClosed = rows.slice(i + 1).some((x) => x.status === "CLOSED");
                const blocked = p.status === "OPEN" ? prevOpen : nextClosed;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-4 border-b border-line py-2">
                    <div>
                      <span className="font-medium">{new Date(p.start_date).toLocaleDateString("id-ID", { month: "long" })}</span>
                      <span className="ml-3 text-table text-muted">sampai {date(p.end_date)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`st ${p.status === "CLOSED" ? "text-muted" : "text-good"}`}>{p.status === "CLOSED" ? "Ditutup" : "Terbuka"}</span>
                      {allowed && (
                        <button className="btn btn-sm" disabled={toggle.isPending || blocked}
                          title={blocked ? (p.status === "OPEN" ? "Tutup bulan sebelumnya dulu" : "Buka kembali bulan berikutnya dulu") : undefined}
                          onClick={() => toggle.mutate({ id: p.id, action: p.status === "OPEN" ? "close" : "reopen" })}>
                          {p.status === "OPEN" ? "Tutup bulan" : "Buka kembali"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <ConfirmDialog open={confirmYear !== null} onClose={() => setConfirmYear(null)} title={`Tutup tahun fiskal ${confirmYear}?`} confirmLabel={`Ya, tutup ${confirmYear}`} danger pending={closeYear.isPending}
        onConfirm={() => confirmYear && closeYear.mutate(confirmYear)}>
        <ul className="list-disc space-y-1 pl-5">
          <li>Jurnal penutup diposting per cabang: pendapatan dan beban dipindahkan ke laba ditahan.</li>
          <li>Desember dikunci dan tidak bisa dibuka kembali.</li>
          <li>Koreksi sesudahnya hanya lewat jurnal pembalik di tahun berikutnya.</li>
        </ul>
      </ConfirmDialog>
    </>
  );
}
