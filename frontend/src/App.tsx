import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Toaster } from "./components/Toaster";
import { load } from "./lib/routes";
import { SessionProvider, useSession } from "./lib/session";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { NotFound } from "./pages/NotFound";

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });

/** Halaman selain Dasbor dan Masuk dimuat per rute, agar JS awal Dasbor tetap kecil (brief 14). */
function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) {
  return lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
}
const { lists: Lists, details: Details, forms: Forms, master: Master, admin: Admin, returns: ReturnsMod, journal: Journals } = load;

const PurchaseOrders = page(Lists, "PurchaseOrders");
const Receipts = page(Lists, "Receipts");
const Stock = page(load.stock, "Stock");
const Movements = page(Lists, "Movements");
const Transfers = page(Lists, "Transfers");
const WorkOrders = page(Lists, "WorkOrders");
const Reorder = page(Lists, "Reorder");
const SalesOrders = page(Lists, "SalesOrders");
const JournalList = page(Lists, "Journals");
const Invoices = page(Lists, "Invoices");
const AuditLog = page(Lists, "AuditLog");
const PurchaseOrderDetail = page(Details, "PurchaseOrderDetail");
const SalesOrderDetail = page(Details, "SalesOrderDetail");
const InvoiceDetail = page(Details, "InvoiceDetail");
const NewPurchaseOrder = page(Forms, "NewPurchaseOrder");
const NewSalesOrder = page(Forms, "NewSalesOrder");
const NewJournal = page(Forms, "NewJournal");
const Products = page(Master, "Products");
const NewProduct = page(Master, "NewProduct");
const Suppliers = page(Master, "Suppliers");
const NewSupplier = page(Master, "NewSupplier");
const Customers = page(Master, "Customers");
const NewCustomer = page(Master, "NewCustomer");
const Users = page(Admin, "Users");
const NewUser = page(Admin, "NewUser");
const Account = page(Admin, "Account");
const Returns = page(ReturnsMod, "Returns");
const NewReturn = page(ReturnsMod, "NewReturn");
const ReturnDetail = page(ReturnsMod, "ReturnDetail");
const JournalDetail = page(Journals, "JournalDetail");
const Reports = page(load.reports, "Reports");
const Periods = page(load.periods, "Periods");

/** Rute Katalog hanya ada saat pengembangan; Vite menghapus impor ini dari build produksi. */
const Katalog = import.meta.env.DEV ? lazy(() => import("./pages/Katalog")) : null;

function Guard() {
  const { me, loading } = useSession();
  if (loading) return <div className="grid min-h-dvh place-items-center text-muted" role="status">Membuka buku besar Anda…</div>;
  return me ? <Shell /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <SessionProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            {Katalog && <Route path="/__katalog" element={<Suspense fallback={null}><Katalog /></Suspense>} />}
            <Route element={<Guard />}>
              <Route index element={<Dashboard />} />
              <Route path="procurement/orders" element={<PurchaseOrders />} />
              <Route path="procurement/orders/new" element={<NewPurchaseOrder />} />
              <Route path="procurement/orders/:id" element={<PurchaseOrderDetail />} />
              <Route path="procurement/receipts" element={<Receipts />} />
              <Route path="inventory/stock" element={<Stock />} />
              <Route path="inventory/movements" element={<Movements />} />
              <Route path="inventory/transfers" element={<Transfers />} />
              <Route path="inventory/work-orders" element={<WorkOrders />} />
              <Route path="inventory/reorder" element={<Reorder />} />
              <Route path="sales/orders" element={<SalesOrders />} />
              <Route path="sales/orders/new" element={<NewSalesOrder />} />
              <Route path="sales/orders/:id" element={<SalesOrderDetail />} />
              <Route path="sales/orders/:id/return" element={<NewReturn />} />
              <Route path="sales/customers" element={<Customers />} />
              <Route path="sales/customers/new" element={<NewCustomer />} />
              <Route path="sales/returns" element={<Returns />} />
              <Route path="sales/returns/:id" element={<ReturnDetail />} />
              <Route path="master/products" element={<Products />} />
              <Route path="master/products/new" element={<NewProduct />} />
              <Route path="master/suppliers" element={<Suppliers />} />
              <Route path="master/suppliers/new" element={<NewSupplier />} />
              <Route path="accounting/journals" element={<JournalList />} />
              <Route path="accounting/journals/new" element={<NewJournal />} />
              <Route path="accounting/journals/:id" element={<JournalDetail />} />
              <Route path="accounting/invoices" element={<Invoices />} />
              <Route path="accounting/invoices/:id" element={<InvoiceDetail />} />
              <Route path="accounting/reports" element={<Reports />} />
              <Route path="accounting/periods" element={<Periods />} />
              <Route path="system/audit" element={<AuditLog />} />
              <Route path="system/users" element={<Users />} />
              <Route path="system/users/new" element={<NewUser />} />
              <Route path="account" element={<Account />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          <Toaster />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
