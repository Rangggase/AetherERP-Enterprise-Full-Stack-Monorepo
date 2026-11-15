import clsx from "clsx";
import {
  BarChart3, BookOpenText, Handshake, Package, Boxes, CalendarCheck, ChevronsLeft, ChevronsRight, ClipboardList, Factory, FileText, Landmark, LogOut, Menu,
  Moon, Plus, Receipt, ScrollText, Scale, ShieldCheck, ShoppingCart, Sun, Truck, Users, Warehouse, X, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";

interface Item { to: string; label: string; icon: LucideIcon; perm: string }
const NAV: { group: string; items: Item[] }[] = [
  { group: "Executive BI", items: [{ to: "/", label: "Dashboard", icon: BarChart3, perm: "dashboard.read" }] },
  {
    group: "Procurement",
    items: [
      { to: "/procurement/orders", label: "Purchase orders", icon: ShoppingCart, perm: "procurement.read" },
      { to: "/procurement/receipts", label: "Goods receipts", icon: Truck, perm: "procurement.read" },
      { to: "/master/suppliers", label: "Suppliers", icon: Handshake, perm: "master.read" },
    ],
  },
  {
    group: "Warehouse & Assembly",
    items: [
      { to: "/master/products", label: "Products", icon: Package, perm: "master.read" },
      { to: "/inventory/stock", label: "Stock levels", icon: Warehouse, perm: "inventory.read" },
      { to: "/inventory/movements", label: "Stock card", icon: ClipboardList, perm: "inventory.read" },
      { to: "/inventory/transfers", label: "Transfers", icon: Boxes, perm: "inventory.read" },
      { to: "/inventory/work-orders", label: "Assembly", icon: Factory, perm: "inventory.read" },
      { to: "/inventory/reorder", label: "Reorder advice", icon: CalendarCheck, perm: "inventory.read" },
    ],
  },
  {
    group: "Sales & CRM",
    items: [
      { to: "/sales/orders", label: "Sales orders", icon: Receipt, perm: "sales.read" },
      { to: "/sales/customers", label: "Customers", icon: Users, perm: "master.read" },
    ],
  },
  {
    group: "Accounting & Finance",
    items: [
      { to: "/accounting/journals", label: "Journal entries", icon: BookOpenText, perm: "accounting.read" },
      { to: "/accounting/invoices", label: "Invoices & bills", icon: FileText, perm: "accounting.read" },
      { to: "/accounting/reports", label: "Financial reports", icon: Scale, perm: "accounting.read" },
      { to: "/accounting/periods", label: "Fiscal periods", icon: CalendarCheck, perm: "accounting.read" },
    ],
  },
  {
    group: "Audit & System",
    items: [
      { to: "/system/audit", label: "Audit log", icon: ScrollText, perm: "audit.read" },
      { to: "/system/users", label: "Users & roles", icon: ShieldCheck, perm: "users.manage" },
    ],
  },
];

export function Shell() {
  const s = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("aether.rail") === "1"; } catch { return false; }
  });
  const [drawer, setDrawer] = useState(false);
  const [quick, setQuick] = useState(false);
  const quickRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setDrawer(false);
    mainRef.current?.focus({ preventScroll: true });
  }, [loc.pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!quickRef.current?.contains(e.target as Node)) setQuick(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggleRail = () =>
    setCollapsed((c) => {
      try { localStorage.setItem("aether.rail", c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });

  const quickItems = [
    { to: "/procurement/orders/new", label: "Purchase order", perm: "procurement.write" },
    { to: "/sales/orders/new", label: "Sales order", perm: "sales.write" },
    { to: "/accounting/journals/new", label: "Journal entry", perm: "accounting.post" },
  ].filter((q) => s.can(q.perm));

  const rail = (
    <nav aria-label="Main" className="flex h-full flex-col overflow-y-auto py-3">
      {NAV.map((g) => {
        const items = g.items.filter((i) => s.can(i.perm));
        if (!items.length) return null;
        return (
          <div key={g.group} className="mb-3">
            {!collapsed && <p className="px-4 pb-1 text-xs font-medium text-rail-ink/60">{g.group}</p>}
            {collapsed && <div className="mx-3 mb-1 border-t border-white/10" />}
            {items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.to === "/"}
                title={collapsed ? i.label : undefined}
                className={({ isActive }) =>
                  clsx(
                    "mx-2 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    isActive ? "bg-white/10 font-medium text-white shadow-[inset_2px_0_0_rgb(var(--brand))]" : "text-rail-ink hover:bg-white/5 hover:text-white",
                    collapsed && "justify-center",
                  )
                }
              >
                <i.icon size={17} aria-hidden />
                <span className={collapsed ? "sr-only" : ""}>{i.label}</span>
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className={clsx("sticky top-0 hidden h-dvh shrink-0 flex-col bg-rail transition-[width] duration-200 md:flex", collapsed ? "w-[60px]" : "w-60")}>
        <div className={clsx("flex h-14 items-center gap-2 border-b border-white/10 px-4", collapsed && "justify-center px-0")}>
          <Landmark size={20} className="text-brand" aria-hidden />
          {!collapsed && <span className="text-base font-semibold tracking-tight text-white">AetherERP</span>}
        </div>
        <div className="min-h-0 flex-1">{rail}</div>
        <button onClick={toggleRail} className="flex h-10 items-center justify-center border-t border-white/10 text-rail-ink hover:text-white" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronsRight size={16} aria-hidden /> : <ChevronsLeft size={16} aria-hidden />}
        </button>
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-rail">
            <div className="flex h-14 items-center justify-between px-4">
              <span className="font-semibold text-white">AetherERP</span>
              <button aria-label="Close menu" onClick={() => setDrawer(false)} className="text-rail-ink">
                <X size={18} aria-hidden />
              </button>
            </div>
            {rail}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur sm:px-5">
          <button className="btn h-9 w-9 px-0 md:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}>
            <Menu size={16} aria-hidden />
          </button>
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only sm:not-sr-only text-muted">Branch</span>
            <select
              className="field w-auto max-w-[11rem] pr-6"
              value={s.branchId ?? ""}
              onChange={(e) => s.setBranchId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All branches (consolidated)</option>
              {s.branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          {s.period && (
            <span className="hidden items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs lg:inline-flex" title="Current open accounting period">
              <CalendarCheck size={13} className="text-good" aria-hidden />
              Period {s.period.code} is open
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {quickItems.length > 0 && (
              <div className="relative" ref={quickRef}>
                <button className="btn btn-primary" aria-haspopup="menu" aria-expanded={quick} onClick={() => setQuick((q) => !q)}>
                  <Plus size={15} aria-hidden /> <span className="hidden sm:inline">Quick create</span>
                </button>
                {quick && (
                  <div role="menu" className="absolute right-0 mt-1 w-48 rounded-lg border border-line bg-surface p-1 shadow-lg">
                    {quickItems.map((q) => (
                      <button key={q.to} role="menuitem" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-sunken" onClick={() => { setQuick(false); nav(q.to); }}>
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button className="btn h-9 w-9 px-0" onClick={s.toggleTheme} aria-label={s.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
              {s.theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
            </button>
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium">{s.me?.full_name}</p>
              <p className="text-xs text-muted">{s.me?.role}</p>
            </div>
            <button className="btn h-9 w-9 px-0" onClick={() => { s.signOut(); nav("/login"); }} aria-label="Sign out">
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </header>
        <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 p-3 outline-none sm:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
