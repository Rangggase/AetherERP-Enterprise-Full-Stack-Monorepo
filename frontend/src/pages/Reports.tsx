import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { ErrorNote, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { date, num, rupiah, today } from "../lib/format";
import { useSession } from "../lib/session";

type Row = Record<string, any>;
const TABS = [
  ["tb", "Trial balance"], ["is", "Income statement"], ["bs", "Balance sheet"], ["ar", "Receivables aging"], ["ap", "Payables aging"], ["gl", "General ledger"],
] as const;

const yearStart = () => `${new Date().getFullYear()}-01-01`;

function Money({ v, bold }: { v: string | number; bold?: boolean }) {
  return <td className={`px-3 py-1.5 text-right tabular-nums ${bold ? "font-semibold" : ""}`}>{num(v) === 0 ? "–" : rupiah(v, true)}</td>;
}

function Section({ title, rows, total }: { title: string; rows: Row[]; total: string }) {
  return (
    <>
      <tr className="bg-sunken"><th colSpan={2} className="px-3 py-1.5 text-left font-semibold">{title}</th></tr>
      {rows.map((r) => (<tr key={r.code} className="border-b border-line/60"><td className="px-3 py-1.5 pl-6"><span className="text-muted">{r.code}</span> {r.name}</td><Money v={r.balance} /></tr>))}
      <tr className="border-b border-line"><td className="px-3 py-1.5 font-semibold">Total {title.toLowerCase()}</td><Money v={total} bold /></tr>
    </>
  );
}

function Balanced({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className={`mb-3 inline-flex items-center gap-1.5 text-sm font-medium ${ok ? "text-good" : "text-bad"}`}>
      {ok ? <CheckCircle2 size={15} aria-hidden /> : <XCircle size={15} aria-hidden />}{label}
    </p>
  );
}

export function Reports() {
  const { branchId } = useSession();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("tb");
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(today());
  const [acct, setAcct] = useState("1100");
  const params = { branch_id: branchId };
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Row[]>("/accounting/accounts"), enabled: tab === "gl" });

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
  const d = q.data;
  const ranged = tab === "is" || tab === "gl";

  return (
    <>
      <PageHeader title="Financial reports" note="Computed live from posted journal entries for the selected branch or the whole company." />
      <div role="tablist" aria-label="Report" className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-brand font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>{label}</button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        {ranged && <label>From<input type="date" className="field mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>}
        <label>{ranged ? "To" : "As of"}<input type="date" className="field mt-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {tab === "gl" && (
          <label>Account
            <select className="field mt-1" value={acct} onChange={(e) => setAcct(e.target.value)}>
              {(accounts.data ?? []).map((a) => (<option key={a.code} value={a.code}>{a.code} {a.name}</option>))}
            </select>
          </label>
        )}
      </div>

      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : q.isLoading || !d ? <div className="h-48 animate-pulse rounded-lg bg-sunken" /> : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface p-1">
          {tab === "tb" && (<>
            <div className="p-3 pb-0"><Balanced ok={d.balanced} label={d.balanced ? "Debits equal credits" : "Debits and credits differ"} /></div>
            <table className="w-full min-w-[560px] text-sm" aria-label="Trial balance">
              <thead><tr className="text-muted"><th className="px-3 py-2 text-left font-medium">Account</th><th className="px-3 text-right font-medium">Debit</th><th className="px-3 text-right font-medium">Credit</th></tr></thead>
              <tbody>
                {d.rows.map((r: Row) => (<tr key={r.code} className="border-t border-line/60"><td className="px-3 py-1.5"><span className="text-muted">{r.code}</span> {r.name}</td><Money v={r.debit_balance} /><Money v={r.credit_balance} /></tr>))}
                <tr className="border-t border-line font-semibold"><td className="px-3 py-2">Total</td><Money v={d.total_debit} bold /><Money v={d.total_credit} bold /></tr>
              </tbody>
            </table></>)}

          {tab === "is" && (
            <table className="w-full min-w-[480px] text-sm" aria-label="Income statement"><tbody>
              <Section title="Revenue" rows={d.revenue.rows} total={d.revenue.total} />
              <Section title="Cost of goods sold" rows={d.cogs.rows} total={d.cogs.total} />
              <tr className="border-b border-line bg-sunken"><td className="px-3 py-2 font-semibold">Gross profit <span className="font-normal text-muted">({num(d.gross_margin_pct).toFixed(1)}% margin)</span></td><Money v={d.gross_profit} bold /></tr>
              <Section title="Operating expenses" rows={d.operating_expenses.rows} total={d.operating_expenses.total} />
              <tr className="bg-sunken"><td className="px-3 py-2 text-base font-semibold">Net income</td><Money v={d.net_income} bold /></tr>
            </tbody></table>)}

          {tab === "bs" && (<>
            <div className="p-3 pb-0"><Balanced ok={d.balanced} label={d.balanced ? "Assets equal liabilities plus equity" : "Balance sheet does not balance"} /></div>
            <table className="w-full min-w-[480px] text-sm" aria-label="Balance sheet"><tbody>
              <Section title="Assets" rows={d.assets.rows} total={d.assets.total} />
              <Section title="Liabilities" rows={d.liabilities.rows} total={d.liabilities.total} />
              <tr className="bg-sunken"><th colSpan={2} className="px-3 py-1.5 text-left font-semibold">Equity</th></tr>
              {d.equity.rows.map((r: Row) => (<tr key={r.code} className="border-b border-line/60"><td className="px-3 py-1.5 pl-6"><span className="text-muted">{r.code}</span> {r.name}</td><Money v={r.balance} /></tr>))}
              <tr className="border-b border-line/60"><td className="px-3 py-1.5 pl-6">Current period earnings</td><Money v={d.equity.current_earnings} /></tr>
              <tr><td className="px-3 py-1.5 font-semibold">Total equity</td><Money v={d.equity.total} bold /></tr>
            </tbody></table></>)}

          {(tab === "ar" || tab === "ap") && (
            <table className="w-full min-w-[640px] text-sm" aria-label="Aging report">
              <thead><tr className="text-muted">{["Party", "Not yet due", "1–30 days late", "31–60", "61–90", "Over 90", "Total"].map((h, i) => (<th key={h} className={`px-3 py-2 font-medium ${i ? "text-right" : "text-left"}`}>{h}</th>))}</tr></thead>
              <tbody>
                {d.rows.map((r: Row) => (<tr key={r.party_id} className="border-t border-line/60"><td className="px-3 py-1.5">{tab === "ar" ? "Customer" : "Supplier"} #{r.party_id}</td>
                  <Money v={r.not_due} /><Money v={r.d0_30} /><Money v={r.d31_60} /><Money v={r.d61_90} /><Money v={r.d90_plus} /><Money v={r.total} bold /></tr>))}
                {d.rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">Nothing outstanding as of this date.</td></tr>}
                <tr className="border-t border-line font-semibold"><td className="px-3 py-2">Total</td><Money v={d.totals.not_due} bold /><Money v={d.totals.d0_30} bold /><Money v={d.totals.d31_60} bold /><Money v={d.totals.d61_90} bold /><Money v={d.totals.d90_plus} bold /><Money v={d.totals.total} bold /></tr>
              </tbody>
            </table>)}

          {tab === "gl" && (
            <table className="w-full min-w-[640px] text-sm" aria-label="General ledger">
              <thead><tr className="text-muted"><th className="px-3 py-2 text-left font-medium">Date</th><th className="px-3 text-left font-medium">Entry</th><th className="px-3 text-left font-medium">Description</th><th className="px-3 text-right font-medium">Debit</th><th className="px-3 text-right font-medium">Credit</th><th className="px-3 text-right font-medium">Balance</th></tr></thead>
              <tbody>
                <tr className="border-t border-line/60 bg-sunken"><td colSpan={5} className="px-3 py-1.5">Opening balance</td><Money v={d.opening_balance} bold /></tr>
                {d.lines.map((l: Row, i: number) => (<tr key={i} className="border-t border-line/60"><td className="px-3 py-1.5">{date(l.date)}</td><td className="px-3">{l.entry_no}</td><td className="px-3">{l.description}</td><Money v={l.debit} /><Money v={l.credit} /><Money v={l.balance} /></tr>))}
                <tr className="border-t border-line bg-sunken font-semibold"><td colSpan={5} className="px-3 py-2">Closing balance</td><Money v={d.closing_balance} bold /></tr>
              </tbody>
            </table>)}
        </div>
      )}
    </>
  );
}
