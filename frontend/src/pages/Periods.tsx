import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Glyph } from "../components/glyphs";
import { ConfirmDialog } from "../components/Layers";
import { receipt, toast } from "../components/Toaster";
import { Cap, ErrorNote, PageHeader, Skeleton } from "../components/ui";
import { FEATURES } from "../config/features";
import { api } from "../lib/api";
import { date, rupiah } from "../lib/format";
import { useSession } from "../lib/session";
import type { Page, Period } from "../lib/types";
import { play } from "../motion/animate";
import { chime } from "../motion/sound";
import "./Periods.css";

const monthName = (p: Period) => new Date(p.start_date + "T00:00:00").toLocaleDateString("id-ID", { month: "long" });

/** Ringkasan dampak dari data yang ada: jumlah jurnal dan laba periode itu (dialog berbahaya M10). */
function useImpact(p: Period | null, branchId: number | null) {
  return useQuery({
    queryKey: ["period-impact", p?.id, branchId],
    enabled: !!p,
    queryFn: async () => {
      const [j, is] = await Promise.all([
        api<Page<unknown>>("/accounting/journals", { params: { start: p!.start_date, end: p!.end_date, page_size: 1, branch_id: branchId } }),
        api<{ net_income: string }>("/accounting/reports/income-statement", { params: { start: p!.start_date, end: p!.end_date, branch_id: branchId } }),
      ]);
      return { journals: j.total, net: is.net_income };
    },
  });
}

/**
 * Periode (10) sebagai deretan buku: terbuka (sampul sedikit terbuka) atau tertutup (sampul rata, cap DITUTUP dengan gembok).
 * M10 Tutup Buku: dialog berbahaya menjelaskan akibatnya dengan angka; setelah respons sukses sampul menutup (rotateY, perspektif
 * 1.200 px, --dur-draw), cap mendarat, dan cap periode di bilah atas ikut berganti. Hanya diuji di database uji.
 */
export function Periods() {
  const { can, branchId } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["periods"], queryFn: () => api<Period[]>("/accounting/periods") });
  const [confirmYear, setConfirmYear] = useState<number | null>(null);
  const [closing, setClosing] = useState<Period | null>(null);
  const [landed, setLanded] = useState<number | null>(null);
  const covers = useRef(new Map<number, HTMLDivElement>());
  const impact = useImpact(closing, branchId);
  const refresh = () => { for (const k of ["periods", "journals", "overview", "report", "dash"]) void qc.invalidateQueries({ queryKey: [k] }); };

  const toggle = useMutation({
    mutationFn: ({ p, action }: { p: Period; action: "close" | "reopen" }) => api<Period>(`/accounting/periods/${p.id}/${action}`, { method: "POST" }),
    onSuccess: (res, v) => {
      if (v.action === "close") {
        setClosing(null);
        setLanded(res.id);
        // Sampul menutup dari posisi terbuka ke rata; keadaan akhir dirender oleh data periode yang baru.
        if (FEATURES.closeBook) play(covers.current.get(res.id), [{ transform: "rotateY(-28deg)" }, { transform: "rotateY(0deg)" }], { duration: "dur-draw", easing: "inout", reduced: null });
        chime("tutup-buku");
        receipt({ title: "Periode ditutup", number: res.code, lines: [{ label: "Status", value: "Ditutup" }, { label: "Sampai", value: date(res.end_date) }], note: "Jurnal dengan tanggal di periode ini tidak bisa diposting lagi." });
      } else {
        toast(`Periode ${res.code} dibuka kembali.`);
      }
      qc.setQueryData<Period[]>(["periods"], (list) => list?.map((p) => (p.id === res.id ? { ...p, status: res.status } : p)));
      refresh();
    },
    onError: (e) => { setClosing(null); toast(e instanceof Error ? e.message : "Periode tidak bisa diubah. Coba lagi.", "error"); },
  });
  const closeYear = useMutation({
    mutationFn: (year: number) => api<{ net_income: string; entries: number }>(`/accounting/year-end/${year}/close`, { method: "POST" }),
    onSuccess: (r, year) => { receipt({ title: `Tahun ${year} ditutup`, lines: [{ label: "Jurnal penutup", value: String(r.entries) }, { label: "Laba dipindahkan", value: rupiah(r.net_income, true) }] }); setConfirmYear(null); refresh(); },
    onError: (e) => { toast(e instanceof Error ? e.message : "Tahun tidak bisa ditutup. Coba lagi.", "error"); setConfirmYear(null); },
  });

  const periods = q.data ?? [];
  const years = [...new Set(periods.map((p) => Number(p.code.slice(0, 4))))];
  const allowed = can("accounting.close");
  const closedAll = periods.filter((p) => p.status === "CLOSED").length;

  return (
    <>
      <PageHeader title="Periode fiskal" sub={q.data ? `${closedAll} dari ${periods.length} periode ditutup. Tutup bulan berurutan setelah pembukuannya final.` : "Memuat periode…"} />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : q.isLoading ? <Skeleton rows={3} /> : years.map((y) => {
        const rows = periods.filter((p) => p.code.startsWith(String(y)));
        const ready = rows.slice(0, 11).every((p) => p.status === "CLOSED") && rows[11]?.status === "OPEN";
        const closed = rows.filter((p) => p.status === "CLOSED").length;
        return (
          <section key={y} className="mb-10" aria-label={`Tahun fiskal ${y}`}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-ink pb-2">
              <div><h2 className="font-serif text-lg font-medium">{y}</h2><p className="text-table text-muted">{closed} dari {rows.length} buku ditutup</p></div>
              {allowed && <button className="btn" disabled={!ready} title={ready ? undefined : "Tutup Januari sampai November dulu dan biarkan Desember terbuka"} onClick={() => setConfirmYear(y)}>Tutup tahun fiskal</button>}
            </div>
            <ul className="books">
              {rows.map((p, i) => {
                const prevOpen = rows.slice(0, i).some((x) => x.status === "OPEN");
                const nextClosed = rows.slice(i + 1).some((x) => x.status === "CLOSED");
                const blocked = p.status === "OPEN" ? prevOpen : nextClosed;
                const open = p.status === "OPEN";
                return (
                  <li key={p.id} className="grid gap-2">
                    <div className="book" data-state={open ? "open" : "closed"} aria-label={`${monthName(p)} ${y}: ${open ? "terbuka" : "ditutup"}`} role="img">
                      <div className="book-pages" aria-hidden="true" />
                      <div className="book-cover" aria-hidden="true" ref={(el) => { if (el) covers.current.set(p.id, el); else covers.current.delete(p.id); }}>
                        <div><p className="month">{monthName(p)}</p><p className="text-xs text-muted">{y}</p></div>
                        {open ? <p className="flex items-center gap-1 text-xs font-medium text-good"><Glyph name="buku-terbuka" size={14} />Terbuka</p>
                          : <Cap small value="CLOSED" seed={p.code} label="Ditutup" glyph="gembok" land={landed === p.id} className="justify-self-start" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted">sampai {date(p.end_date)}</p>
                    {allowed && (
                      <button className="btn btn-sm" disabled={toggle.isPending || blocked}
                        title={blocked ? (open ? "Tutup bulan sebelumnya dulu" : "Buka kembali bulan berikutnya dulu") : undefined}
                        onClick={() => (open ? setClosing(p) : toggle.mutate({ p, action: "reopen" }))}>
                        {open ? "Tutup buku" : "Buka kembali"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <ConfirmDialog open={closing !== null} onClose={() => setClosing(null)} title={`Tutup buku ${closing ? `${monthName(closing)} ${closing.code.slice(0, 4)}` : ""}?`} confirmLabel="Ya, tutup buku" danger pending={toggle.isPending}
        impact={impact.data ? [["Jurnal di periode ini", String(impact.data.journals)], ["Laba bersih periode", rupiah(impact.data.net, true)], ["Cabang", branchId ? "cabang terpilih" : "semua cabang"]] : [["Ringkasan", impact.isLoading ? "Menghitung…" : "Tidak tersedia"]]}
        onConfirm={() => closing && toggle.mutate({ p: closing, action: "close" })}>
        <ul className="list-disc space-y-1 pl-5">
          <li>Jurnal bertanggal di periode ini tidak bisa diposting lagi.</li>
          <li>Periode bisa dibuka kembali selama tahunnya belum ditutup dan periode sesudahnya masih terbuka.</li>
        </ul>
      </ConfirmDialog>
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
