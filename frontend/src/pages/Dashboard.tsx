import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, ErrorNote, PageHeader, SectionTitle, Skeleton } from "../components/ui";
import type { Row } from "../lib/actions";
import { api } from "../lib/api";
import { compactRupiah, date, monthLabel, num, pct, qty, today } from "../lib/format";
import { activityPhrase } from "../lib/labels";
import { useSession } from "../lib/session";
import type { Overview, Page } from "../lib/types";

const ACCENT = "rgb(122 46 42)";
const MUTED = "rgb(107 100 90)";
const INK = "rgb(30 27 24)";
const LINE = "rgb(220 214 202)";

type Kind = "keuangan" | "pengadaan" | "gudang" | "penjualan" | "auditor";

/** Dashboard variant chosen from permissions (docs/design-system.md). The backend remains the real access guard. */
function kindFor(can: (p: string) => boolean): Kind {
  if (can("users.manage") || can("accounting.close") || can("payments.write")) return "keuangan";
  if (can("procurement.approve") || can("procurement.write")) return "pengadaan";
  if (can("inventory.write")) return "gudang";
  if (can("sales.write")) return "penjualan";
  return "auditor";
}

function useList(key: string, path: string, enabled: boolean, params: Record<string, unknown> = {}, paged = true) {
  return useQuery({
    queryKey: ["dash", key, params],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<Row[]> => {
      const r = await api<Page<Row> | Row[]>(path, { params: paged ? { page_size: 200, ...params } : params });
      return Array.isArray(r) ? r : r.items;
    },
  });
}

interface Action { n: number; text: string; sub?: string; to: string; cta: string }

const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

export function Dashboard() {
  const { branchId, can, me } = useSession();
  const kind = kindFor(can);
  const br = { branch_id: branchId };
  const overview = useQuery({ queryKey: ["overview", branchId], enabled: can("dashboard.read"), queryFn: () => api<Overview>("/dashboard/overview", { params: { branch_id: branchId } }) });
  const sos = useList("sos", "/sales/orders", can("sales.write") || can("inventory.write"), br);
  const pos = useList("pos", "/procurement/purchase-orders", can("procurement.read"), br);
  const invoices = useList("inv", "/invoices", can("payments.write") && can("accounting.read"), br);
  const transfers = useList("tr", "/inventory/transfers", can("inventory.write"), {}, false);
  const stock = useList("stock", "/inventory/balances", can("inventory.read"), br, false);
  const audit = useList("audit", "/audit-logs", can("audit.read") && kind === "auditor", {});

  const loading = overview.isLoading || [sos, pos, invoices, transfers, stock].some((q) => q.isLoading);
  const t = today();
  const actions: Action[] = [];
  const st = (rows: Row[] | undefined, ...s: string[]) => (rows ?? []).filter((r) => s.includes(r.status));
  const sum = (rows: Row[], k = "total_amount") => rows.reduce((a, r) => a + num(r[k]), 0);

  if (can("procurement.approve")) {
    const r = st(pos.data, "PENDING_APPROVAL");
    if (r.length) actions.push({ n: r.length, text: "pesanan pembelian menunggu persetujuan", sub: `${compactRupiah(sum(r))} · ${r[r.length - 1]!.po_no} sampai ${r[0]!.po_no}`, to: "/procurement/orders", cta: "Tinjau" });
  }
  if (can("payments.write") && can("accounting.read")) {
    const od = (invoices.data ?? []).filter((i) => i.type === "AR" && i.status !== "PAID" && i.status !== "VOID" && i.due_date < t).sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
    if (od.length) actions.push({ n: od.length, text: "faktur piutang lewat jatuh tempo", sub: `${compactRupiah(sum(od, "outstanding"))} · tertua ${od[0]!.invoice_no}, terlambat ${daysBetween(od[0]!.due_date, t)} hari`, to: "/accounting/invoices", cta: "Tinjau" });
    const ap = (invoices.data ?? []).filter((i) => i.type === "AP" && i.status !== "PAID" && i.status !== "VOID" && daysBetween(t, i.due_date) <= 14).sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
    if (ap.length) actions.push({ n: ap.length, text: ap.length === 1 ? `tagihan pemasok jatuh tempo ${date(ap[0]!.due_date)}` : "tagihan pemasok jatuh tempo dalam 14 hari", sub: `${ap[0]!.invoice_no} · ${compactRupiah(sum(ap, "outstanding"))}`, to: "/accounting/invoices", cta: "Bayar" });
  }
  if (can("sales.write")) {
    const dv = st(sos.data, "DELIVERED");
    if (dv.length) actions.push({ n: dv.length, text: "pesanan terkirim belum difaktur", sub: `${dv[0]!.so_no} · ${dv[0]!.customer_name} · ${compactRupiah(sum(dv))}`, to: "/sales/orders", cta: "Buat faktur" });
    const qt = st(sos.data, "QUOTATION");
    if (qt.length) actions.push({ n: qt.length, text: "penawaran menunggu konfirmasi", sub: `${compactRupiah(sum(qt))} · konfirmasi memeriksa batas kredit dan mencadangkan stok`, to: "/sales/orders", cta: "Tinjau" });
  }
  if (can("inventory.write")) {
    const cf = st(sos.data, "CONFIRMED_SO");
    if (cf.length) actions.push({ n: cf.length, text: "pesanan terkonfirmasi menunggu pengiriman", sub: `${cf[0]!.so_no} · ${cf[0]!.customer_name} · stok sudah dicadangkan`, to: "/sales/orders", cta: "Kirim" });
    const ap = st(pos.data, "APPROVED", "PARTIALLY_RECEIVED");
    if (ap.length) actions.push({ n: ap.length, text: "pesanan pembelian menunggu barang", sub: `${ap[0]!.po_no} · ${ap[0]!.supplier_name} · ${compactRupiah(sum(ap))}`, to: "/procurement/orders", cta: "Lihat" });
    const tr = st(transfers.data, "REQUESTED", "IN_TRANSIT");
    if (tr.length) actions.push({ n: tr.length, text: "transfer antar gudang belum selesai", sub: `${st(tr, "REQUESTED").length} diminta belum dikirim · ${st(tr, "IN_TRANSIT").length} dalam perjalanan`, to: "/inventory/transfers", cta: "Lihat" });
  }
  if (can("procurement.write")) {
    const rc = st(pos.data, "RECEIVED");
    if (rc.length) actions.push({ n: rc.length, text: "pesanan pembelian diterima belum ditagih", sub: `${compactRupiah(sum(rc))} menunggu tagihan pemasok`, to: "/procurement/orders", cta: "Tinjau" });
    const dr = st(pos.data, "DRAFT");
    if (dr.length) actions.push({ n: dr.length, text: "pesanan pembelian draf belum diajukan", sub: dr.map((d) => d.po_no).slice(0, 3).join(", "), to: "/procurement/orders", cta: "Ajukan" });
  }
  const low = (stock.data ?? []).filter((r) => r.is_low);
  if (low.length && (can("inventory.write") || can("procurement.write"))) actions.push({ n: low.length, text: "item di bawah titik pesan ulang", sub: `${low[0]!.sku} tersisa ${qty(low[0]!.available)} dari titik ${qty(low[0]!.reorder_point)}`, to: "/inventory/reorder", cta: "Lihat saran" });

  const k = overview.data?.kpis;
  const trend = (overview.data?.trend ?? []).map((m) => ({ month: monthLabel(m.month), pendapatan: num(m.revenue) / 1e6, hpp: num(m.cogs) / 1e6 }));
  const hasTrend = trend.some((m) => m.pendapatan > 0 || m.hpp > 0);
  const openPo = sum(st(pos.data, "PENDING_APPROVAL", "APPROVED", "PARTIALLY_RECEIVED"));
  const lastAudit = (audit.data ?? []).filter((a) => String(a.created_at).slice(0, 10) >= new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10));

  let headline: { label: string; value: string; note?: string } | null = null;
  const facts: [string, string][] = [];
  if (k) {
    if (kind === "keuangan") {
      headline = { label: `Pendapatan bersih ${new Date(overview.data!.as_of).toLocaleDateString("id-ID", { month: "long" })}`, value: compactRupiah(k.net_revenue), note: k.net_revenue_change_pct === null ? "belum ada bulan sebelumnya" : `${pct(k.net_revenue_change_pct).replace(".", ",")} dibanding bulan lalu` };
      facts.push(["Margin kotor", `${num(k.gross_margin_pct).toFixed(1).replace(".", ",")}%`], ["Laba bersih", compactRupiah(k.net_income)], ["Piutang berjalan", compactRupiah(k.total_receivables)], ["Lewat jatuh tempo", compactRupiah(k.overdue_receivables)], ["Kas dan bank", compactRupiah(k.cash_balance)], ["Nilai persediaan FIFO", compactRupiah(k.inventory_value)]);
    } else if (kind === "penjualan") {
      headline = { label: "Penjualan bulan ini", value: compactRupiah(k.net_revenue), note: k.net_revenue_change_pct === null ? undefined : `${pct(k.net_revenue_change_pct).replace(".", ",")} dibanding bulan lalu` };
      facts.push(["Piutang berjalan", compactRupiah(k.total_receivables)], ["Lewat jatuh tempo", compactRupiah(k.overdue_receivables)]);
    } else if (kind === "gudang") {
      headline = { label: "Nilai persediaan FIFO", value: compactRupiah(k.inventory_value), note: "semua gudang" };
      facts.push(["Item stok kritis", String(k.low_stock_count)], ["Transfer belum selesai", String(st(transfers.data, "REQUESTED", "IN_TRANSIT").length)]);
    }
  }
  if (kind === "pengadaan") { headline = { label: "Nilai pesanan pembelian terbuka", value: compactRupiah(openPo), note: "menunggu persetujuan atau barang" }; facts.push(["Item stok kritis", String(low.length)]); }
  if (kind === "auditor") { headline = { label: "Kejadian audit 7 hari terakhir", value: String(lastAudit.length) }; }

  const noTrendNote = kind === "keuangan" || kind === "penjualan";

  return (
    <>
      <PageHeader title="Dasbor" sub={`${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${branchId ? "satu cabang" : "semua cabang"} · tampilan ${me?.role ?? ""}`} />
      {overview.isError && <ErrorNote error={overview.error} retry={() => overview.refetch()} />}
      <div className="grid gap-12 md:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionTitle>Perlu tindakan</SectionTitle>
          {loading ? <Skeleton rows={4} /> : actions.length === 0 ? (
            <EmptyState>Tidak ada yang perlu ditindaklanjuti sekarang.</EmptyState>
          ) : (
            <ul className="border-t border-line">
              {actions.map((a) => (
                <li key={a.text} className="border-b border-line">
                  <Link to={a.to} className="group grid grid-cols-[40px_minmax(0,1fr)] items-baseline gap-x-4 gap-y-0.5 py-3 md:grid-cols-[56px_minmax(0,1fr)_auto]">
                    <span className="font-serif text-[24px] font-medium leading-8 text-brand md:text-[28px]">{a.n}</span>
                    <span><span className="block">{a.text}</span>{a.sub && <span className="block text-table text-muted">{a.sub}</span>}</span>
                    <span className="hidden text-table text-brand group-hover:underline md:block">{a.cta}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {headline && (
            <section className="mt-8 border-t border-line pt-4">
              <SectionTitle>{headline.label}</SectionTitle>
              <div className="font-serif text-[44px] font-medium leading-[48px] tracking-[-0.01em] md:text-figure">{headline.value}</div>
              {headline.note && <p className="mt-1 text-table text-muted">{headline.note}</p>}
              {hasTrend && noTrendNote && <Trend data={trend} sales={kind === "penjualan"} />}
              {!hasTrend && noTrendNote && !loading && <p className="mt-6 text-table text-muted">Belum ada penjualan dalam 6 bulan terakhir, jadi grafik belum ditampilkan.</p>}
            </section>
          )}

          {(kind === "gudang" || kind === "pengadaan") && low.length > 0 && (
            <section className="mt-8 border-t border-line pt-4">
              <SectionTitle>Stok di bawah titik pesan ulang</SectionTitle>
              <table className="tbl"><thead><tr><th>SKU</th><th>Produk</th><th className="text-right">Tersedia</th><th className="text-right">Titik pesan ulang</th></tr></thead>
                <tbody>{low.slice(0, 8).map((r) => (<tr key={`${r.sku}-${r.branch_id}`}><td>{r.sku}</td><td>{r.name}</td><td className="num">{qty(r.available)}</td><td className="num">{qty(r.reorder_point)}</td></tr>))}</tbody></table>
            </section>
          )}

          {kind === "auditor" && (
            <section className="mt-8 border-t border-line pt-4">
              <SectionTitle>Kejadian terbaru</SectionTitle>
              <ul className="divide-y divide-line">{(audit.data ?? []).slice(0, 8).map((a) => (<li key={a.id} className="py-2 text-table"><span className="font-medium">{activityPhrase(a.action, a.entity_type)}</span><span className="text-muted"> · {a.user ?? "Sistem"} · {date(a.created_at)}</span></li>))}</ul>
            </section>
          )}
        </div>

        <aside className="min-w-0">
          {facts.length > 0 && (
            <>
              <SectionTitle>Angka lain</SectionTitle>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-table">
                {facts.map(([a, b]) => (<div key={a} className="contents"><dt className="text-muted">{a}</dt><dd className="num">{b}</dd></div>))}
              </dl>
            </>
          )}
          {(overview.data?.recent_activity.length ?? 0) > 0 && can("dashboard.read") && (
            <div className={facts.length ? "mt-8 border-t border-line pt-4" : ""}>
              <SectionTitle>Aktivitas terakhir</SectionTitle>
              <ul className="text-table">
                {overview.data!.recent_activity.slice(0, 5).map((a) => (
                  <li key={a.id} className="mb-2"><span>{activityPhrase(a.action, a.entity_type)}</span><span className="block text-muted">{a.user} · {date(a.created_at)}</span></li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-8 border-t border-line pt-4 text-table text-muted">Jumlah dihitung dari 200 dokumen terbaru per daftar. Angka resmi ada di laporan keuangan.</p>
        </aside>
      </div>
    </>
  );
}

/** Revenue (accent) against cost of goods sold (muted), labelled directly at the line ends, with a table alternative. */
function Trend({ data, sales }: { data: { month: string; pendapatan: number; hpp: number }[]; sales: boolean }) {
  const last = data.length - 1;
  const end = (key: "pendapatan" | "hpp", label: string, color: string, bold: boolean) => (p: { cx?: number; cy?: number; index?: number }) =>
    p.index === last && p.cx !== undefined && p.cy !== undefined ? (
      <g key={key}>
        <circle cx={p.cx} cy={p.cy} r={4} fill={color} />
        <text x={p.cx + 10} y={p.cy + 4} fontSize={12} fontWeight={bold ? 600 : 400} fill={bold ? INK : MUTED}>{label} {data[last]![key].toFixed(1).replace(".", ",")}</text>
      </g>
    ) : <g key={`${key}-${p.index}`} />;
  return (
    <div className="mt-6">
      <div className="h-56 md:h-64" role="img" aria-label={`${sales ? "Penjualan" : "Pendapatan dan harga pokok penjualan"} bulanan dalam jutaan rupiah. ${data.map((d) => `${d.month}: ${d.pendapatan.toFixed(1)}`).join("; ")}`}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: 0, right: 110, top: 8, bottom: 0 }}>
            <CartesianGrid stroke={LINE} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} width={32} tickCount={3} />
            <Tooltip contentStyle={{ background: "rgb(251 250 246)", border: `1px solid ${INK}`, borderRadius: 4, fontSize: 12 }} formatter={(v: number) => `Rp${v.toFixed(1).replace(".", ",")} jt`} />
            {!sales && <Line type="linear" dataKey="hpp" name="HPP" stroke={MUTED} strokeWidth={2} dot={end("hpp", "HPP", MUTED, false)} isAnimationActive={false} />}
            <Line type="linear" dataKey="pendapatan" name="Pendapatan" stroke={ACCENT} strokeWidth={2} dot={end("pendapatan", sales ? "Penjualan" : "Pendapatan", ACCENT, true)} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-table">
        <summary className="text-brand">Lihat sebagai tabel</summary>
        <table className="tbl dense mt-2"><thead><tr><th>Bulan</th><th className="text-right">Pendapatan (jt)</th>{!sales && <th className="text-right">HPP (jt)</th>}</tr></thead>
          <tbody>{data.map((d) => (<tr key={d.month}><td>{d.month}</td><td className="num">{d.pendapatan.toFixed(1).replace(".", ",")}</td>{!sales && <td className="num">{d.hpp.toFixed(1).replace(".", ",")}</td>}</tr>))}</tbody></table>
      </details>
    </div>
  );
}
