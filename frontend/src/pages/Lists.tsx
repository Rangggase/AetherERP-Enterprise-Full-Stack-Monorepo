import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { toast } from "../components/Toaster";
import { ErrorNote, PageHeader, Status } from "../components/ui";
import { api } from "../lib/api";
import { date, dateTime, qty, rupiah } from "../lib/format";
import { useSession } from "../lib/session";
import type { Page } from "../lib/types";

type Row = Record<string, any>;
const R = { right: true };

function useList(key: string, path: string, params: Record<string, unknown> = {}, paged = true) {
  const q = useQuery({
    queryKey: [key, params],
    queryFn: async (): Promise<Row[]> => {
      const r = await api<Page<Row> | Row[]>(path, { params: paged ? { page_size: 200, ...params } : params });
      return Array.isArray(r) ? r : r.items;
    },
  });
  return q;
}

function Table({ title, note, q, columns, actions, label }: { title: string; note?: string; q: ReturnType<typeof useList>; columns: ColumnDef<Row, any>[]; actions?: React.ReactNode; label: string }) {
  return (
    <>
      <PageHeader title={title} note={note} actions={actions} />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : <DataTable<Row> label={label} data={q.data ?? []} columns={columns} loading={q.isLoading} />}
    </>
  );
}

const col = (header: string, accessorKey: string, extra: Partial<ColumnDef<Row, any>> = {}): ColumnDef<Row, any> => ({ header, accessorKey, ...extra }) as ColumnDef<Row, any>;
const money = (header: string, key: string) => col(header, key, { cell: (c) => rupiah(c.getValue()), meta: R, sortingFn: (a, b, id) => Number(a.getValue(id)) - Number(b.getValue(id)) });
const status = (key = "status") => col("Status", key, { cell: (c) => <Status value={c.getValue()} /> });

/** Status transition with an optimistic cache patch; rolls back and explains on failure. */
function useTransition(listKey: string, base: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, body }: { id: number; action: string; body?: unknown; next: string; label: string }) =>
      api(`${base}/${id}/${action}`, { method: "POST", body: body ?? (action === "deliver" || action === "invoice" ? {} : undefined) }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: [listKey] });
      const snap = qc.getQueriesData<Row[]>({ queryKey: [listKey] });
      qc.setQueriesData<Row[]>({ queryKey: [listKey] }, (rows) => rows?.map((r) => (r.id === v.id ? { ...r, status: v.next } : r)));
      return { snap };
    },
    onError: (err, _v, ctx) => {
      ctx?.snap.forEach(([k, d]) => qc.setQueryData(k, d));
      toast(err instanceof Error ? err.message : "The action failed.", "error");
    },
    onSuccess: (_d, v) => toast(`${v.label} done.`),
    onSettled: () => {
      for (const k of [listKey, "overview", "stock", "invoices", "journals"]) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

function ActionButtons({ row, steps, run }: { row: Row; steps: { from: string; action: string; next: string; label: string; perm: string }[]; run: ReturnType<typeof useTransition> }) {
  const { can } = useSession();
  const avail = steps.filter((s) => s.from === row.status && can(s.perm));
  return (
    <div className="flex justify-end gap-1.5">
      {avail.map((s) => (
        <button key={s.action} className="btn h-7 px-2 text-xs" disabled={run.isPending} onClick={() => run.mutate({ id: row.id, action: s.action, next: s.next, label: s.label })}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function PurchaseOrders() {
  const { branchId, can } = useSession();
  const q = useList("pos", "/procurement/purchase-orders", { branch_id: branchId });
  const run = useTransition("pos", "/procurement/purchase-orders");
  const steps = [
    { from: "DRAFT", action: "submit", next: "APPROVED", label: "Submit", perm: "procurement.write" },
    { from: "PENDING_APPROVAL", action: "approve", next: "APPROVED", label: "Approve", perm: "procurement.approve" },
  ];
  const columns = [
    col("PO number", "po_no"), col("Supplier", "supplier_name"), col("Date", "order_date", { cell: (c) => date(c.getValue()) }),
    money("Total", "total_amount"), status(),
    { id: "a", header: "", enableSorting: false, enableColumnFilter: false, cell: (c) => <ActionButtons row={c.row.original} steps={steps} run={run} /> } as ColumnDef<Row, any>,
  ];
  return <Table label="Purchase orders" title="Purchase orders" note="Orders above the approval threshold wait for a procurement manager other than the creator." q={q} columns={columns}
    actions={can("procurement.write") && <Link className="btn btn-primary" to="/procurement/orders/new">New purchase order</Link>} />;
}

export function Receipts() {
  const q = useList("grn", "/procurement/goods-receipts", {}, false);
  return <Table label="Goods receipts" title="Goods receipts" note="Each receipt adds a FIFO layer and posts Inventory against Goods received not billed." q={q}
    columns={[col("GRN number", "grn_no"), col("Received", "received_date", { cell: (c) => date(c.getValue()) }), money("Value", "total_value")]} />;
}

export function SalesOrders() {
  const { branchId, can } = useSession();
  const q = useList("sos", "/sales/orders", { branch_id: branchId });
  const run = useTransition("sos", "/sales/orders");
  const steps = [
    { from: "QUOTATION", action: "confirm", next: "CONFIRMED_SO", label: "Confirm", perm: "sales.write" },
    { from: "CONFIRMED_SO", action: "deliver", next: "DELIVERED", label: "Deliver", perm: "inventory.write" },
    { from: "DELIVERED", action: "invoice", next: "INVOICED", label: "Invoice", perm: "sales.write" },
    { from: "QUOTATION", action: "cancel", next: "CANCELLED", label: "Cancel", perm: "sales.write" },
    { from: "CONFIRMED_SO", action: "cancel", next: "CANCELLED", label: "Cancel", perm: "sales.write" },
  ];
  const columns = [
    col("SO number", "so_no"), col("Customer", "customer_name"), col("Date", "order_date", { cell: (c) => date(c.getValue()) }),
    money("Total", "total_amount"), status(),
    { id: "a", header: "", enableSorting: false, enableColumnFilter: false, cell: (c) => <ActionButtons row={c.row.original} steps={steps} run={run} /> } as ColumnDef<Row, any>,
  ];
  return <Table label="Sales orders" title="Sales orders" note="Confirming checks the customer's credit limit and reserves stock; delivery posts cost of goods sold." q={q} columns={columns}
    actions={can("sales.write") && <Link className="btn btn-primary" to="/sales/orders/new">New sales order</Link>} />;
}

export function Stock() {
  const { branchId } = useSession();
  const q = useList("stock", "/inventory/balances", { branch_id: branchId }, false);
  const { branches } = useSession();
  const name = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`;
  return <Table label="Stock levels" title="Stock levels" note="Available is on hand minus stock reserved by confirmed sales orders. Value is the sum of remaining FIFO layers." q={q}
    columns={[col("SKU", "sku"), col("Product", "name"), col("Branch", "branch_id", { cell: (c) => name(c.getValue()), filterFn: (r, id, v) => name(r.getValue(id)).toLowerCase().includes(String(v).toLowerCase()) }),
      col("On hand", "on_hand", { cell: (c) => qty(c.getValue()), meta: R }), col("Reserved", "reserved", { cell: (c) => qty(c.getValue()), meta: R }),
      col("Available", "available", { cell: (c) => <span className={c.row.original.is_low ? "font-medium text-warn" : ""}>{qty(c.getValue())}{c.row.original.is_low ? " (low)" : ""}</span>, meta: R }),
      money("FIFO value", "value")]} />;
}

export function Movements() {
  const { branchId } = useSession();
  const q = useList("movements", "/inventory/movements", { branch_id: branchId, page_size: 200 }, false);
  return <Table label="Stock card" title="Stock card" note="Append-only record of every stock movement; the latest 200 are shown." q={q}
    columns={[col("When", "created_at", { cell: (c) => dateTime(c.getValue()) }), col("Type", "type"), col("Product", "product_id", { meta: R }),
      col("Quantity", "quantity", { cell: (c) => qty(c.getValue()), meta: R }), col("Unit cost", "unit_cost", { cell: (c) => rupiah(c.getValue(), true), meta: R }), col("Reference", "ref_type")]} />;
}

export function Transfers() {
  const { branches } = useSession();
  const name = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`;
  const q = useList("transfers", "/inventory/transfers", {}, false);
  const run = useTransition("transfers", "/inventory/transfers");
  const steps = [
    { from: "REQUESTED", action: "dispatch", next: "IN_TRANSIT", label: "Dispatch", perm: "inventory.write" },
    { from: "IN_TRANSIT", action: "receive", next: "RECEIVED", label: "Receive", perm: "inventory.write" },
  ];
  return <Table label="Stock transfers" title="Inter-branch transfers" note="FIFO cost layers travel with the goods, so the receiving branch keeps the original cost." q={q}
    columns={[col("Transfer", "transfer_no"), col("From", "from_branch_id", { cell: (c) => name(c.getValue()), enableColumnFilter: false }), col("To", "to_branch_id", { cell: (c) => name(c.getValue()), enableColumnFilter: false }),
      col("Items", "items", { cell: (c) => c.getValue().length, meta: R, enableColumnFilter: false }), status(),
      { id: "a", header: "", enableSorting: false, enableColumnFilter: false, cell: (c) => <ActionButtons row={c.row.original} steps={steps} run={run} /> } as ColumnDef<Row, any>]} />;
}

export function WorkOrders() {
  const q = useList("wo", "/inventory/work-orders", {}, false);
  const run = useTransition("wo", "/inventory/work-orders");
  const steps = [{ from: "DRAFT", action: "complete", next: "COMPLETED", label: "Complete", perm: "inventory.write" }];
  return <Table label="Assembly work orders" title="Assembly work orders" note="Completing consumes components by FIFO and costs the finished good from what was actually used." q={q}
    columns={[col("Work order", "wo_no"), col("Product", "sku"), col("Quantity", "quantity", { cell: (c) => qty(c.getValue()), meta: R }),
      money("Total cost", "total_cost"), col("Unit cost", "unit_cost", { cell: (c) => rupiah(c.getValue(), true), meta: R }), status(),
      { id: "a", header: "", enableSorting: false, enableColumnFilter: false, cell: (c) => <ActionButtons row={c.row.original} steps={steps} run={run} /> } as ColumnDef<Row, any>]} />;
}

export function Reorder() {
  const { branchId } = useSession();
  const q = useList("reorder", "/inventory/reorder-recommendations", { branch_id: branchId }, false);
  return <Table label="Reorder recommendations" title="Reorder advice" note="Based on average daily consumption over the last 30 days plus safety stock." q={q}
    columns={[col("SKU", "sku"), col("Product", "name"), col("Available", "available", { cell: (c) => qty(c.getValue()), meta: R }),
      col("Reorder point", "reorder_point", { cell: (c) => qty(c.getValue()), meta: R }), col("Avg per day", "avg_daily_usage", { cell: (c) => qty(c.getValue()), meta: R }),
      col("Suggested order", "suggested_order_qty", { cell: (c) => <strong>{qty(c.getValue())}</strong>, meta: R })]} />;
}

export function Journals() {
  const { branchId, can } = useSession();
  const q = useList("journals", "/accounting/journals", { branch_id: branchId });
  return <Table label="Journal entries" title="Journal entries" note="Posted entries are immutable. Fix mistakes with a reversing entry." q={q}
    actions={can("accounting.post") && <Link className="btn btn-primary" to="/accounting/journals/new">New journal entry</Link>}
    columns={[col("Entry", "entry_no"), col("Date", "entry_date", { cell: (c) => date(c.getValue()) }), col("Description", "description"), col("Source", "source_type"),
      money("Amount", "total"), status()]} />;
}

export function Invoices() {
  const { branchId } = useSession();
  const q = useList("invoices", "/invoices", { branch_id: branchId });
  const qc = useQueryClient();
  const { can } = useSession();
  const pay = useMutation({
    mutationFn: (r: Row) => api(`/invoices/${r.id}/payments`, { method: "POST", body: { amount: r.outstanding } }),
    onSuccess: () => { toast("Payment recorded."); for (const k of ["invoices", "overview", "journals"]) void qc.invalidateQueries({ queryKey: [k] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Payment failed.", "error"),
  });
  return <Table label="Invoices and bills" title="Invoices and bills" note="AR invoices are owed by customers; AP bills are owed to suppliers." q={q}
    columns={[col("Number", "invoice_no"), col("Type", "type", { cell: (c) => (c.getValue() === "AR" ? "Receivable" : "Payable") }), col("Due", "due_date", { cell: (c) => date(c.getValue()) }),
      money("Total", "total_amount"), money("Outstanding", "outstanding"), status(),
      { id: "a", header: "", enableSorting: false, enableColumnFilter: false, cell: (c) => can("payments.write") && c.row.original.status !== "PAID" ? (
        <div className="flex justify-end"><button className="btn h-7 px-2 text-xs" disabled={pay.isPending} onClick={() => pay.mutate(c.row.original)}>Pay in full</button></div>) : null } as ColumnDef<Row, any>,
      { id: "p", header: "", enableSorting: false, enableColumnFilter: false, cell: (c) => <div className="flex justify-end"><Link className="btn h-7 px-2 text-xs" to={`/accounting/invoices/${c.row.original.id}`}>View</Link></div> } as ColumnDef<Row, any>]} />;
}

export function AuditLog() {
  const q = useList("audit", "/audit-logs", {});
  return <Table label="Audit log" title="Audit log" note="Immutable trail of critical actions with before and after values." q={q}
    columns={[col("When", "created_at", { cell: (c) => dateTime(c.getValue()) }), col("User", "user"), col("Action", "action"), col("Entity", "entity_type"), col("Ref", "entity_id"),
      col("Change", "after", { enableSorting: false, enableColumnFilter: false, cell: (c) => <code className="block max-w-xs truncate text-xs text-muted" title={JSON.stringify(c.row.original.before) + " → " + JSON.stringify(c.getValue())}>{c.getValue() ? JSON.stringify(c.getValue()) : ""}</code> }),
      col("IP", "ip_address")]} />;
}
