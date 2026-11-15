import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { toast } from "../components/Toaster";
import { ErrorNote, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { date, num, qty, rupiah, today } from "../lib/format";

type Row = Record<string, any>;

export function Returns() {
  const q = useQuery({ queryKey: ["returns"], queryFn: () => api<Row[]>("/sales/returns") });
  const columns: ColumnDef<Row, any>[] = [
    { header: "Return", accessorKey: "return_no" },
    { header: "Date", accessorKey: "return_date", cell: (c) => date(c.getValue()) },
    { header: "Reason", accessorKey: "reason" },
    { header: "Items", accessorKey: "items", enableColumnFilter: false, cell: (c) => c.getValue().map((i: Row) => `${i.sku} × ${qty(i.quantity)}`).join(", ") },
    { header: "Credit", accessorKey: "total_amount", meta: { right: true }, cell: (c) => rupiah(c.getValue()) },
    { header: "Cost restocked", accessorKey: "cogs_reversed", meta: { right: true }, cell: (c) => rupiah(c.getValue()) },
  ];
  return (
    <>
      <PageHeader title="Sales returns" note="Each return credits the invoice and puts stock back at the cost it left the warehouse with." />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : <DataTable<Row> label="Sales returns" data={q.data ?? []} columns={columns} loading={q.isLoading} />}
    </>
  );
}

export function NewReturn() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const so = useQuery({ queryKey: ["so", id], queryFn: () => api<Row>(`/sales/orders/${id}`) });
  const prior = useQuery({ queryKey: ["returns"], queryFn: () => api<Row[]>("/sales/returns") });
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [when, setWhen] = useState(today());
  const [error, setError] = useState<string | null>(null);

  const returned = (pid: number) =>
    (prior.data ?? []).filter((r) => String(r.so_id) === id).reduce((s, r) => s + r.items.filter((i: Row) => i.product_id === pid).reduce((t: number, i: Row) => t + num(i.quantity), 0), 0);

  const save = useMutation({
    mutationFn: (items: { product_id: number; quantity: string }[]) => api("/sales/orders/" + id + "/return", { method: "POST", body: { return_date: when, reason: reason || null, items } }),
    onSuccess: () => { for (const k of ["returns", "sos", "stock", "invoices", "overview", "journals"]) void qc.invalidateQueries({ queryKey: [k] }); toast("Return recorded."); nav("/sales/returns"); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not record the return."),
  });

  if (so.isError) return <ErrorNote error={so.error} retry={() => so.refetch()} />;
  const d = so.data;
  if (!d) return <div className="h-48 animate-pulse rounded-lg bg-sunken" />;
  const lines: Row[] = (d.items as Row[]).map((i) => ({ ...i, left: num(i.quantity) - returned(i.product_id) }));
  const picked = lines.filter((l) => num(amounts[l.product_id]) > 0);
  const credit = picked.reduce((s, l) => s + num(amounts[l.product_id]) * num(l.unit_price), 0);
  const tooMany = picked.some((l) => num(amounts[l.product_id]) > l.left);

  return (
    <>
      <PageHeader title={`Return from ${d.so_no}`} note={`${d.customer_name}. Only invoiced orders can be returned, and the credit cannot exceed what the customer still owes.`} />
      <form onSubmit={(e) => { e.preventDefault(); setError(null); save.mutate(picked.map((l) => ({ product_id: l.product_id, quantity: amounts[l.product_id]! }))); }}
        className="max-w-3xl space-y-5 rounded-lg border border-line bg-surface p-5">
        {error && <p role="alert" className="rounded-md border border-bad/40 bg-bad/5 p-2.5 text-sm text-bad">{error}</p>}
        <table className="w-full text-sm" aria-label="Items to return">
          <thead><tr className="border-b border-line text-left text-muted"><th className="py-2 font-medium">Item</th><th className="py-2 text-right font-medium">Sold</th><th className="py-2 text-right font-medium">Can return</th><th className="py-2 text-right font-medium">Return qty</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-line/60">
                <td className="py-2"><span className="text-muted">{l.sku}</span> {l.name}</td>
                <td className="py-2 text-right tabular-nums">{qty(l.quantity)}</td>
                <td className="py-2 text-right tabular-nums">{qty(l.left)}</td>
                <td className="py-2 text-right">
                  <input className="field ml-auto h-8 w-24 text-right" type="number" min="0" max={l.left} step="any" disabled={l.left <= 0} aria-label={`Return quantity for ${l.sku}`}
                    value={amounts[l.product_id] ?? ""} onChange={(e) => setAmounts({ ...amounts, [l.product_id]: e.target.value })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Return date<input className="field mt-1" type="date" required value={when} onChange={(e) => setWhen(e.target.value)} /></label>
          <label className="text-sm font-medium">Reason<input className="field mt-1" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged, wrong item…" /></label>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm">Credit to customer <strong className="ml-1 text-base">{rupiah(credit, true)}</strong></p>
          <div className="flex gap-2">
            <Link className="btn" to="/sales/orders">Cancel</Link>
            <button className="btn btn-primary" disabled={picked.length === 0 || tooMany || save.isPending}>{save.isPending ? "Saving…" : "Record return"}</button>
          </div>
        </div>
        {tooMany && <p role="alert" className="text-sm text-bad">A quantity is higher than what can still be returned.</p>}
      </form>
    </>
  );
}
