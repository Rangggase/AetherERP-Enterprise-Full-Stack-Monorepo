import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { ActionBar, Field, FormGroup } from "../components/Form";
import { toast } from "../components/Toaster";
import { ErrorNote, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { qty, rupiah } from "../lib/format";
import { useSession } from "../lib/session";

type Row = Record<string, any>;
const col = (header: string, accessorKey: string, extra: Partial<ColumnDef<Row, any>> = {}) => ({ header, accessorKey, ...extra }) as ColumnDef<Row, any>;
const R = (m?: string) => ({ right: true, ...(m ? { m } : {}) });
const money = (h: string, k: string, m?: string) => col(h, k, { cell: (c) => rupiah(c.getValue()), meta: R(m) });
const m = (x: string) => ({ meta: { m: x } });

function MasterList({ title, sub, path, queryKey, columns, newTo, newLabel, empty }: { title: string; sub: string; path: string; queryKey: string; columns: ColumnDef<Row, any>[]; newTo: string; newLabel: string; empty: string }) {
  const { can } = useSession();
  const q = useQuery({ queryKey: [queryKey], queryFn: () => api<Row[]>(path) });
  const add = can("master.write") ? <Link className="btn btn-primary" to={newTo}>{newLabel}</Link> : undefined;
  return (
    <>
      <PageHeader title={title} sub={q.data ? `${q.data.length} data. ${sub}` : sub} actions={add} />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : <DataTable<Row> label={title} data={q.data ?? []} columns={columns} loading={q.isLoading} empty={empty} emptyAction={add && <Link className="btn btn-sm" to={newTo}>{newLabel}</Link>} />}
    </>
  );
}

const TYPES: [string, string][] = [["RAW_MATERIAL", "Bahan baku"], ["FINISHED_GOOD", "Barang jadi"], ["SERVICE", "Jasa"]];
const PRODUCT_TYPE: Record<string, string> = Object.fromEntries(TYPES);

export const Products = () => (
  <MasterList title="Produk" sub="Bahan baku, barang jadi, dan jasa. Titik pesan ulang menentukan peringatan stok rendah." path="/master/products" queryKey="products" newTo="/master/products/new" newLabel="Tambah produk" empty="Belum ada produk."
    columns={[col("SKU", "sku", m("t")), col("Nama", "name", m("s")), col("Jenis", "product_type", { cell: (c) => PRODUCT_TYPE[String(c.getValue())] ?? String(c.getValue()), ...m("x") }), col("Satuan", "uom", m("x")),
      money("Biaya standar", "standard_cost", "x"), money("Harga jual", "sale_price", "v"), col("Titik pesan ulang", "reorder_point", { cell: (c) => qty(c.getValue()), meta: R("x") })]} />
);
export const Suppliers = () => (
  <MasterList title="Pemasok" sub="Termin pembayaran menentukan jatuh tempo tagihan pemasok." path="/master/suppliers" queryKey="suppliers" newTo="/master/suppliers/new" newLabel="Tambah pemasok" empty="Belum ada pemasok."
    columns={[col("Kode", "code", m("t")), col("Nama", "name", m("s")), col("NPWP", "tax_id", m("x")), col("Email", "email", m("x")), col("Termin (hari)", "payment_term_days", { meta: R("v") })]} />
);
export const Customers = () => (
  <MasterList title="Pelanggan" sub="Batas kredit diperiksa setiap kali pesanan penjualan dikonfirmasi." path="/master/customers" queryKey="customers" newTo="/sales/customers/new" newLabel="Tambah pelanggan" empty="Belum ada pelanggan."
    columns={[col("Kode", "code", m("t")), col("Nama", "name", m("s")), col("Segmen", "segment", m("x")), money("Batas kredit", "credit_limit", "v"), col("Termin (hari)", "payment_term_days", { meta: R("x") })]} />
);

interface FieldDef { name: string; label: string; type?: "text" | "number" | "email" | "select"; options?: [string, string][]; required?: boolean; hint?: string }
interface Group { title: string; hint?: string; fields: FieldDef[] }

function MasterForm({ title, sub, path, back, keys, groups, initial }: { title: string; sub: string; path: string; back: string; keys: string[]; groups: Group[]; initial: Record<string, string> }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Row) => api(path, { method: "POST", body }),
    onSuccess: () => { keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] })); toast("Tersimpan."); nav(back); },
    onError: (e) => setError(e instanceof Error ? e.message : "Tidak bisa menyimpan. Coba lagi."),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body: Row = {};
    for (const g of groups) for (const f of g.fields) {
      const raw = v[f.name] ?? "";
      if (raw === "" && !f.required) continue;
      body[f.name] = raw; // numbers stay strings: the API parses exact decimals
    }
    save.mutate(body);
  }
  return (
    <>
      <PageHeader title={title} sub={sub} />
      <form onSubmit={submit}>
        {error && <p role="alert" className="mb-2 border-y border-bad py-3 text-sm text-bad">{error}</p>}
        {groups.map((g, gi) => (
          <FormGroup key={g.title} first={gi === 0} title={g.title} hint={g.hint}>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.fields.map((f) => (
                <Field key={f.name} label={`${f.label}${f.required ? " *" : ""}`} hint={f.hint}>
                  {f.type === "select" ? (
                    <select className="field" name={f.name} required={f.required} value={v[f.name] ?? ""} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>
                      {f.options!.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                    </select>
                  ) : (
                    <input className={`field ${f.type === "number" ? "num" : ""}`} name={f.name} autoComplete="off" spellCheck={f.type === "email" ? false : undefined} inputMode={f.type === "number" ? "decimal" : undefined} type={f.type ?? "text"}
                      min={f.type === "number" ? 0 : undefined} step={f.type === "number" ? "any" : undefined} required={f.required} value={v[f.name] ?? ""} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
                  )}
                </Field>
              ))}
            </div>
          </FormGroup>
        ))}
        <ActionBar>
          <Link className="btn btn-text" to={back}>Batal</Link>
          <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Menyimpan…" : "Simpan"}</button>
        </ActionBar>
      </form>
    </>
  );
}

export const NewProduct = () => (
  <MasterForm title="Produk baru" sub="SKU harus unik dan tidak bisa dipakai ulang." path="/master/products" back="/master/products" keys={["products"]} initial={{ product_type: "FINISHED_GOOD", uom: "PCS" }}
    groups={[
      { title: "Identitas", hint: "Cara produk dikenali di dokumen.", fields: [{ name: "sku", label: "SKU", required: true }, { name: "name", label: "Nama", required: true }, { name: "product_type", label: "Jenis", type: "select", options: TYPES, required: true }, { name: "uom", label: "Satuan" }] },
      { title: "Harga", hint: "Biaya standar menjadi harga bawaan di pesanan pembelian.", fields: [{ name: "standard_cost", label: "Biaya standar", type: "number" }, { name: "sale_price", label: "Harga jual", type: "number" }] },
      { title: "Stok", hint: "Stok pada atau di bawah titik pesan ulang ditandai kritis.", fields: [{ name: "reorder_point", label: "Titik pesan ulang", type: "number" }, { name: "safety_stock", label: "Stok pengaman", type: "number" }] },
    ]} />
);
export const NewSupplier = () => (
  <MasterForm title="Pemasok baru" sub="Termin pembayaran menentukan berapa hari setelah tanggal tagihan pembayaran jatuh tempo." path="/master/suppliers" back="/master/suppliers" keys={["suppliers"]} initial={{ payment_term_days: "30" }}
    groups={[
      { title: "Identitas", fields: [{ name: "code", label: "Kode", required: true }, { name: "name", label: "Nama", required: true }, { name: "tax_id", label: "NPWP" }] },
      { title: "Kontak", fields: [{ name: "email", label: "Email", type: "email" }, { name: "phone", label: "Telepon" }] },
      { title: "Pembayaran", fields: [{ name: "payment_term_days", label: "Termin pembayaran (hari)", type: "number", required: true }] },
    ]} />
);
export const NewCustomer = () => (
  <MasterForm title="Pelanggan baru" sub="Batas kredit nol berarti setiap pesanan ditolak saat konfirmasi." path="/master/customers" back="/sales/customers" keys={["customers"]} initial={{ segment: "B2B", payment_term_days: "30", credit_limit: "0" }}
    groups={[
      { title: "Identitas", fields: [{ name: "code", label: "Kode", required: true }, { name: "name", label: "Nama", required: true }, { name: "segment", label: "Segmen", type: "select", options: [["B2B", "Bisnis (B2B)"], ["B2C", "Konsumen (B2C)"]], required: true }, { name: "tax_id", label: "NPWP" }] },
      { title: "Kontak", fields: [{ name: "email", label: "Email", type: "email" }, { name: "phone", label: "Telepon" }] },
      { title: "Kredit", hint: "Dipakai saat pesanan dikonfirmasi.", fields: [{ name: "credit_limit", label: "Batas kredit", type: "number", required: true }, { name: "payment_term_days", label: "Termin pembayaran (hari)", type: "number", required: true }] },
    ]} />
);
