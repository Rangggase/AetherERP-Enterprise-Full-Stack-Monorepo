import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { lazy, Suspense, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Glyph, type GlyphName } from "../components/glyphs";
import { RoomLink } from "../components/RoomLink";
import { usePeriodNow } from "../components/Shell";
import { MechanicalNumber } from "../components/signature/MechanicalNumber";
import { Sparkline, TrendChart } from "../components/TrendChart";
import { EmptyState, ErrorNote, Pencil, SectionTitle } from "../components/ui";
import { FEATURES } from "../config/features";
import type { Row } from "../lib/actions";
import { api } from "../lib/api";
import { compactRupiah, date, monthLabel, num, qty, today } from "../lib/format";
import { openJournal } from "../lib/journals";
import { activityPhrase } from "../lib/labels";
import { useSession } from "../lib/session";
import type { Overview, Page } from "../lib/types";
import { roomName } from "../motion/viewTransition";

const WarehouseIso = lazy(() => import("../components/signature/WarehouseIso").then((m) => ({ default: m.WarehouseIso })));

type Kind = "pimpinan" | "keuangan" | "pengadaan" | "gudang" | "penjualan" | "auditor";

/** Arketipe dari izin, bukan nama peran (brief 11): peran baru otomatis mendapat tampilan yang benar. Backend tetap penjaga akses. */
function kindFor(can: (p: string) => boolean): Kind {
  if (can("users.manage")) return "pimpinan";
  if (can("accounting.close") || can("payments.write")) return "keuangan";
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

interface Action { n: number; text: string; sub?: string; to: string; cta: string; glyph: GlyphName }
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
const listRoom = (to: string) => roomName("list", to.split("?")[0]!.replace(/\//g, "-"));

/** Kartu tumpukan "Perlu tindakan": lembar mengikuti jumlah item (1, 2, 3+), angka memakai M3. */
function TaskCard({ a }: { a: Action }) {
  return (
    <RoomLink to={a.to} room={listRoom(a.to)} className="sheet lift task">
      {a.n >= 2 && <span className="stack-back b1" aria-hidden="true" />}
      {a.n >= 3 && <span className="stack-back b2" aria-hidden="true" />}
      <span className="n"><MechanicalNumber value={a.n} format={(v) => String(v)} /></span>
      <span className="t">{a.text}</span>
      {a.sub && <span className="d">{a.sub}</span>}
      <span className="go" aria-hidden="true"><Glyph name={a.glyph} size={18} /></span>
      <span className="sr-only">{a.cta}</span>
    </RoomLink>
  );
}

/** KPI (8): angka utama Source Serif 40, sparkline tinta 6 bulan, perubahan dengan glyph dan kata, M3 saat berubah. */
function Kpi({ label, value, spark, change, prev, zero, big }: { label: string; value: number; spark?: number[]; change?: number | null; prev?: string; zero?: string; big?: boolean }) {
  return (
    <div className={big ? "" : "flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0"}>
      <p className={big ? "text-table font-semibold" : "text-table text-muted"}>{label}</p>
      <div className={big ? "mt-1 flex flex-wrap items-end gap-x-6 gap-y-1" : "text-right"}>
        <p className={big ? "font-serif text-display font-medium tracking-[-0.01em]" : "font-num text-md font-medium"}>
          <MechanicalNumber value={value} format={(v) => compactRupiah(v)} srLabel={label} />
        </p>
        {big && spark && spark.some((v) => v !== 0) && <div className="pb-2"><Sparkline values={spark} /></div>}
      </div>
      {big && change !== undefined && change !== null && (
        <p className={clsx("mt-1 inline-flex items-center gap-1 text-table", change >= 0 ? "text-good" : "text-bad")}>
          <Glyph name={change >= 0 ? "naik" : "turun"} size={16} />{change >= 0 ? "naik" : "turun"} {Math.abs(change).toFixed(1).replace(".", ",")}% dari {prev}
        </p>
      )}
      {value === 0 && zero && <p className="mt-1 text-xs text-muted">{zero}</p>}
    </div>
  );
}

/** Piutang menurut umur sebagai pita kertas (keuangan): lebar sebanding nilai, angka selalu tertulis. */
function AgingStrips({ data }: { data: Row }) {
  const buckets: [string, string][] = [["not_due", "Belum jatuh tempo"], ["d0_30", "1–30 hari"], ["d31_60", "31–60 hari"], ["d61_90", "61–90 hari"], ["d90_plus", "> 90 hari"]];
  const total = num(data.totals.total) || 1;
  return (
    <ul className="grid gap-2" aria-label="Piutang menurut umur">
      {buckets.map(([k, label], i) => {
        const v = num(data.totals[k]);
        return (
          <li key={k} className="grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-3 text-table">
            <span className="text-muted">{label}</span>
            <span className="relative h-5 rounded-sm bg-highlight shadow-inset" aria-hidden="true">
              <span className={clsx("absolute inset-y-0 left-0 rounded-sm border", i === 0 ? "border-rule-strong bg-paper" : i < 2 ? "border-warn-mark/70 bg-warn-mark/25" : "border-bad/70 bg-bad/25")} style={{ width: `${Math.max(v > 0 ? 2 : 0, (v / total) * 100)}%` }} />
            </span>
            <span className="font-num">{compactRupiah(v)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Dashboard() {
  const { branchId, can, branches } = useSession();
  const kind = kindFor(can);
  const br = { branch_id: branchId };
  const period = usePeriodNow();
  const overview = useQuery({ queryKey: ["overview", branchId], enabled: can("dashboard.read"), queryFn: () => api<Overview>("/dashboard/overview", { params: { branch_id: branchId } }) });
  const sos = useList("sos", "/sales/orders", can("sales.read") && (can("sales.write") || can("inventory.write")), br);
  const pos = useList("pos", "/procurement/purchase-orders", can("procurement.read"), br);
  const invoices = useList("inv", "/invoices", can("accounting.read") && (kind !== "gudang"), br);
  const transfers = useList("tr", "/inventory/transfers", can("inventory.write"), {}, false);
  const stock = useList("stock", "/inventory/balances", can("inventory.read"), br, false);
  const grn = useList("grn", "/procurement/goods-receipts", can("procurement.read") && kind === "gudang", {}, false);
  const audit = useList("audit", "/audit-logs", can("audit.read") && kind === "auditor", {});
  const journals = useList("je", "/accounting/journals", can("accounting.read") && (kind === "keuangan" || kind === "auditor"), { ...br, page_size: 6 });
  const returns = useList("ret", "/sales/returns", can("sales.read") && kind === "penjualan", {}, false);
  const users = useList("users", "/system/users", can("users.manage"), {}, false);
  const products = useList("prod", "/master/products", can("master.read") && kind === "gudang", {}, false);
  const aging = useQuery({ queryKey: ["dash", "aging", branchId], enabled: can("accounting.read") && (kind === "keuangan" || kind === "penjualan"), queryFn: () => api<Row>("/accounting/reports/aging/AR", { params: { ...br, as_of: today() } }) });
  const customers = useList("cust", "/master/customers", can("master.read") && kind === "penjualan", {}, false);

  const loading = overview.isLoading || [sos, pos, invoices, transfers, stock].some((q) => q.isLoading);
  const t = today();
  const st = (rows: Row[] | undefined, ...s: string[]) => (rows ?? []).filter((r) => s.includes(r.status));
  const sum = (rows: Row[], k = "total_amount") => rows.reduce((a, r) => a + num(r[k]), 0);

  const actions: Action[] = [];
  if (can("procurement.approve")) {
    const r = st(pos.data, "PENDING_APPROVAL");
    if (r.length) actions.push({ n: r.length, text: "pesanan pembelian menunggu persetujuan", sub: `${compactRupiah(sum(r))} · ${r[0]!.po_no}`, to: "/procurement/orders?status=PENDING_APPROVAL", cta: "Tinjau", glyph: "pesanan-pembelian" });
  }
  if (can("payments.write") && can("accounting.read")) {
    const od = (invoices.data ?? []).filter((i) => i.type === "AR" && i.status !== "PAID" && i.status !== "VOID" && i.due_date < t).sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
    if (od.length) actions.push({ n: od.length, text: "faktur piutang lewat jatuh tempo", sub: `${compactRupiah(sum(od, "outstanding"))} · tertua ${od[0]!.invoice_no}, terlambat ${daysBetween(od[0]!.due_date, t)} hari`, to: "/accounting/invoices?status=OPEN", cta: "Tinjau", glyph: "faktur" });
    const ap = (invoices.data ?? []).filter((i) => i.type === "AP" && i.status !== "PAID" && i.status !== "VOID" && daysBetween(t, i.due_date) <= 14);
    if (ap.length) actions.push({ n: ap.length, text: "tagihan pemasok jatuh tempo dalam 14 hari", sub: `${compactRupiah(sum(ap, "outstanding"))}`, to: "/accounting/invoices", cta: "Bayar", glyph: "faktur" });
  }
  if (can("sales.write")) {
    const dv = st(sos.data, "DELIVERED");
    if (dv.length) actions.push({ n: dv.length, text: "pesanan terkirim belum difaktur", sub: `${dv[0]!.so_no} · ${dv[0]!.customer_name}`, to: "/sales/orders?status=DELIVERED", cta: "Buat faktur", glyph: "faktur" });
    const qt = st(sos.data, "QUOTATION");
    if (qt.length) actions.push({ n: qt.length, text: "penawaran menunggu konfirmasi", sub: `${compactRupiah(sum(qt))}`, to: "/sales/orders?status=QUOTATION", cta: "Tinjau", glyph: "pesanan-penjualan" });
  }
  if (can("inventory.write")) {
    const cf = st(sos.data, "CONFIRMED_SO");
    if (cf.length) actions.push({ n: cf.length, text: "pesanan terkonfirmasi menunggu pengiriman", sub: `${cf[0]!.so_no} · stok sudah dicadangkan`, to: "/sales/orders?status=CONFIRMED_SO", cta: "Kirim", glyph: "pengiriman" });
    const tr = st(transfers.data, "REQUESTED", "IN_TRANSIT");
    if (tr.length) actions.push({ n: tr.length, text: "transfer antar gudang belum selesai", sub: `${st(tr, "REQUESTED").length} belum dikirim · ${st(tr, "IN_TRANSIT").length} dalam perjalanan`, to: "/inventory/transfers", cta: "Lihat", glyph: "transfer" });
  }
  if (can("procurement.write")) {
    const rc = st(pos.data, "RECEIVED");
    if (rc.length) actions.push({ n: rc.length, text: "pesanan pembelian diterima belum ditagih", sub: `${compactRupiah(sum(rc))} menunggu tagihan pemasok`, to: "/procurement/orders?status=RECEIVED", cta: "Tinjau", glyph: "penerimaan-barang" });
    const dr = st(pos.data, "DRAFT");
    if (dr.length) actions.push({ n: dr.length, text: "pesanan pembelian draf belum diajukan", sub: dr.map((d) => d.po_no).slice(0, 2).join(", "), to: "/procurement/orders?status=DRAFT", cta: "Ajukan", glyph: "pesanan-pembelian" });
  }
  const low = (stock.data ?? []).filter((r) => r.is_low);
  if (low.length && (can("inventory.write") || can("procurement.write"))) actions.push({ n: low.length, text: "item di bawah titik pesan ulang", sub: `${low[0]!.sku} tersisa ${qty(low[0]!.available)} dari titik ${qty(low[0]!.reorder_point)}`, to: "/inventory/reorder", cta: "Lihat saran", glyph: "pesan-ulang" });
  const shown = actions.slice(0, 4);

  const k = overview.data?.kpis;
  const trend = overview.data?.trend ?? [];
  const asOf = overview.data ? new Date(overview.data.as_of) : new Date();
  const prevMonth = new Date(asOf.getFullYear(), asOf.getMonth() - 1, 1).toLocaleDateString("id-ID", { month: "long" });
  const monthName = asOf.toLocaleDateString("id-ID", { month: "long" });
  const branchName = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`;
  const lastGross = trend.length ? num(trend[trend.length - 1]!.gross_profit) : 0;
  const prevGross = trend.length > 1 ? num(trend[trend.length - 2]!.gross_profit) : 0;
  const grossChange = prevGross ? ((lastGross - prevGross) / prevGross) * 100 : null;
  const openPo = sum(st(pos.data, "PENDING_APPROVAL", "APPROVED", "PARTIALLY_RECEIVED"));
  const cat = useMemo(() => {
    const m = new Map((products.data ?? []).map((p) => [p.id as number, p.category?.name ?? "Tanpa kategori"]));
    return (id: number) => (m.get(id) as string | undefined) ?? "Tanpa kategori";
  }, [products.data]);

  // Kepala kontekstual (5.9): fakta, bukan sapaan.
  const head = [new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" }),
    period ? `Periode ${new Date(period.start_date + "T00:00:00").toLocaleDateString("id-ID", { month: "long" })} ${period.status === "CLOSED" ? "ditutup" : "terbuka"}` : null,
    loading ? null : actions.length ? `${actions.length} hal perlu tindakan` : "Tidak ada yang perlu ditindaklanjuti",
    branchId ? branchName(branchId) : "semua cabang"].filter(Boolean).join(" · ");

  let main: ReactNode = null;
  let side: ReactNode = null;
  if (k) {
    if (kind === "pimpinan") {
      side = <><Kpi big label={`Laba kotor ${monthName}`} value={lastGross} spark={trend.map((m) => num(m.gross_profit))} change={grossChange} prev={prevMonth} zero="Belum ada penjualan bulan ini" />
        <div className="mt-4"><Kpi label="Pendapatan bersih" value={num(k.net_revenue)} /><Kpi label="Kas dan bank" value={num(k.cash_balance)} /><Kpi label="Nilai persediaan FIFO" value={num(k.inventory_value)} /></div>
        <p className="mt-2 text-table text-muted">Margin kotor {num(k.gross_margin_pct).toFixed(1).replace(".", ",")}%</p></>;
      main = <section className="sheet px-5 pb-4 pt-4"><SectionTitle>Penjualan dan harga pokok, 6 bulan</SectionTitle>
        <TrendChart data={trend.map((m) => ({ month: monthLabel(m.month), a: num(m.revenue) / 1e6, b: num(m.cogs) / 1e6 }))} aLabel="Pendapatan" bLabel="HPP" label="Pendapatan dan harga pokok penjualan bulanan, jutaan rupiah" />
        {(overview.data?.sales_by_category.length ?? 0) > 0 && <div className="mt-5 border-t border-line pt-4"><SectionTitle>Penjualan per kategori, 6 bulan</SectionTitle><CategoryBars rows={overview.data!.sales_by_category} /></div>}
        {!FEATURES.goodsFlow && <p className="mt-3 text-xs text-muted">Peta aliran barang belum tersedia: API belum punya laporan aliran per tahap.</p>}
      </section>;
    } else if (kind === "keuangan") {
      side = <><Kpi big label="Kas dan bank" value={num(k.cash_balance)} spark={trend.map((m) => num(m.net_cash))} />
        <div className="mt-4"><Kpi label="Piutang berjalan" value={num(k.total_receivables)} /><Kpi label="Lewat jatuh tempo" value={num(k.overdue_receivables)} zero="Tidak ada piutang terlambat" /><Kpi label={`Laba bersih ${monthName}`} value={num(k.net_income)} /></div></>;
      main = <section className="sheet px-5 py-4"><SectionTitle>Piutang menurut umur</SectionTitle>
        {aging.data ? <AgingStrips data={aging.data} /> : <Pencil w={70} />}
        <div className="mt-5 border-t border-line pt-4"><SectionTitle>Jurnal terbaru</SectionTitle><JournalRows rows={journals.data ?? []} /></div>
      </section>;
    } else if (kind === "penjualan") {
      side = <><Kpi big label={`Penjualan ${monthName}`} value={num(k.net_revenue)} spark={trend.map((m) => num(m.revenue))} change={k.net_revenue_change_pct} prev={prevMonth} zero="Belum ada penjualan bulan ini" />
        <div className="mt-4"><Kpi label="Piutang berjalan" value={num(k.total_receivables)} /><Kpi label="Lewat jatuh tempo" value={num(k.overdue_receivables)} zero="Tidak ada piutang terlambat" /></div></>;
      main = <section className="sheet px-5 py-4"><SectionTitle>Pelanggan dengan piutang</SectionTitle>
        {aging.data ? (aging.data.rows.length ? <ul className="divide-y divide-line text-table">{aging.data.rows.map((r: Row) => <li key={r.party_id} className="flex justify-between py-2"><span>{(customers.data ?? []).find((c) => c.id === r.party_id)?.name ?? `Pelanggan #${r.party_id}`}</span><span className="font-num">{compactRupiah(r.total)}{num(r.d0_30) + num(r.d31_60) + num(r.d61_90) + num(r.d90_plus) > 0 && <span className="ml-2 text-bad">terlambat</span>}</span></li>)}</ul> : <p className="text-muted">Tidak ada piutang berjalan.</p>) : <Pencil w={60} />}
        <div className="mt-5 border-t border-line pt-4"><SectionTitle>Retur terbaru</SectionTitle>
          {(returns.data ?? []).length ? <ul className="divide-y divide-line text-table">{returns.data!.slice(0, 4).map((r) => <li key={r.id} className="flex justify-between py-2"><RoomLink to={`/sales/returns/${r.id}`} room={roomName("ret", r.id)} className="code hover:underline">{r.return_no}</RoomLink><span className="font-num">{compactRupiah(r.total_amount)}</span></li>)}</ul> : <p className="text-muted">Belum ada retur.</p>}</div>
      </section>;
    } else if (kind === "gudang") {
      side = <><Kpi big label="Nilai persediaan FIFO" value={num(k.inventory_value)} />
        <div className="mt-4 text-table">
          <p className="flex justify-between border-b border-line py-2"><span className="text-muted">Item stok kritis</span><span className="font-num font-medium">{k.low_stock_count}</span></p>
          <p className="flex justify-between border-b border-line py-2"><span className="text-muted">Penerimaan hari ini</span><span className="font-num font-medium">{(grn.data ?? []).filter((g) => g.received_date === t).length}</span></p>
          <p className="flex justify-between py-2"><span className="text-muted">Menunggu pengiriman</span><span className="font-num font-medium">{st(sos.data, "CONFIRMED_SO").length}</span></p>
        </div></>;
      main = <section className="sheet px-5 py-4"><div className="flex items-baseline justify-between"><SectionTitle>Gudang hidup</SectionTitle><Link to="/inventory/stock" className="text-table text-brand hover:underline">Level stok</Link></div>
        <p className="mb-2 text-xs text-muted">Disusun per kategori, bukan denah fisik.</p>
        {FEATURES.warehouseIso && (stock.data ?? []).length > 0 ? (
          <Suspense fallback={<Pencil w={50} />}>
            <div className="grid gap-4 md:grid-cols-2">{[...(stock.data as Row[]).reduce<Map<number, Row[]>>((m, r) => m.set(r.branch_id, [...(m.get(r.branch_id) ?? []), r]), new Map())].map(([id, rows]) => (
              <figure key={id} className="min-w-0"><figcaption className="text-table font-medium">{branchName(id)}</figcaption><WarehouseIso compact rows={rows as never} categoryOf={cat} title={`Gudang ${branchName(id)}`} /></figure>
            ))}</div>
          </Suspense>
        ) : <EmptyState art="rak-kosong">Belum ada stok.</EmptyState>}
        {low.length > 0 && <div className="mt-4 border-t border-line pt-3"><SectionTitle>Stok kritis</SectionTitle><ul className="text-table">{low.slice(0, 5).map((r) => <li key={`${r.sku}-${r.branch_id}`} className="flex justify-between py-1"><span><span className="code">{r.sku}</span> · {branchName(r.branch_id)}</span><span className="font-num">{qty(r.available)} / {qty(r.reorder_point)}</span></li>)}</ul></div>}
      </section>;
    }
  }
  if (kind === "pengadaan") {
    side = <><Kpi big label="Nilai pesanan pembelian terbuka" value={openPo} zero="Tidak ada pesanan terbuka" />
      <div className="mt-4 text-table"><p className="flex justify-between border-b border-line py-2"><span className="text-muted">Item stok kritis</span><span className="font-num font-medium">{low.length}</span></p>
        <p className="flex justify-between py-2"><span className="text-muted">Menunggu persetujuan</span><span className="font-num font-medium">{st(pos.data, "PENDING_APPROVAL").length}</span></p></div></>;
    main = <section className="sheet px-5 py-4"><SectionTitle>Pesanan pembelian terbaru</SectionTitle>
      <ul className="divide-y divide-line text-table">{(pos.data ?? []).slice(0, 6).map((p) => <li key={p.id} className="flex items-center justify-between gap-3 py-2"><RoomLink to={`/procurement/orders/${p.id}`} room={roomName("po", p.id)} className="code hover:underline">{p.po_no}</RoomLink><span className="min-w-0 flex-1 truncate text-muted">{p.supplier_name}</span><span className="font-num">{compactRupiah(p.total_amount)}</span></li>)}</ul></section>;
  }
  if (kind === "auditor") {
    const week = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    side = <div><p className="text-table font-semibold">Kejadian audit 7 hari terakhir</p><p className="font-serif text-display font-medium"><MechanicalNumber value={(audit.data ?? []).filter((a) => String(a.created_at).slice(0, 10) >= week).length} /></p></div>;
    main = <section className="sheet px-5 py-4"><SectionTitle>Kejadian terbaru</SectionTitle>
      <ul className="divide-y divide-line">{(audit.data ?? []).slice(0, 8).map((a) => (<li key={a.id} className="py-2 text-table"><span className="font-medium">{activityPhrase(a.action, a.entity_type)}</span><span className="text-muted"> · {a.user ?? "Sistem"} · {date(a.created_at)}</span></li>))}</ul>
      <div className="mt-5 border-t border-line pt-4"><SectionTitle>Jurnal terbaru</SectionTitle><JournalRows rows={journals.data ?? []} /></div></section>;
  }

  return (
    <>
      <div className="mb-6 border-b border-ink pb-4">
        <h1 tabIndex={-1} className="font-serif text-xl font-medium outline-none max-md:text-[26px]">Dasbor</h1>
        <p className="mt-1 text-table text-muted">{head}</p>
      </div>
      {overview.isError && <ErrorNote error={overview.error} retry={() => overview.refetch()} />}

      <section aria-labelledby="todo">
        <SectionTitle id="todo">Perlu tindakan</SectionTitle>
        {loading ? <TaskSkeleton /> : shown.length === 0 ? <EmptyState art="map-kosong">Tidak ada yang perlu ditindaklanjuti sekarang.</EmptyState> : (
          <ul className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{shown.map((a) => <li key={a.text}><TaskCard a={a} /></li>)}</ul>
        )}
        {actions.length > 4 && <p className="mt-2 text-table text-muted">Dan {actions.length - 4} hal lain di menu dengan titik tugas.</p>}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">{loading && !main ? <div className="sheet h-72 p-6"><Pencil w={40} /></div> : main}</div>
        <aside className="min-w-0">{side ? <div className="sheet px-5 py-4">{side}</div> : loading ? <div className="sheet h-48 p-6"><Pencil w={50} /></div> : null}</aside>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {(overview.data?.recent_activity.length ?? 0) > 0 && (
          <section className="sheet px-5 py-4" aria-label="Aktivitas terbaru">
            <SectionTitle>Aktivitas terbaru</SectionTitle>
            <ol className="relative ml-2 border-l border-accent/25 pl-5">
              {overview.data!.recent_activity.slice(0, 6).map((a) => (
                <li key={a.id} className="relative pb-3 last:pb-0"><span aria-hidden="true" className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-ink" />
                  <p className="text-table">{activityPhrase(a.action, a.entity_type)}</p><p className="text-xs text-muted">{a.user} · {date(a.created_at)}</p></li>
              ))}
            </ol>
          </section>
        )}
        <section className="sheet px-5 py-4" aria-label="Pintasan">
          <SectionTitle>Pintasan</SectionTitle>
          <ul className="grid gap-1 text-table">
            {SHORTCUTS.filter((s) => can(s.perm)).slice(0, 5).map((s) => <li key={s.to}><Link to={s.to} className="flex min-h-9 items-center gap-2 rounded px-1 hover:bg-highlight"><Glyph name={s.glyph} size={18} />{s.label}</Link></li>)}
          </ul>
          {can("users.manage") && users.data && <p className="mt-3 border-t border-line pt-3 text-table text-muted">{users.data.filter((u) => u.is_active).length} pengguna aktif dari {users.data.length}</p>}
        </section>
      </div>
      <p className="mt-6 text-xs text-muted">Jumlah tugas dihitung dari 200 dokumen terbaru per daftar. Angka resmi ada di laporan keuangan.</p>
    </>
  );
}

const SHORTCUTS: { label: string; to: string; perm: string; glyph: GlyphName }[] = [
  { label: "Buat pesanan penjualan", to: "/sales/orders/new", perm: "sales.write", glyph: "pesanan-penjualan" },
  { label: "Buat pesanan pembelian", to: "/procurement/orders/new", perm: "procurement.write", glyph: "pesanan-pembelian" },
  { label: "Buat jurnal", to: "/accounting/journals/new", perm: "accounting.post", glyph: "tinta" },
  { label: "Laporan keuangan", to: "/accounting/reports", perm: "accounting.read", glyph: "laporan" },
  { label: "Level stok", to: "/inventory/stock", perm: "inventory.read", glyph: "level-stok" },
  { label: "Periode fiskal", to: "/accounting/periods", perm: "accounting.close", glyph: "periode" },
  { label: "Log audit", to: "/system/audit", perm: "audit.read", glyph: "audit" },
];

function JournalRows({ rows }: { rows: Row[] }) {
  if (!rows.length) return <p className="text-muted">Belum ada jurnal.</p>;
  return (
    <ul className="divide-y divide-line text-table">
      {rows.slice(0, 5).map((j) => (
        <li key={j.id}><button type="button" onClick={() => openJournal({ id: j.id, date: j.entry_date })} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-3 py-2 text-left hover:bg-highlight">
          <span className="code">{j.entry_no}</span><span className="truncate text-muted">{j.description}</span><span className="font-num">{compactRupiah(j.total)}</span></button></li>
      ))}
    </ul>
  );
}

/** Batang horizontal satu warna (satu seri), label langsung, angka tertulis. */
function CategoryBars({ rows }: { rows: { category: string; amount: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => num(r.amount)));
  return (
    <ul className="grid gap-2">{rows.map((r) => (
      <li key={r.category} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 text-table">
        <span className="truncate">{r.category}</span>
        <span className="h-3 rounded-r-sm bg-accent/80" style={{ width: `${(num(r.amount) / max) * 100}%` }} aria-hidden="true" />
        <span className="font-num">{compactRupiah(r.amount)}</span>
      </li>
    ))}</ul>
  );
}

/** Kerangka berbentuk kartu tugas, agar halaman tidak melompat saat kartu datang. */
const TaskSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="sheet flex h-[92px] items-center gap-4 px-4"><span className="pencil h-7 w-6" /><div className="grid flex-1 gap-2"><Pencil i={i} /><Pencil i={i + 3} /></div></div>
    ))}
  </div>
);
