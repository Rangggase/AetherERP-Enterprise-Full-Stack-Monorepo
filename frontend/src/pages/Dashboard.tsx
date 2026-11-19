import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Glyph } from "../components/glyphs";
import { Sparkline, TrendChart } from "../components/TrendChart";
import { EmptyState, ErrorNote, PageHeader, SectionTitle } from "../components/ui";
import { WarehousePlan, type PlanRow } from "../components/WarehousePlan";
import type { Row } from "../lib/actions";
import { api } from "../lib/api";
import { compactRupiah, date, monthLabel, num, pct, qty, today } from "../lib/format";
import { activityPhrase } from "../lib/labels";
import { useSession } from "../lib/session";
import type { Overview, Page } from "../lib/types";


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
  const { branchId, can, me, branches } = useSession();
  const kind = kindFor(can);
  const br = { branch_id: branchId };
  const overview = useQuery({ queryKey: ["overview", branchId], enabled: can("dashboard.read"), queryFn: () => api<Overview>("/dashboard/overview", { params: { branch_id: branchId } }) });
  const sos = useList("sos", "/sales/orders", can("sales.write") || can("inventory.write"), br);
  const pos = useList("pos", "/procurement/purchase-orders", can("procurement.read"), br);
  const invoices = useList("inv", "/invoices", can("payments.write") && can("accounting.read"), br);
  const transfers = useList("tr", "/inventory/transfers", can("inventory.write"), {}, false);
  const stock = useList("stock", "/inventory/balances", can("inventory.read"), br, false);
  const audit = useList("audit", "/audit-logs", can("audit.read") && kind === "auditor", {});

  const loading = overview.isLoading || [sos, pos, invoices, transfers, stock, audit].some((q) => q.isLoading);
  const t = today();
  const actions: Action[] = [];
  const st = (rows: Row[] | undefined, ...s: string[]) => (rows ?? []).filter((r) => s.includes(r.status));
  const sum = (rows: Row[], k = "total_amount") => rows.reduce((a, r) => a + num(r[k]), 0);

  if (can("procurement.approve")) {
    const r = st(pos.data, "PENDING_APPROVAL");
    if (r.length) actions.push({ n: r.length, text: "pesanan pembelian menunggu persetujuan", sub: `${compactRupiah(sum(r))} · ${r[r.length - 1]!.po_no} sampai ${r[0]!.po_no}`, to: "/procurement/orders?status=PENDING_APPROVAL", cta: "Tinjau" });
  }
  if (can("payments.write") && can("accounting.read")) {
    const od = (invoices.data ?? []).filter((i) => i.type === "AR" && i.status !== "PAID" && i.status !== "VOID" && i.due_date < t).sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
    if (od.length) actions.push({ n: od.length, text: "faktur piutang lewat jatuh tempo", sub: `${compactRupiah(sum(od, "outstanding"))} · tertua ${od[0]!.invoice_no}, terlambat ${daysBetween(od[0]!.due_date, t)} hari`, to: "/accounting/invoices", cta: "Tinjau" });
    const ap = (invoices.data ?? []).filter((i) => i.type === "AP" && i.status !== "PAID" && i.status !== "VOID" && daysBetween(t, i.due_date) <= 14).sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
    if (ap.length) actions.push({ n: ap.length, text: ap.length === 1 ? `tagihan pemasok jatuh tempo ${date(ap[0]!.due_date)}` : "tagihan pemasok jatuh tempo dalam 14 hari", sub: `${ap[0]!.invoice_no} · ${compactRupiah(sum(ap, "outstanding"))}`, to: "/accounting/invoices", cta: "Bayar" });
  }
  if (can("sales.write")) {
    const dv = st(sos.data, "DELIVERED");
    if (dv.length) actions.push({ n: dv.length, text: "pesanan terkirim belum difaktur", sub: `${dv[0]!.so_no} · ${dv[0]!.customer_name} · ${compactRupiah(sum(dv))}`, to: "/sales/orders?status=DELIVERED", cta: "Buat faktur" });
    const qt = st(sos.data, "QUOTATION");
    if (qt.length) actions.push({ n: qt.length, text: "penawaran menunggu konfirmasi", sub: `${compactRupiah(sum(qt))} · konfirmasi memeriksa batas kredit dan mencadangkan stok`, to: "/sales/orders?status=QUOTATION", cta: "Tinjau" });
  }
  if (can("inventory.write")) {
    const cf = st(sos.data, "CONFIRMED_SO");
    if (cf.length) actions.push({ n: cf.length, text: "pesanan terkonfirmasi menunggu pengiriman", sub: `${cf[0]!.so_no} · ${cf[0]!.customer_name} · stok sudah dicadangkan`, to: "/sales/orders?status=CONFIRMED_SO", cta: "Kirim" });
    const ap = st(pos.data, "APPROVED", "PARTIALLY_RECEIVED");
    if (ap.length) actions.push({ n: ap.length, text: "pesanan pembelian menunggu barang", sub: `${ap[0]!.po_no} · ${ap[0]!.supplier_name} · ${compactRupiah(sum(ap))}`, to: "/procurement/orders", cta: "Lihat" });
    const tr = st(transfers.data, "REQUESTED", "IN_TRANSIT");
    if (tr.length) actions.push({ n: tr.length, text: "transfer antar gudang belum selesai", sub: `${st(tr, "REQUESTED").length} diminta belum dikirim · ${st(tr, "IN_TRANSIT").length} dalam perjalanan`, to: "/inventory/transfers", cta: "Lihat" });
  }
  if (can("procurement.write")) {
    const rc = st(pos.data, "RECEIVED");
    if (rc.length) actions.push({ n: rc.length, text: "pesanan pembelian diterima belum ditagih", sub: `${compactRupiah(sum(rc))} menunggu tagihan pemasok`, to: "/procurement/orders?status=RECEIVED", cta: "Tinjau" });
    const dr = st(pos.data, "DRAFT");
    if (dr.length) actions.push({ n: dr.length, text: "pesanan pembelian draf belum diajukan", sub: dr.map((d) => d.po_no).slice(0, 3).join(", "), to: "/procurement/orders?status=DRAFT", cta: "Ajukan" });
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
  const changePct = k && (kind === "keuangan" || kind === "penjualan") ? k.net_revenue_change_pct : null;
  const prevMonth = overview.data ? new Date(new Date(overview.data.as_of).getFullYear(), new Date(overview.data.as_of).getMonth() - 1, 1).toLocaleDateString("id-ID", { month: "long" }) : "";
  const stockRows = (stock.data ?? []) as PlanRow[];
  const branchName = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`;

  return (
    <>
      <PageHeader title="Dasbor" sub={`${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${branchId ? "satu cabang" : "semua cabang"} · tampilan ${me?.role ?? ""}`} />
      {overview.isError && <ErrorNote error={overview.error} retry={() => overview.refetch()} />}
      <div className="grid gap-10 md:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionTitle>Perlu tindakan</SectionTitle>
          {loading ? <TaskSkeleton /> : actions.length === 0 ? (
            <EmptyState art="map">Tidak ada yang perlu ditindaklanjuti sekarang.</EmptyState>
          ) : (
            <ul className="stagger grid gap-4 sm:grid-cols-2">
              {actions.map((a) => (
                <li key={a.text}>
                  {/* A task card is a paper stack: one sheet per item, up to three. */}
                  <Link to={a.to} className="sheet lift task">
                    {a.n >= 2 && <span className="stack-back b1" aria-hidden="true" />}
                    {a.n >= 3 && <span className="stack-back b2" aria-hidden="true" />}
                    <span className="n">{a.n}</span>
                    <span className="t">{a.text}</span>
                    {a.sub && <span className="d">{a.sub}</span>}
                    <span className="go" aria-hidden="true"><Glyph name="kirim" size={18} /></span>
                    <span className="sr-only">{a.cta}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {!loading && headline && (
            <section className="sheet mt-8 px-5 pb-4 pt-4">
              <SectionTitle>{headline.label}</SectionTitle>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
                <div className="font-serif text-[44px] font-medium leading-[48px] tracking-[-0.01em] font-num md:text-figure">{headline.value}</div>
                {(hasTrend || changePct !== null) && (
                  <div className="pb-2">
                    {hasTrend && <Sparkline values={trend.map((t) => t.pendapatan)} />}
                    {changePct !== null && changePct !== undefined ? (
                      <p className={`mt-1 inline-flex items-center gap-1 text-table ${num(changePct) >= 0 ? "text-good" : "text-bad"}`}>
                        <Glyph name={num(changePct) >= 0 ? "naik" : "turun"} size={16} />
                        {num(changePct) >= 0 ? "naik" : "turun"} {Math.abs(num(changePct)).toFixed(1).replace(".", ",")}% dari {prevMonth}
                      </p>
                    ) : headline.note && <p className="mt-1 text-table text-muted">{headline.note}</p>}
                  </div>
                )}
              </div>
              {!hasTrend && changePct === null && headline.note && <p className="mt-1 text-table text-muted">{headline.note}</p>}
              {hasTrend && noTrendNote && (
                <div className="mt-5 border-t border-line pt-4">
                  <TrendChart data={trend.map((t) => ({ month: t.month, a: t.pendapatan, b: kind === "penjualan" ? undefined : t.hpp }))} aLabel={kind === "penjualan" ? "Penjualan" : "Pendapatan"} bLabel={kind === "penjualan" ? undefined : "HPP"} label={kind === "penjualan" ? "Penjualan bulanan, jutaan rupiah" : "Pendapatan dan harga pokok penjualan bulanan, jutaan rupiah"} />
                </div>
              )}
              {!hasTrend && noTrendNote && !loading && (
                <div className="mt-4 grid justify-items-center gap-2 border-t border-line pt-5 text-center"><EmptyArt /><p className="text-table text-muted">Belum ada penjualan dalam 6 bulan terakhir, jadi grafik belum ditampilkan.</p></div>
              )}
            </section>
          )}

          {(kind === "gudang" || kind === "pengadaan") && low.length > 0 && (
            <section className="mt-8">
              <SectionTitle>Stok di bawah titik pesan ulang</SectionTitle>
              <div className="tbl-sheet"><table className="tbl"><thead><tr><th>SKU</th><th>Produk</th><th className="text-right">Tersedia</th><th className="text-right">Titik pesan ulang</th></tr></thead>
                <tbody>{low.slice(0, 8).map((r) => (<tr key={`${r.sku}-${r.branch_id}`}><td>{r.sku}</td><td>{r.name}</td><td className="num">{qty(r.available)}</td><td className="num">{qty(r.reorder_point)}</td></tr>))}</tbody></table></div>
            </section>
          )}

          {kind === "auditor" && (
            <section className="sheet mt-8 px-5 py-4">
              <SectionTitle>Kejadian terbaru</SectionTitle>
              <ul className="divide-y divide-line">{(audit.data ?? []).slice(0, 8).map((a) => (<li key={a.id} className="py-2 text-table"><span className="font-medium">{activityPhrase(a.action, a.entity_type)}</span><span className="text-muted"> · {a.user ?? "Sistem"} · {date(a.created_at)}</span></li>))}</ul>
            </section>
          )}
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          {loading && (
            <div className="sheet px-5 py-4" aria-hidden="true">
              <div className="sk mb-3 h-3 w-24" />
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="flex justify-between py-1.5"><div className="sk h-3 w-28" /><div className="sk h-3 w-16" /></div>)}
            </div>
          )}
          {!loading && facts.length > 0 && (
            <div className="sheet px-5 py-4">
              <SectionTitle>Angka lain</SectionTitle>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-table">
                {facts.map(([a, b]) => (<div key={a} className="contents"><dt className="text-muted">{a}</dt><dd className="num">{b}</dd></div>))}
              </dl>
            </div>
          )}
          {!loading && stockRows.length > 0 && (
            <div className="sheet hidden px-5 py-4 md:block">
              <div className="flex items-baseline justify-between gap-3"><SectionTitle>Denah gudang</SectionTitle><Link to="/inventory/stock" className="inline-flex min-h-8 items-center gap-1 text-table text-brand hover:underline">Level stok<Glyph name="kirim" size={14} /></Link></div>
              <WarehousePlan rows={stockRows} branchName={branchName} compact />
            </div>
          )}
          {!loading && (overview.data?.recent_activity.length ?? 0) > 0 && can("dashboard.read") && (
            <div className="sheet px-5 py-4">
              <SectionTitle>Aktivitas terakhir</SectionTitle>
              <ul className="stagger grid gap-2 text-table">
                {overview.data!.recent_activity.slice(0, 5).map((a) => (
                  <li key={a.id}><span>{activityPhrase(a.action, a.entity_type)}</span><span className="block text-muted">{a.user} · {date(a.created_at)}</span></li>
                ))}
              </ul>
            </div>
          )}
          {!loading && <p className="text-table text-muted">Jumlah dihitung dari 200 dokumen terbaru per daftar. Angka resmi ada di laporan keuangan.</p>}
        </aside>
      </div>
    </>
  );
}

/** Loading placeholder shaped like the task cards, so the page does not jump when they arrive. */
const TaskSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="sheet flex h-[92px] items-center gap-4 px-4"><div className="sk h-7 w-6" /><div className="flex-1 space-y-2"><div className="sk h-3.5 w-3/4" /><div className="sk h-3 w-1/2" /></div></div>
    ))}
  </div>
);

const EmptyArt = () => (
  <svg aria-hidden="true" viewBox="0 0 150 110" className="h-16 w-auto" fill="none" stroke="#6B645A" strokeWidth={1} strokeLinecap="round"><path d="M20 96h110M20 96V14" /><path d="M28 80h20M56 70h20M84 76h20" strokeDasharray="2 3" /></svg>
);
