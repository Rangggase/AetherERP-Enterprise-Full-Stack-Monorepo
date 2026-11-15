import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { toast } from "../components/Toaster";
import { ErrorNote, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { qty, rupiah } from "../lib/format";
import { useSession } from "../lib/session";

type Row = Record<string, any>;
const R = { right: true };
const col = (header: string, accessorKey: string, extra: Partial<ColumnDef<Row, any>> = {}) => ({ header, accessorKey, ...extra }) as ColumnDef<Row, any>;
const money = (h: string, k: string) => col(h, k, { cell: (c) => rupiah(c.getValue()), meta: R });

function MasterList({ title, note, path, queryKey, columns, newTo }: { title: string; note: string; path: string; queryKey: string; columns: ColumnDef<Row, any>[]; newTo: string }) {
  const { can } = useSession();
  const q = useQuery({ queryKey: [queryKey], queryFn: () => api<Row[]>(path) });
  return (
    <>
      <PageHeader title={title} note={note} actions={can("master.write") && <Link className="btn btn-primary" to={newTo}>New {title.toLowerCase().replace(/s$/, "")}</Link>} />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : <DataTable<Row> label={title} data={q.data ?? []} columns={columns} loading={q.isLoading} />}
    </>
  );
}

export const Products = () => (
  <MasterList title="Products" note="Raw materials, finished goods and services. Reorder point drives low-stock alerts." path="/master/products" queryKey="products" newTo="/master/products/new"
    columns={[col("SKU", "sku"), col("Name", "name"), col("Type", "product_type", { cell: (c) => String(c.getValue()).replace("_", " ").toLowerCase() }), col("Unit", "uom"),
      money("Standard cost", "standard_cost"), money("Sale price", "sale_price"), col("Reorder point", "reorder_point", { cell: (c) => qty(c.getValue()), meta: R })]} />
);
export const Suppliers = () => (
  <MasterList title="Suppliers" note="Payment terms set the due date on vendor bills." path="/master/suppliers" queryKey="suppliers" newTo="/master/suppliers/new"
    columns={[col("Code", "code"), col("Name", "name"), col("Tax ID", "tax_id"), col("Email", "email"), col("Terms (days)", "payment_term_days", { meta: R })]} />
);
export const Customers = () => (
  <MasterList title="Customers" note="The credit limit is checked every time a sales order is confirmed." path="/master/customers" queryKey="customers" newTo="/sales/customers/new"
    columns={[col("Code", "code"), col("Name", "name"), col("Segment", "segment"), money("Credit limit", "credit_limit"), col("Terms (days)", "payment_term_days", { meta: R })]} />
);

interface Field { name: string; label: string; type?: "text" | "number" | "email" | "select"; options?: [string, string][]; required?: boolean; hint?: string }

function MasterForm({ title, note, path, back, keys, fields, initial }: { title: string; note: string; path: string; back: string; keys: string[]; fields: Field[]; initial: Record<string, string> }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Row) => api(path, { method: "POST", body }),
    onSuccess: () => { keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] })); toast("Saved."); nav(back); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body: Row = {};
    for (const f of fields) {
      const raw = v[f.name] ?? "";
      if (raw === "" && !f.required) continue;
      body[f.name] = raw; // numbers stay strings: the API parses exact decimals
    }
    save.mutate(body);
  }
  return (
    <>
      <PageHeader title={title} note={note} />
      <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-lg border border-line bg-surface p-5">
        {error && <p role="alert" className="rounded-md border border-bad/40 bg-bad/5 p-2.5 text-sm text-bad">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.name} className="text-sm font-medium">
              {f.label}{f.required && <span aria-hidden className="text-bad"> *</span>}
              {f.type === "select" ? (
                <select className="field mt-1" required={f.required} value={v[f.name] ?? ""} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>
                  {f.options!.map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
                </select>
              ) : (
                <input className="field mt-1" type={f.type ?? "text"} min={f.type === "number" ? 0 : undefined} step={f.type === "number" ? "any" : undefined}
                  required={f.required} value={v[f.name] ?? ""} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
              )}
              {f.hint && <span className="mt-1 block text-xs font-normal text-muted">{f.hint}</span>}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Link className="btn" to={back}>Cancel</Link>
          <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </>
  );
}

const TYPES: [string, string][] = [["RAW_MATERIAL", "Raw material"], ["FINISHED_GOOD", "Finished good"], ["SERVICE", "Service"]];

export const NewProduct = () => (
  <MasterForm title="New product" note="The SKU must be unique and cannot be reused." path="/master/products" back="/master/products" keys={["products"]}
    initial={{ product_type: "FINISHED_GOOD", uom: "PCS" }}
    fields={[
      { name: "sku", label: "SKU", required: true }, { name: "name", label: "Name", required: true },
      { name: "product_type", label: "Type", type: "select", options: TYPES, required: true }, { name: "uom", label: "Unit of measure" },
      { name: "standard_cost", label: "Standard cost", type: "number", hint: "Default price on purchase orders." },
      { name: "sale_price", label: "Sale price", type: "number" },
      { name: "reorder_point", label: "Reorder point", type: "number", hint: "Stock at or below this level is flagged as critical." },
      { name: "safety_stock", label: "Safety stock", type: "number" },
    ]} />
);
export const NewSupplier = () => (
  <MasterForm title="New supplier" note="Payment terms set how many days after the bill date payment is due." path="/master/suppliers" back="/master/suppliers" keys={["suppliers"]}
    initial={{ payment_term_days: "30" }}
    fields={[
      { name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true },
      { name: "tax_id", label: "Tax ID (NPWP)" }, { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone" },
      { name: "payment_term_days", label: "Payment terms (days)", type: "number", required: true },
    ]} />
);
export const NewCustomer = () => (
  <MasterForm title="New customer" note="A credit limit of zero means every order is rejected at confirmation." path="/master/customers" back="/sales/customers" keys={["customers"]}
    initial={{ segment: "B2B", payment_term_days: "30", credit_limit: "0" }}
    fields={[
      { name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true },
      { name: "segment", label: "Segment", type: "select", options: [["B2B", "Business (B2B)"], ["B2C", "Consumer (B2C)"]], required: true },
      { name: "credit_limit", label: "Credit limit", type: "number", required: true },
      { name: "payment_term_days", label: "Payment terms (days)", type: "number", required: true },
      { name: "tax_id", label: "Tax ID (NPWP)" }, { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone" },
    ]} />
);
