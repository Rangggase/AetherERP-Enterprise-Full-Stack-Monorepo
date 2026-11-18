import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ScrollX } from "../components/ScrollX";
import { useCrumb } from "../components/Shell";
import { toast } from "../components/Toaster";
import { ErrorNote, SectionTitle, Status, statusText } from "../components/ui";
import { PO_STEPS, ReturnLink, returnable, RowActions, SO_STEPS, useTransition, type Row } from "../lib/actions";
import { api } from "../lib/api";
import { date, dateTime, num, qty, rupiah } from "../lib/format";
import { useSession } from "../lib/session";
import type { Page } from "../lib/types";

/** Stage line built from the existing statuses: finished stages in ink, the current one in the accent colour. */
function Stages({ stages, current }: { stages: { key: string; label: string }[]; current: number }) {
  return (
    <ol className="mt-4 flex flex-wrap text-table" aria-label="Tahap dokumen">
      {stages.map((s, i) => (
        <li key={s.key} aria-current={i === current ? "step" : undefined}
          className={`min-w-[45%] flex-1 border-t-2 pr-2 pt-2 md:min-w-0 ${i < current ? "border-ink" : i === current ? "border-brand font-semibold text-brand" : "border-line text-muted"} max-md:mb-2`}>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function DocHeader({ kind, number, line, actions }: { kind: string; number: string; line: string; actions: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-ink pb-4">
      <div className="min-w-0">
        <p className="text-table text-muted">{kind}</p>
        <h1 className="font-serif text-xl font-medium max-md:text-[26px]">{number}</h1>
        <p className="mt-1 text-table text-muted">{line}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>
    </div>
  );
}

const Facts = ({ items }: { items: [string, ReactNode][] }) => (
  <dl className="grid max-w-xl grid-cols-[200px_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm max-md:grid-cols-[auto_1fr]">
    {items.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>))}
  </dl>
);

function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div role="tablist" aria-label="Isi dokumen" className="mb-4 mt-8 flex gap-6 overflow-x-auto border-b border-line print:hidden">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={active === t} onClick={() => onChange(t)}
          className={`-mb-px border-b-2 py-2 text-sm transition-colors duration-base ease-out ${active === t ? "border-brand font-semibold" : "border-transparent text-muted hover:text-ink"}`}>{t}</button>
      ))}
    </div>
  );
}

/** Journals posted from a document: their descriptions carry the document number. */
function JournalTab({ docNo }: { docNo: string }) {
  const { can } = useSession();
  const q = useQuery({ queryKey: ["journals", "doc", docNo], enabled: can("accounting.read"), queryFn: async () => (await api<Page<Row>>("/accounting/journals", { params: { page_size: 200 } })).items });
  if (!can("accounting.read")) return <p className="text-muted">Jurnal hanya tampil untuk pengguna dengan izin akuntansi.</p>;
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  const rows = (q.data ?? []).filter((j) => String(j.description).includes(docNo));
  if (q.isLoading) return <div className="h-24 animate-pulse bg-sunken" />;
  if (!rows.length) return <p className="text-muted">Belum ada jurnal untuk dokumen ini. Jurnal muncul saat barang dikirim, diterima, ditagih, atau dibayar.</p>;
  return (
    <div className="space-y-6">
      {rows.map((j) => (
        <div key={j.id}>
          <p className="text-table"><span className="font-medium">{j.entry_no}</span> · {date(j.entry_date)} · <span className="text-muted">{j.description}</span></p>
          <ScrollX><table className="tbl dense mt-1"><thead><tr><th>Akun</th><th className="text-right">Debit</th><th className="text-right">Kredit</th></tr></thead>
            <tbody>{j.lines.map((l: Row, i: number) => (<tr key={i}><td>{l.account_code} {l.account_name}</td><td className="num">{num(l.debit) ? rupiah(l.debit, true) : ""}</td><td className="num">{num(l.credit) ? rupiah(l.credit, true) : ""}</td></tr>))}</tbody></table></ScrollX>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ entity, id }: { entity: string; id: number }) {
  const { can } = useSession();
  const q = useQuery({ queryKey: ["audit", "doc", entity, id], enabled: can("audit.read"), queryFn: async () => (await api<Page<Row>>("/audit-logs", { params: { entity_type: entity, page_size: 200 } })).items });
  if (!can("audit.read")) return <p className="text-muted">Riwayat lengkap hanya tampil untuk pengguna dengan izin audit.</p>;
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  const rows = (q.data ?? []).filter((a) => String(a.entity_id) === String(id));
  if (q.isLoading) return <div className="h-24 animate-pulse bg-sunken" />;
  if (!rows.length) return <p className="text-muted">Belum ada riwayat tercatat untuk dokumen ini.</p>;
  return (
    <ScrollX><table className="tbl dense"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Tindakan</th></tr></thead>
      <tbody>{rows.map((a) => <tr key={a.id}><td>{dateTime(a.created_at)}</td><td>{a.user ?? "Sistem"}</td><td>{a.action}</td></tr>)}</tbody></table></ScrollX>
  );
}

const ItemsTable = ({ rows, receivedCol }: { rows: Row[]; receivedCol?: boolean }) => {
  const total = rows.reduce((s, i) => s + num(i.quantity) * num(i.unit_price), 0);
  return (
    <ScrollX><table className="tbl">
      <thead><tr><th>SKU</th><th>Produk</th><th className="text-right">Jumlah</th>{receivedCol && <th className="text-right">Diterima</th>}<th className="text-right">Harga satuan</th><th className="text-right">Jumlah harga</th></tr></thead>
      <tbody>
        {rows.map((i) => (
          <tr key={i.id}><td>{i.sku}</td><td>{i.name}</td><td className="num">{qty(i.quantity)}</td>{receivedCol && <td className="num">{qty(i.received_qty)}</td>}<td className="num">{rupiah(i.unit_price)}</td><td className="num">{rupiah(num(i.quantity) * num(i.unit_price))}</td></tr>
        ))}
        <tr><td colSpan={receivedCol ? 5 : 4} className="num font-medium">Total</td><td className="num font-semibold">{rupiah(total)}</td></tr>
      </tbody>
    </table></ScrollX>
  );
};

export function SalesOrderDetail() {
  const { id } = useParams();
  const { can } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["so", id], queryFn: () => api<Row>(`/sales/orders/${id}`) });
  const run = useTransition(["so", "sos"], "/sales/orders");
  const inv = useQuery({ queryKey: ["invoices", { all: true }], queryFn: async () => (await api<Page<Row>>("/invoices", { params: { page_size: 200 } })).items, enabled: can("accounting.read") });
  const [tab, setTab] = useState("Item");
  useCrumb(q.data?.so_no);
  const pay = useMutation({
    mutationFn: (r: Row) => api(`/invoices/${r.id}/payments`, { method: "POST", body: { amount: r.outstanding } }),
    onSuccess: () => { toast("Pembayaran dicatat."); for (const k of ["so", "sos", "invoices", "invoice", "overview", "journals"]) void qc.invalidateQueries({ queryKey: [k] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Pembayaran gagal. Coba lagi.", "error"),
  });
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  if (!d) return <div className="h-48 animate-pulse bg-sunken" />;

  const flow = ["QUOTATION", "CONFIRMED_SO", "DELIVERED", "INVOICED", "PAID"];
  const idx = d.status === "PARTIALLY_PAID" ? 4 : Math.max(flow.indexOf(d.status), 0);
  const stages = flow.map((k) => ({ key: k, label: k === "PAID" && d.status === "PARTIALLY_PAID" ? "Dibayar sebagian" : k === "PAID" ? "Lunas" : statusText(k) }));
  // The API does not link an order to its invoice: take the customer's earliest invoice on or after the order date whose total fits.
  const invoiced = d.status === "INVOICED" || d.status === "PARTIALLY_PAID" || d.status === "PAID";
  const invoice = !invoiced ? null : (inv.data ?? []).filter((i) => i.type === "AR" && i.customer_id === d.customer_id && i.invoice_date >= d.order_date && num(i.total_amount) <= num(d.total_amount) && i.status !== "VOID")
    .sort((a, b) => (a.invoice_date < b.invoice_date ? -1 : 1))[0] ?? null;
  const closedInvoice = d.status === "INVOICED" || d.status === "PARTIALLY_PAID";

  return (
    <>
      <DocHeader kind="Pesanan penjualan" number={d.so_no} line={`${d.customer_name} · dipesan ${date(d.order_date)}`}
        actions={<>
          {invoice && <Link className="btn btn-text" to={`/accounting/invoices/${invoice.id}`}>Cetak faktur</Link>}
          <RowActions row={d} steps={SO_STEPS} run={run} size="md" extra={returnable(d.status) ? <ReturnLink id={d.id} size="md" /> : undefined} />
          {closedInvoice && invoice && can("payments.write") && <button className="btn btn-primary" disabled={pay.isPending} onClick={() => pay.mutate(invoice)}>Bayar penuh</button>}
        </>} />
      {d.status === "CANCELLED" ? <p className="mt-4"><Status value="CANCELLED" /></p> : <Stages stages={stages} current={idx} />}
      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div>
          <SectionTitle>Ringkasan</SectionTitle>
          <Facts items={[["Status", <Status key="s" value={d.status} />], ["Total pesanan", rupiah(d.total_amount)], ["Faktur", invoice ? `${invoice.invoice_no} · jatuh tempo ${date(invoice.due_date)}` : "Belum difaktur"],
            ...(invoice ? ([["Sudah dibayar", rupiah(invoice.paid_amount)], ["Sisa tagihan", <b key="o">{rupiah(invoice.outstanding)}</b>]] as [string, ReactNode][]) : [])]} />
        </div>
        <aside>
          <SectionTitle>Aksi di tahap ini</SectionTitle>
          <p className="text-table text-muted">{d.status === "QUOTATION" ? "Konfirmasi memeriksa batas kredit dan mencadangkan stok. Penawaran masih bisa dibatalkan." : d.status === "CONFIRMED_SO" ? "Kirim memotong stok secara FIFO dan mencatat harga pokok. Pesanan masih bisa dibatalkan." : d.status === "DELIVERED" ? "Buat faktur untuk menagih pelanggan." : closedInvoice ? "Bayar penuh atau catat retur. Pembatalan tidak tersedia setelah pesanan dikirim." : "Tidak ada aksi yang tersedia."}</p>
        </aside>
      </div>
      <Tabs tabs={["Item", "Jurnal", "Riwayat"]} active={tab} onChange={setTab} />
      {tab === "Item" && <ItemsTable rows={d.items} />}
      {tab === "Jurnal" && <JournalTab docNo={d.so_no} />}
      {tab === "Riwayat" && <HistoryTab entity="sales_order" id={d.id} />}
    </>
  );
}

export function PurchaseOrderDetail() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["po", id], queryFn: () => api<Row>(`/procurement/purchase-orders/${id}`) });
  const run = useTransition(["po", "pos"], "/procurement/purchase-orders");
  const [tab, setTab] = useState("Item");
  useCrumb(q.data?.po_no);
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  if (!d) return <div className="h-48 animate-pulse bg-sunken" />;
  const flow = ["DRAFT", "APPROVED", "RECEIVED", "BILLED", "PAID"];
  const idx = d.status === "PENDING_APPROVAL" ? 0 : d.status === "PARTIALLY_RECEIVED" ? 1 : Math.max(flow.indexOf(d.status), 0);
  const stages = flow.map((k, i) => ({ key: k, label: i === 0 && d.status === "PENDING_APPROVAL" ? "Perlu persetujuan" : i === 2 && d.status === "PARTIALLY_RECEIVED" ? "Diterima sebagian" : statusText(k) }));
  if (d.status === "PARTIALLY_RECEIVED") stages[1] = { key: "APPROVED", label: "Disetujui" };
  return (
    <>
      <DocHeader kind="Pesanan pembelian" number={d.po_no} line={`${d.supplier_name} · dipesan ${date(d.order_date)}`} actions={<RowActions row={d} steps={PO_STEPS} run={run} size="md" />} />
      {d.status === "CANCELLED" ? <p className="mt-4"><Status value="CANCELLED" /></p> : <Stages stages={stages} current={d.status === "PARTIALLY_RECEIVED" ? 2 : idx} />}
      <div className="mt-8 max-w-xl"><SectionTitle>Ringkasan</SectionTitle>
        <Facts items={[["Status", <Status key="s" value={d.status} />], ["Total pesanan", rupiah(d.total_amount)], ["Pemasok", d.supplier_name], ["Disetujui oleh", d.approved_by ? `Pengguna #${d.approved_by}` : "Belum"]]} /></div>
      <Tabs tabs={["Item", "Jurnal", "Riwayat"]} active={tab} onChange={setTab} />
      {tab === "Item" && <ItemsTable rows={d.items} receivedCol />}
      {tab === "Jurnal" && <JournalTab docNo={d.po_no} />}
      {tab === "Riwayat" && <HistoryTab entity="purchase_order" id={d.id} />}
    </>
  );
}

export function InvoiceDetail() {
  const { id } = useParams();
  const { can } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["invoice", id], queryFn: () => api<Row>(`/invoices/${id}`) });
  useCrumb(q.data?.invoice_no);
  const pay = useMutation({
    mutationFn: (r: Row) => api(`/invoices/${r.id}/payments`, { method: "POST", body: { amount: r.outstanding } }),
    onSuccess: () => { toast("Pembayaran dicatat."); for (const k of ["invoice", "invoices", "overview", "journals", "so"]) void qc.invalidateQueries({ queryKey: [k] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Pembayaran gagal. Coba lagi.", "error"),
  });
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  if (!d) return <div className="h-48 animate-pulse bg-sunken" />;
  const ar = d.type === "AR";
  const flow = ["OPEN", "PARTIALLY_PAID", "PAID"];
  return (
    <>
      <DocHeader kind={ar ? "Faktur piutang" : "Tagihan pemasok"} number={d.invoice_no} line={`${d.party?.name ?? ""} · ${d.branch_name ?? ""} · tanggal ${date(d.invoice_date)}`}
        actions={<>
          <button className="btn btn-text" onClick={() => window.print()}>Cetak</button>
          {can("payments.write") && d.status !== "PAID" && <button className="btn btn-primary" disabled={pay.isPending} onClick={() => pay.mutate(d)}>Bayar penuh</button>}
        </>} />
      <Stages stages={flow.map((k) => ({ key: k, label: statusText(k) === "Terbuka" ? "Terbuka" : statusText(k) }))} current={Math.max(flow.indexOf(d.status), 0)} />
      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div>
          <SectionTitle>Ringkasan</SectionTitle>
          <Facts items={[["Status", <Status key="s" value={d.status} />], [ar ? "Pelanggan" : "Pemasok", d.party?.name ?? "–"], ...(d.party?.tax_id ? ([["NPWP", d.party.tax_id]] as [string, ReactNode][]) : []),
            [ar ? "Pesanan penjualan" : "Pesanan pembelian", d.reference ? <Link key="r" className="underline" to={`/${ar ? "sales/orders" : "procurement/orders"}`}>{d.reference}</Link> : "–"],
            ["Jatuh tempo", date(d.due_date)], ["Total", rupiah(d.total_amount, true)], ["Dibayar", rupiah(d.paid_amount, true)], ["Sisa tagihan", <b key="o">{rupiah(d.outstanding, true)}</b>]]} />
        </div>
      </div>
      <h2 className="mb-2 mt-8 text-table font-semibold">Item</h2>
      <ScrollX><table className="tbl"><thead><tr><th>SKU</th><th>Produk</th><th className="text-right">Jumlah</th><th className="text-right">Harga satuan</th><th className="text-right">Jumlah harga</th></tr></thead>
        <tbody>{d.lines.map((l: Row, i: number) => (<tr key={i}><td>{l.sku}</td><td>{l.name}</td><td className="num">{qty(l.quantity)}</td><td className="num">{rupiah(l.unit_price, true)}</td><td className="num">{rupiah(l.amount, true)}</td></tr>))}</tbody></table></ScrollX>
      {d.payments.length > 0 && (<>
        <h2 className="mb-2 mt-8 text-table font-semibold">Pembayaran</h2>
        <ScrollX><table className="tbl dense"><tbody>{d.payments.map((p: Row) => (<tr key={p.payment_no}><td>{date(p.payment_date)}</td><td>{p.payment_no}</td><td className="num">{rupiah(p.amount, true)}</td></tr>))}</tbody></table></ScrollX>
      </>)}
      <div className="mt-8 print:hidden"><JournalTabInvoice docNo={d.invoice_no} /></div>
    </>
  );
}

function JournalTabInvoice({ docNo }: { docNo: string }) {
  return (<><h2 className="mb-2 text-table font-semibold">Jurnal</h2><JournalTab docNo={docNo} /></>);
}
