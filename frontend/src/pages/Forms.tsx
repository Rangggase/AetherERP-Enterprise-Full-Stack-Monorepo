import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "../components/Toaster";
import { PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { num, rupiah, today } from "../lib/format";
import { useSession } from "../lib/session";

type Row = Record<string, any>;
interface Line { product_id: string; quantity: string; unit_price: string }
const blank = (): Line => ({ product_id: "", quantity: "1", unit_price: "" });

function useCreate(path: string, back: string, keys: string[]) {
  const nav = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api(path, { method: "POST", body }),
    onSuccess: () => { keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] })); toast("Saved."); nav(back); },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not save.", "error"),
  });
}

function LineEditor({ lines, setLines, products, priceKey }: { lines: Line[]; setLines: (l: Line[]) => void; products: Row[]; priceKey: "standard_cost" | "sale_price" }) {
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + num(l.quantity) * num(l.unit_price), 0);
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Lines</legend>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_5.5rem_8rem_2.25rem] items-end gap-2">
          <label className="text-xs text-muted">{i === 0 && "Product"}
            <select className="field mt-1 text-ink" required value={l.product_id} aria-label={`Product, line ${i + 1}`}
              onChange={(e) => set(i, { product_id: e.target.value, unit_price: String(products.find((p) => String(p.id) === e.target.value)?.[priceKey] ?? "") })}>
              <option value="">Select a product</option>
              {products.map((p) => (<option key={p.id} value={p.id}>{p.sku} · {p.name}</option>))}
            </select>
          </label>
          <label className="text-xs text-muted">{i === 0 && "Quantity"}<input className="field mt-1 text-right text-ink" type="number" min="0.0001" step="any" required value={l.quantity} aria-label={`Quantity, line ${i + 1}`} onChange={(e) => set(i, { quantity: e.target.value })} /></label>
          <label className="text-xs text-muted">{i === 0 && "Unit price"}<input className="field mt-1 text-right text-ink" type="number" min="0" step="any" required value={l.unit_price} aria-label={`Unit price, line ${i + 1}`} onChange={(e) => set(i, { unit_price: e.target.value })} /></label>
          <button type="button" className="btn h-9 w-9 px-0" aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={14} aria-hidden /></button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button type="button" className="btn" onClick={() => setLines([...lines, blank()])}><Plus size={14} aria-hidden /> Add line</button>
        <p className="text-sm">Total <strong className="ml-1 text-base">{rupiah(total)}</strong></p>
      </div>
    </fieldset>
  );
}

function OrderForm({ kind }: { kind: "po" | "so" }) {
  const { branches, branchId } = useSession();
  const partyPath = kind === "po" ? "/master/suppliers" : "/master/customers";
  const parties = useQuery({ queryKey: [partyPath], queryFn: () => api<Row[]>(partyPath) });
  const products = useQuery({ queryKey: ["products"], queryFn: () => api<Row[]>("/master/products") });
  const [party, setParty] = useState("");
  const [branch, setBranch] = useState(String(branchId ?? branches.find((b) => b.branch_type !== "HEAD_OFFICE")?.id ?? ""));
  const [when, setWhen] = useState(today());
  const [lines, setLines] = useState<Line[]>([blank()]);
  const save = useCreate(kind === "po" ? "/procurement/purchase-orders" : "/sales/orders", kind === "po" ? "/procurement/orders" : "/sales/orders", [kind === "po" ? "pos" : "sos", "overview"]);
  const eligible = (products.data ?? []).filter((p) => (kind === "po" ? p.product_type !== "SERVICE" : true));

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      [kind === "po" ? "supplier_id" : "customer_id"]: Number(party), branch_id: Number(branch), order_date: when,
      items: lines.map((l) => ({ product_id: Number(l.product_id), quantity: l.quantity, unit_price: l.unit_price })),
    });
  }
  return (
    <>
      <PageHeader title={kind === "po" ? "New purchase order" : "New sales order"} note={kind === "po" ? "Saved as a draft. Submit it from the list to start approval." : "Saved as a quotation. Confirming it later checks credit and reserves stock."} />
      <form onSubmit={submit} className="max-w-3xl space-y-5 rounded-lg border border-line bg-surface p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">{kind === "po" ? "Supplier" : "Customer"}
            <select className="field mt-1" required value={party} onChange={(e) => setParty(e.target.value)}>
              <option value="">Select</option>{(parties.data ?? []).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select></label>
          <label className="text-sm font-medium">{kind === "po" ? "Receive into" : "Ship from"}
            <select className="field mt-1" required value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Select</option>{branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select></label>
          <label className="text-sm font-medium">Order date<input className="field mt-1" type="date" required value={when} onChange={(e) => setWhen(e.target.value)} /></label>
        </div>
        <LineEditor lines={lines} setLines={setLines} products={eligible} priceKey={kind === "po" ? "standard_cost" : "sale_price"} />
        <div className="flex justify-end"><button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save draft"}</button></div>
      </form>
    </>
  );
}
export const NewPurchaseOrder = () => <OrderForm kind="po" />;
export const NewSalesOrder = () => <OrderForm kind="so" />;

interface JLine { account_code: string; debit: string; credit: string }
export function NewJournal() {
  const { branches, branchId } = useSession();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Row[]>("/accounting/accounts") });
  const [when, setWhen] = useState(today());
  const [branch, setBranch] = useState(String(branchId ?? branches[0]?.id ?? ""));
  const [desc, setDesc] = useState("");
  const [lines, setLines] = useState<JLine[]>([{ account_code: "", debit: "", credit: "" }, { account_code: "", debit: "", credit: "" }]);
  const save = useCreate("/accounting/journals", "/accounting/journals", ["journals", "overview"]);
  const d = lines.reduce((s, l) => s + num(l.debit), 0);
  const c = lines.reduce((s, l) => s + num(l.credit), 0);
  const ok = Math.abs(d - c) < 0.005 && d > 0;
  const set = (i: number, p: Partial<JLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ entry_date: when, branch_id: Number(branch), description: desc, lines: lines.filter((l) => l.account_code).map((l) => ({ account_code: l.account_code, debit: l.debit || "0", credit: l.credit || "0" })) });
  }
  return (
    <>
      <PageHeader title="New journal entry" note="Debits must equal credits. Once posted, an entry can only be reversed, not edited." />
      <form onSubmit={submit} className="max-w-3xl space-y-5 rounded-lg border border-line bg-surface p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">Date<input className="field mt-1" type="date" required value={when} onChange={(e) => setWhen(e.target.value)} /></label>
          <label className="text-sm font-medium">Branch<select className="field mt-1" required value={branch} onChange={(e) => setBranch(e.target.value)}>{branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}</select></label>
          <label className="text-sm font-medium sm:col-span-3">Description<input className="field mt-1" required minLength={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Lines</legend>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_7.5rem_7.5rem] gap-2">
              <select className="field" aria-label={`Account, line ${i + 1}`} value={l.account_code} onChange={(e) => set(i, { account_code: e.target.value })}>
                <option value="">Account</option>{(accounts.data ?? []).map((a) => (<option key={a.code} value={a.code}>{a.code} {a.name}</option>))}
              </select>
              <input className="field text-right" type="number" min="0" step="0.01" placeholder="Debit" aria-label={`Debit, line ${i + 1}`} value={l.debit} onChange={(e) => set(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} />
              <input className="field text-right" type="number" min="0" step="0.01" placeholder="Credit" aria-label={`Credit, line ${i + 1}`} value={l.credit} onChange={(e) => set(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} />
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <button type="button" className="btn" onClick={() => setLines([...lines, { account_code: "", debit: "", credit: "" }])}><Plus size={14} aria-hidden /> Add line</button>
            <p className={`text-sm ${ok ? "text-good" : "text-warn"}`} aria-live="polite">{ok ? "Balanced" : `Difference ${rupiah(Math.abs(d - c), true)}`}</p>
          </div>
        </fieldset>
        <div className="flex justify-end"><button className="btn btn-primary" disabled={!ok || save.isPending}>{save.isPending ? "Posting…" : "Post entry"}</button></div>
      </form>
    </>
  );
}
