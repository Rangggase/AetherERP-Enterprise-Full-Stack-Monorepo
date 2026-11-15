import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { today } from "./format";
import { api, hasSession, login as apiLogin, logout as apiLogout } from "./api";
import type { Branch, Me, Period } from "./types";

interface Ctx {
  me: Me | null;
  loading: boolean;
  can: (perm: string) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  branches: Branch[];
  branchId: number | null; // null = consolidated
  setBranchId: (id: number | null) => void;
  period: Period | null;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const SessionContext = createContext<Ctx | null>(null);

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [authed, setAuthed] = useState(hasSession());
  const [branchId, setBranch] = useState<number | null>(() => {
    const v = readStored("aether.branch");
    return v ? Number(v) : null;
  });
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    readStored("aether.theme") === "dark" || (!readStored("aether.theme") && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const out = () => {
      setAuthed(false);
      qc.clear();
    };
    window.addEventListener("aether:logout", out);
    return () => window.removeEventListener("aether:logout", out);
  }, [qc]);

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/auth/me"), enabled: authed, staleTime: 5 * 60_000, retry: false });
  const branchesQ = useQuery({ queryKey: ["branches"], queryFn: () => api<Branch[]>("/master/branches"), enabled: authed, staleTime: 10 * 60_000 });
  const periodsQ = useQuery({ queryKey: ["periods"], queryFn: () => api<Period[]>("/accounting/periods"), enabled: authed && !!meQ.data?.permissions.includes("accounting.read"), staleTime: 60_000 });

  const signIn = useCallback(
    async (email: string, password: string) => {
      await apiLogin(email, password);
      qc.clear();
      setAuthed(true);
    },
    [qc],
  );
  const signOut = useCallback(() => {
    apiLogout();
    setAuthed(false);
    qc.clear();
  }, [qc]);

  const value = useMemo<Ctx>(() => {
    const perms = new Set(meQ.data?.permissions ?? []);
    const open = (periodsQ.data ?? []).filter((p) => p.status === "OPEN");
    return {
      me: authed ? (meQ.data ?? null) : null,
      loading: authed && meQ.isLoading,
      can: (p) => perms.has(p),
      signIn,
      signOut,
      branches: branchesQ.data ?? [],
      branchId,
      setBranchId: (id) => {
        setBranch(id);
        writeStored("aether.branch", id === null ? "" : String(id));
      },
      period: [...open].reverse().find((p) => p.start_date <= today()) ?? open[0] ?? null,
      theme,
      toggleTheme: () =>
        setTheme((t) => {
          const n = t === "dark" ? "light" : "dark";
          writeStored("aether.theme", n);
          return n;
        }),
    };
  }, [authed, meQ.data, meQ.isLoading, branchesQ.data, periodsQ.data, branchId, theme, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const c = useContext(SessionContext);
  if (!c) throw new Error("useSession must be used inside SessionProvider");
  return c;
}
