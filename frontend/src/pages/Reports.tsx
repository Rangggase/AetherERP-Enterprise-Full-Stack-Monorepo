import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Field } from "../components/Form";
import { ScrollX } from "../components/ScrollX";
import { TAccount, type GLData } from "../components/signature/TAccount";
import { FolderTabs } from "../components/Tabs";
import { ErrorNote, PageHeader, Skeleton } from "../components/ui";
import { FEATURES } from "../config/features";
import { api } from "../lib/api";
import { date, num, rupiah, today } from "../lib/format";
import { openJournal } from "../lib/journals";
import { useSession } from "../lib/session";
import { play } from "../motion/animate";
import { cssVar } from "../motion/tokens";
import "../styles/tables.css";

type Row = Record<string, any>;
type Tab = "tb" | "is" | "bs" | "ar" | "ap" | "gl";
const TABS: [Tab, string][] = [["tb", "Neraca saldo"], ["is", "Laba rugi"], ["bs", "Neraca"], ["ar", "Umur piutang"], ["ap", "Umur utang"], ["gl", "Buku besar"]];
const yearStart = () => `${new Date().getFullYear()}-01-01`;

/** Kolom pertama tetap terlihat saat angka digeser di layar sempit. */
const FIRST = "max-md:sticky max-md:left-0 max-md:z-sticky max-md:max-w-[10rem] bg-paper max-md:shadow-[6px_0_6px_-6px_rgb(var(--ink)/0.25)]";
const th = "border-b border-ink bg-paper px-3 py-2 font-medium text-muted";

/** Angka laporan: nol sebagai tanda pisah, negatif dalam kurung (akun kontra mengurangi kelompoknya). */
function Money({ v, bold }: { v: string | number; bold?: boolean }) {
  const n = num(v);
  return <td className={`num whitespace-nowrap px-3 py-2 ${bold ? "font-semibold" : ""}`}>{n === 0 ? "–" : n < 0 ? `(${rupiah(-n, true)})` : rupiah(n, true)}</td>;
}

function Section({ title, rows, total, onAccount }: { title: string; rows: Row[]; total: string; onAccount: (code: string) => void }) {
  return (
    <>
      <tr><th colSpan={2} className="border-b border-ink px-3 pb-1 pt-4 text-left text-table font-semibold">{title}</th></tr>
      {rows.map((r) => (
        <tr key={r.code} className="border-b border-line">
          <td className={`px-3 py-2 pl-6 ${FIRST}`}>
            <button type="button" className="text-left hover:underline" onClick={() => onAccount(r.code)} title="Buka buku besar akun ini"><span className="code text-muted">{r.code}</span> {r.name}</button>
            {num(r.balance) < 0 && r.normal_balance !== (r.account_type === "REVENUE" ? "CREDIT" : "DEBIT") && <span className="ml-2 text-xs text-muted">akun kontra, mengurangi</span>}
          </td>
          <Money v={r.balance} />
        </tr>
      ))}
      <tr className="sub"><td className={`px-3 py-2 font-semibold ${FIRST}`}>Total {title.toLowerCase()}</td><Money v={total} bold /></tr>
    </>
  );
}

const Balanced = ({ ok, label }: { ok: boolean; label: string }) => (
  <p className={`mb-2 text-table font-medium ${ok ? "text-good" : "text-bad"}`} role={ok ? undefined : "alert"}><span className="st">{label}</span></p>
);

/**
 * Laporan keuangan (10): kertas buku besar dengan garis margin. Subtotal satu garis, total garis ganda. Akun kontra (misalnya 4150)
 * tampil dalam kurung. Klik akun membuka buku besar akun itu. Berganti periode menggeser halaman --page-shift dengan rotateY --page-tilt.
 */
export function Reports() {
  const { branchId } = useSession();
  // Status laporan ada di URL (pedoman: URL mencerminkan status), jadi tampilan bisa dibagikan dan dibuka ulang.
  const [sp, setSp] = useSearchParams();
  const set = (patch: Record<string, string>) => setSp((p) => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) n.set(k, v); return n; }, { replace: true });
  const tab = (TABS.find(([k]) => k === sp.get("laporan"))?.[0] ?? "tb") as Tab;
  const from = sp.get("dari") ?? yearStart();
  const to = sp.get("sampai") ?? today();
  const acct = sp.get("akun") ?? "1100";
  const glView: "buku" | "t" = sp.get("tampilan") === "t" ? "t" : "buku";
  const setTab = (k: Tab) => set({ laporan: k });
  const setFrom = (v: string) => set({ dari: v });
  const setTo = (v: string) => set({ sampai: v });
  const setAcct = (v: string) => set({ akun: v });
  const setGlView = (v: "buku" | "t") => set({ tampilan: v });
  const paper = useRef<HTMLDivElement>(null);
  const params = { branch_id: branchId };
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Row[]>("/accounting/accounts"), enabled: tab === "gl" });
  const parties = useQuery({ queryKey: ["parties", tab], enabled: tab === "ar" || tab === "ap", queryFn: () => api<Row[]>(tab === "ar" ? "/master/customers" : "/master/suppliers") });

  const q = useQuery({
    queryKey: ["report", tab, from, to, acct, branchId],
    queryFn: () => {
      switch (tab) {
        case "tb": return api<Row>("/accounting/reports/trial-balance", { params: { ...params, as_of: to } });
        case "is": return api<Row>("/accounting/reports/income-statement", { params: { ...params, start: from, end: to } });
        case "bs": return api<Row>("/accounting/reports/balance-sheet", { params: { ...params, as_of: to } });
        case "gl": return api<Row>("/accounting/reports/general-ledger", { params: { ...params, account_code: acct, start: from, end: to } });
        default: return api<Row>(`/accounting/reports/aging/${tab}`, { params: { ...params, as_of: to } });
      }
    },
  });

  // Perpindahan periode: halaman bergeser seperti lembar yang dibalik (posisi dan sudut dari token; nol pada mode Dikurangi).
  const period = `${from}|${to}`;
  const prev = useRef(period);
  useEffect(() => {
    if (prev.current === period || !q.data) return;
    const back = period < prev.current;
    prev.current = period;
    const shift = cssVar("page-shift"), tilt = cssVar("page-tilt");
    play(paper.current, [{ transform: `perspective(1200px) translateX(${back ? "-" : ""}${shift}) rotateY(${back ? "" : "-"}${tilt})`, opacity: 0.6 }, { transform: "none", opacity: 1 }], { duration: "dur-base", easing: "out" });
  }, [period, q.data]);

  const d = q.data;
  const ranged = tab === "is" || tab === "gl";
  const openAccount = (code: string) => set({ akun: code, laporan: "gl" });
  const partyName = (id: number) => (parties.data ?? []).find((p) => p.id === id)?.name ?? `${tab === "ar" ? "Pelanggan" : "Pemasok"} #${id}`;

  return (
    <>
      <PageHeader title="Laporan keuangan" sub="Dihitung langsung dari jurnal yang sudah diposting, per cabang atau untuk seluruh perusahaan." />
      <FolderTabs tabs={TABS.map(([k, label]) => ({ key: k, label, glyph: k === "gl" ? "buku-besar" as const : "laporan" as const }))} active={tab} onChange={setTab} label="Laporan" className="">
        <div className="mb-5 flex flex-wrap items-end gap-3 print:hidden">
          {ranged && <Field label="Dari"><input type="date" name="from" className="field" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>}
          <Field label={ranged ? "Sampai" : "Per tanggal"}><input type="date" name="to" className="field" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          {tab === "gl" && (
            <Field label="Akun" className="min-w-0">
              <select className="field" name="account" value={acct} onChange={(e) => setAcct(e.target.value)}>
                {(accounts.data ?? []).map((a) => (<option key={a.code} value={a.code}>{a.code} {a.name}</option>))}
              </select>
            </Field>
          )}
          {tab === "gl" && FEATURES.tAccount && (
            <div role="group" aria-label="Tampilan buku besar" className="seg mb-1 ml-auto">
              {(["buku", "t"] as const).map((v) => <button key={v} type="button" aria-pressed={glView === v} onClick={() => setGlView(v)}>{v === "buku" ? "Buku besar" : "Akun T"}</button>)}
            </div>
          )}
          <button type="button" className="btn btn-text btn-sm mb-1" onClick={() => window.print()}>Cetak laporan</button>
        </div>

        {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : q.isLoading || !d ? <Skeleton /> : (
          <div ref={paper} className="doc-paper ledger-paper">
            <p className="mb-3 hidden font-serif text-lg font-medium print:block">
              {TABS.find(([k]) => k === tab)?.[1]}{tab === "gl" ? ` ${acct}` : ""} · {ranged ? `${date(from)} sampai ${date(to)}` : `per ${date(to)}`}{branchId ? " · satu cabang" : " · semua cabang"}
            </p>
            {tab === "tb" && (<>
              <Balanced ok={d.balanced} label={d.balanced ? "Debit sama dengan kredit" : "Debit dan kredit berbeda"} />
              <ScrollX>
                <table className="tbl ledger min-w-[560px]" aria-label={`Neraca saldo per ${date(to)}`}>
                  <thead><tr><th className={`${th} text-left ${FIRST}`}>Akun</th><th className={`${th} text-right`}>Debit</th><th className={`${th} text-right`}>Kredit</th></tr></thead>
                  <tbody>
                    {d.rows.map((r: Row) => (<tr key={r.code} className="border-b border-line"><td className={`px-3 py-2 ${FIRST}`}><button type="button" className="text-left hover:underline" onClick={() => openAccount(r.code)}><span className="code text-muted">{r.code}</span> {r.name}</button></td><Money v={r.debit_balance} /><Money v={r.credit_balance} /></tr>))}
                    <tr className="total font-semibold"><td className={`px-3 py-2 ${FIRST}`}>Total</td><Money v={d.total_debit} bold /><Money v={d.total_credit} bold /></tr>
                  </tbody>
                </table>
              </ScrollX></>)}

            {tab === "is" && (
              <ScrollX>
                <table className="tbl ledger min-w-[480px]" aria-label={`Laba rugi ${date(from)} sampai ${date(to)}`}><tbody>
                  <Section title="Pendapatan" rows={d.revenue.rows} total={d.revenue.total} onAccount={openAccount} />
                  <Section title="Harga pokok penjualan" rows={d.cogs.rows} total={d.cogs.total} onAccount={openAccount} />
                  <tr className="sub"><td className={`px-3 py-2 font-semibold ${FIRST}`}>Laba kotor <span className="font-normal text-muted">(margin {num(d.gross_margin_pct).toFixed(1).replace(".", ",")}%)</span></td><Money v={d.gross_profit} bold /></tr>
                  <Section title="Beban operasional" rows={d.operating_expenses.rows} total={d.operating_expenses.total} onAccount={openAccount} />
                  <tr className="total"><td className={`px-3 py-3 font-serif text-lg ${FIRST}`}>Laba bersih</td><Money v={d.net_income} bold /></tr>
                </tbody></table>
              </ScrollX>)}

            {tab === "bs" && (<>
              <Balanced ok={d.balanced} label={d.balanced ? "Aset sama dengan kewajiban ditambah ekuitas" : "Neraca tidak seimbang"} />
              <ScrollX>
                <table className="tbl ledger min-w-[480px]" aria-label={`Neraca per ${date(to)}`}><tbody>
                  <Section title="Aset" rows={d.assets.rows} total={d.assets.total} onAccount={openAccount} />
                  <Section title="Kewajiban" rows={d.liabilities.rows} total={d.liabilities.total} onAccount={openAccount} />
                  <tr><th colSpan={2} className="border-b border-ink px-3 pb-1 pt-4 text-left text-table font-semibold">Ekuitas</th></tr>
                  {d.equity.rows.map((r: Row) => (<tr key={r.code} className="border-b border-line"><td className={`px-3 py-2 pl-6 ${FIRST}`}><button type="button" className="text-left hover:underline" onClick={() => openAccount(r.code)}><span className="code text-muted">{r.code}</span> {r.name}</button></td><Money v={r.balance} /></tr>))}
                  <tr className="border-b border-line"><td className={`px-3 py-2 pl-6 ${FIRST}`}>Laba periode berjalan</td><Money v={d.equity.current_earnings} /></tr>
                  <tr className="total"><td className={`px-3 py-2 font-semibold ${FIRST}`}>Total ekuitas</td><Money v={d.equity.total} bold /></tr>
                </tbody></table>
              </ScrollX></>)}

            {(tab === "ar" || tab === "ap") && (
              <ScrollX>
                <table className="tbl ledger min-w-[720px]" aria-label={`Umur ${tab === "ar" ? "piutang" : "utang"} per ${date(to)}`}>
                  <thead><tr>{["Pihak", "Belum jatuh tempo", "Terlambat 1–30 hari", "31–60", "61–90", "Lebih dari 90", "Total"].map((h, i) => (<th key={h} className={`${th} ${i ? "text-right" : `text-left ${FIRST}`}`}>{h}</th>))}</tr></thead>
                  <tbody>
                    {d.rows.map((r: Row) => (<tr key={r.party_id} className="border-b border-line"><td className={`px-3 py-2 ${FIRST}`}>{partyName(r.party_id)}</td>
                      <Money v={r.not_due} /><Money v={r.d0_30} /><Money v={r.d31_60} /><Money v={r.d61_90} /><Money v={r.d90_plus} /><Money v={r.total} bold /></tr>))}
                    {d.rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">Tidak ada yang belum dibayar per tanggal ini.</td></tr>}
                    <tr className="total font-semibold"><td className={`px-3 py-2 ${FIRST}`}>Total</td><Money v={d.totals.not_due} bold /><Money v={d.totals.d0_30} bold /><Money v={d.totals.d31_60} bold /><Money v={d.totals.d61_90} bold /><Money v={d.totals.d90_plus} bold /><Money v={d.totals.total} bold /></tr>
                  </tbody>
                </table>
              </ScrollX>)}

            {tab === "gl" && glView === "t" && FEATURES.tAccount && <div className="sheet px-4 py-5 md:px-8"><TAccount key={`${acct}-${from}-${to}`} gl={d as GLData} /></div>}
            {tab === "gl" && (glView === "buku" || !FEATURES.tAccount) && (
              <ScrollX>
                <table className="tbl ledger min-w-[720px]" aria-label={`Buku besar ${acct}`}>
                  <thead><tr><th className={`${th} text-left ${FIRST}`}>Tanggal</th><th className={`${th} text-left`}>Jurnal</th><th className={`${th} text-left`}>Keterangan</th><th className={`${th} text-right`}>Debit</th><th className={`${th} text-right`}>Kredit</th><th className={`${th} text-right`}>Saldo</th></tr></thead>
                  <tbody>
                    <tr className="border-b border-line"><td colSpan={5} className={`px-3 py-2 ${FIRST}`}>Saldo awal</td><Money v={d.opening_balance} bold /></tr>
                    {d.lines.map((l: Row, i: number) => (
                      <tr key={i} className="border-b border-line"><td className={`whitespace-nowrap px-3 py-2 ${FIRST}`}>{date(l.date)}</td>
                        <td className="whitespace-nowrap px-3"><button type="button" className="code hover:underline" onClick={() => openJournal({ entryNo: l.entry_no, date: l.date })}>{l.entry_no}</button></td>
                        <td className="px-3">{l.description}</td><Money v={l.debit} /><Money v={l.credit} /><Money v={l.balance} /></tr>
                    ))}
                    <tr className="total font-semibold"><td colSpan={5} className={`px-3 py-2 ${FIRST}`}>Saldo akhir</td><Money v={d.closing_balance} bold /></tr>
                  </tbody>
                </table>
              </ScrollX>)}
          </div>
        )}
      </FolderTabs>
    </>
  );
}
