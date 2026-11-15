import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Toaster } from "./components/Toaster";
import { SessionProvider, useSession } from "./lib/session";
import { Dashboard } from "./pages/Dashboard";
import { NewJournal, NewPurchaseOrder, NewSalesOrder } from "./pages/Forms";
import { Customers, NewCustomer, NewProduct, NewSupplier, Products, Suppliers } from "./pages/MasterData";
import { AuditLog, Invoices, Journals, Movements, PurchaseOrders, Receipts, Reorder, SalesOrders, Stock, Transfers, WorkOrders } from "./pages/Lists";
import { Account, NewUser, Users } from "./pages/Admin";
import { InvoicePrint } from "./pages/InvoicePrint";
import { Login } from "./pages/Login";
import { Periods } from "./pages/Periods";
import { Reports } from "./pages/Reports";

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });

function Guard() {
  const { me, loading } = useSession();
  if (loading) return <div className="grid min-h-dvh place-items-center text-muted">Loading your workspace…</div>;
  return me ? <Shell /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <SessionProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Guard />}>
              <Route index element={<Dashboard />} />
              <Route path="procurement/orders" element={<PurchaseOrders />} />
              <Route path="procurement/orders/new" element={<NewPurchaseOrder />} />
              <Route path="procurement/receipts" element={<Receipts />} />
              <Route path="inventory/stock" element={<Stock />} />
              <Route path="inventory/movements" element={<Movements />} />
              <Route path="inventory/transfers" element={<Transfers />} />
              <Route path="inventory/work-orders" element={<WorkOrders />} />
              <Route path="inventory/reorder" element={<Reorder />} />
              <Route path="sales/orders" element={<SalesOrders />} />
              <Route path="sales/orders/new" element={<NewSalesOrder />} />
              <Route path="sales/customers" element={<Customers />} />
              <Route path="sales/customers/new" element={<NewCustomer />} />
              <Route path="master/products" element={<Products />} />
              <Route path="master/products/new" element={<NewProduct />} />
              <Route path="master/suppliers" element={<Suppliers />} />
              <Route path="master/suppliers/new" element={<NewSupplier />} />
              <Route path="accounting/journals" element={<Journals />} />
              <Route path="accounting/journals/new" element={<NewJournal />} />
              <Route path="accounting/invoices" element={<Invoices />} />
              <Route path="accounting/reports" element={<Reports />} />
              <Route path="accounting/periods" element={<Periods />} />
              <Route path="system/audit" element={<AuditLog />} />
              <Route path="system/users" element={<Users />} />
              <Route path="system/users/new" element={<NewUser />} />
              <Route path="account" element={<Account />} />
              <Route path="accounting/invoices/:id" element={<InvoicePrint />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          <Toaster />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
