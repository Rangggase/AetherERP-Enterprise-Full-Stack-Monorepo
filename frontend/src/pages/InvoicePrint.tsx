import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ErrorNote } from "../components/ui";
import { api } from "../lib/api";
import { date, qty, rupiah } from "../lib/format";

type Row = Record<string, any>;

export function InvoicePrint() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["invoice", id], queryFn: () => api<Row>(`/invoices/${id}`) });
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  if (!d) return <div className="h-64 animate-pulse rounded-lg bg-sunken" />;
  const ar = d.type === "AR";
  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to="/accounting/invoices" className="text-sm text-muted hover:text-ink">Back to invoices</Link>
        <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} aria-hidden /> Print</button>
      </div>
      <article className="mx-auto max-w-3xl rounded-lg border border-line bg-surface p-8 print:max-w-none print:rounded-none print:border-0 print:p-0 print:text-black">
        <header className="flex items-start justify-between border-b border-line pb-5">
          <div>
            <p className="text-xl font-semibold">AetherERP</p>
            <p className="text-sm text-muted">{d.branch_name}</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-semibold">{ar ? "Invoice" : "Supplier bill"}</h1>
            <p className="text-sm">{d.invoice_no}</p>
          </div>
        </header>
        <section className="grid gap-4 py-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted">{ar ? "Billed to" : "Supplier"}</p>
            <p className="font-medium">{d.party?.name}</p>
            {d.party?.tax_id && <p>Tax ID {d.party.tax_id}</p>}
            {d.party?.email && <p>{d.party.email}</p>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:justify-self-end">
            <dt className="text-muted">Date</dt><dd className="text-right">{date(d.invoice_date)}</dd>
            <dt className="text-muted">Due</dt><dd className="text-right">{date(d.due_date)}</dd>
            <dt className="text-muted">{ar ? "Sales order" : "Purchase order"}</dt><dd className="text-right">{d.reference ?? "–"}</dd>
          </dl>
        </section>
        <table className="w-full text-sm">
          <thead><tr className="border-y border-line text-left text-muted"><th className="py-2 font-medium">Item</th><th className="py-2 text-right font-medium">Qty</th><th className="py-2 text-right font-medium">Unit price</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
          <tbody>
            {d.lines.map((l: Row, i: number) => (
              <tr key={i} className="border-b border-line/60"><td className="py-2"><span className="text-muted">{l.sku}</span> {l.name}</td><td className="py-2 text-right tabular-nums">{qty(l.quantity)}</td><td className="py-2 text-right tabular-nums">{rupiah(l.unit_price, true)}</td><td className="py-2 text-right tabular-nums">{rupiah(l.amount, true)}</td></tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Total</dt><dd className="tabular-nums">{rupiah(d.total_amount, true)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Paid</dt><dd className="tabular-nums">{rupiah(d.paid_amount, true)}</dd></div>
          <div className="flex justify-between border-t border-line pt-1 text-base font-semibold"><dt>Amount due</dt><dd className="tabular-nums">{rupiah(d.outstanding, true)}</dd></div>
        </dl>
        {d.payments.length > 0 && (
          <section className="mt-6 text-sm">
            <h2 className="mb-1 font-medium">Payments received</h2>
            <ul className="space-y-0.5 text-muted">{d.payments.map((p: Row) => (<li key={p.payment_no}>{date(p.payment_date)} · {p.payment_no} · {rupiah(p.amount, true)}</li>))}</ul>
          </section>
        )}
      </article>
    </>
  );
}
