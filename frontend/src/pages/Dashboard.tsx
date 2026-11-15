import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorNote, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { compactRupiah, dateTime, monthLabel, num, pct, rupiah } from "../lib/format";
import { useSession } from "../lib/session";
import type { Overview } from "../lib/types";
import { Link } from "react-router-dom";

const C = { brand: "rgb(var(--brand))", ink: "rgb(var(--ink))", muted: "rgb(var(--muted))", line: "rgb(var(--line))", warn: "rgb(var(--warn))", surface: "rgb(var(--surface))" };

function Cell({ label, value, sub, tone, to }: { label: string; value: string; sub?: React.ReactNode; tone?: "warn"; to?: string }) {
  const body = (
    <div className="min-w-0 px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 truncate text-2xl font-semibold tracking-tight ${tone === "warn" ? "text-warn" : ""}`}>{value}</p>
      <p className="mt-0.5 min-h-4 text-xs text-muted">{sub}</p>
    </div>
  );
  return to ? <Link to={to} className="block hover:bg-sunken">{body}</Link> : body;
}

const tip = {
  contentStyle: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: C.ink },
  labelStyle: { color: C.muted },
};

export function Dashboard() {
  const { branchId } = useSession();
  const q = useQuery({ queryKey: ["overview", branchId], queryFn: () => api<Overview>("/dashboard/overview", { params: { branch_id: branchId } }) });

  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const k = d?.kpis;
  const trend = (d?.trend ?? []).map((t) => ({
    month: monthLabel(t.month), revenue: num(t.revenue), cogs: num(t.cogs), grossProfit: num(t.gross_profit), cashIn: num(t.cash_in), cashOut: num(t.cash_out), net: num(t.net_cash),
  }));
  const cats = (d?.sales_by_category ?? []).map((c) => ({ name: c.category, amount: num(c.amount) }));
  const change = k?.net_revenue_change_pct;
  const marginDelta = k ? num(k.gross_margin_pct) - num(k.prev_gross_margin_pct) : 0;

  return (
    <>
      <PageHeader
        title="Executive dashboard"
        note={d ? `${branchId ? "Single branch" : "All branches consolidated"}, month of ${new Date(d.as_of).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}.` : "Loading figures"}
      />

      <section aria-label="Key figures" className="grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-5 lg:divide-y-0">
        {q.isLoading || !k ? (
          Array.from({ length: 5 }, (_, i) => <div key={i} className="h-[92px] animate-pulse bg-sunken" />)
        ) : (
          <>
            <Cell
              label="Net revenue"
              value={compactRupiah(k.net_revenue)}
              sub={
                change === null || change === undefined ? "No prior month" : (
                  <span className={`inline-flex items-center gap-0.5 ${change >= 0 ? "text-good" : "text-bad"}`}>
                    {change >= 0 ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
                    {pct(change)} vs last month
                  </span>
                )
              }
            />
            <Cell label="Gross margin" value={`${num(k.gross_margin_pct).toFixed(1)}%`} sub={`${marginDelta >= 0 ? "+" : ""}${marginDelta.toFixed(1)} pts vs last month`} />
            <Cell label="Inventory value (FIFO)" value={compactRupiah(k.inventory_value)} sub={`Cash ${compactRupiah(k.cash_balance)}`} to="/inventory/stock" />
            <Cell label="Overdue receivables" value={compactRupiah(k.overdue_receivables)} sub={`of ${compactRupiah(k.total_receivables)} outstanding`} tone={num(k.overdue_receivables) > 0 ? "warn" : undefined} to="/accounting/reports" />
            <Cell
              label="Critical stock"
              value={String(k.low_stock_count)}
              tone={k.low_stock_count > 0 ? "warn" : undefined}
              sub={k.low_stock_count > 0 ? <span className="inline-flex items-center gap-1"><AlertTriangle size={12} aria-hidden />Below reorder point</span> : "All items above reorder point"}
              to="/inventory/reorder"
            />
          </>
        )}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <section className="rounded-lg border border-line bg-surface p-4 xl:col-span-2" aria-label="Revenue and gross profit trend">
          <h2 className="font-medium">Sales and gross profit, last 6 months</h2>
          <div className="mt-3 h-64" role="img" aria-label={`Monthly revenue and gross profit. ${trend.map((t) => `${t.month}: revenue ${rupiah(t.revenue)}`).join("; ")}`}>
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ left: 0, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.brand} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={C.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.line} strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => compactRupiah(v)} />
                <Tooltip {...tip} formatter={(v: number, n: string) => [rupiah(v), n]} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.brand} strokeWidth={2} fill="url(#rev)" />
                <Area type="monotone" dataKey="grossProfit" name="Gross profit" stroke={C.warn} strokeWidth={2} strokeDasharray="5 4" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-surface p-4" aria-label="Sales by category">
          <h2 className="font-medium">Sales by category</h2>
          {cats.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No delivered orders in this period yet.</p>
          ) : (
            <>
              <div className="mt-3 h-48" role="img" aria-label={`Sales by category: ${cats.map((c) => `${c.name} ${rupiah(c.amount)}`).join("; ")}`}>
                <ResponsiveContainer>
                  <BarChart data={cats} layout="vertical" margin={{ left: 0, right: 8 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={84} tick={{ fill: C.ink, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tip} cursor={{ fill: "rgb(var(--sunken))" }} formatter={(v: number) => rupiah(v)} />
                    <Bar dataKey="amount" name="Sales" fill={C.brand} radius={[0, 3, 3, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {cats.map((c) => (
                  <li key={c.name} className="flex justify-between"><span className="text-muted">{c.name}</span><span>{compactRupiah(c.amount)}</span></li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-lg border border-line bg-surface p-4 xl:col-span-2" aria-label="Cash flow">
          <h2 className="font-medium">Cash in, cash out and net flow</h2>
          <div className="mt-3 h-56" role="img" aria-label={`Monthly cash flow. ${trend.map((t) => `${t.month}: net ${rupiah(t.net)}`).join("; ")}`}>
            <ResponsiveContainer>
              <ComposedChart data={trend} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid stroke={C.line} strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => compactRupiah(v)} />
                <Tooltip {...tip} formatter={(v: number, n: string) => [rupiah(v), n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="cashIn" name="Cash in" fill={C.brand} radius={[3, 3, 0, 0]} barSize={14} />
                <Bar dataKey="cashOut" name="Cash out" fill={C.muted} fillOpacity={0.55} radius={[3, 3, 0, 0]} barSize={14} />
                <Line type="monotone" dataKey="net" name="Net flow" stroke={C.warn} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-surface p-4" aria-label="Recent activity">
          <h2 className="font-medium">Recent activity</h2>
          <ul className="mt-3 space-y-3">
            {(d?.recent_activity ?? []).slice(0, 8).map((a) => (
              <li key={a.id} className="text-sm leading-snug">
                <p>
                  <span className="font-medium">{a.user}</span> <span className="text-muted">{a.action.toLowerCase().replace(/_/g, " ")}</span> {a.entity_type.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-muted">{dateTime(a.created_at)}</p>
              </li>
            ))}
            {d && d.recent_activity.length === 0 && <li className="text-sm text-muted">Activity appears here as your team posts documents.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
