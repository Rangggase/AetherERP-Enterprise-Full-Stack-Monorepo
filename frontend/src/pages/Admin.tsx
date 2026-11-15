import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { toast } from "../components/Toaster";
import { ErrorNote, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

type Row = Record<string, any>;
const POLICY = "At least 10 characters, with a letter and a digit.";

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input className="field mt-1" type="password" autoComplete={autoComplete} required minLength={10} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Users() {
  const { me } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["users"], queryFn: () => api<Row[]>("/system/users") });
  const [resetFor, setResetFor] = useState<Row | null>(null);
  const [pw, setPw] = useState("");
  const toggle = useMutation({
    mutationFn: (u: Row) => api(`/system/users/${u.id}`, { method: "PATCH", body: { is_active: !u.is_active } }),
    onSuccess: () => { toast("User updated."); void qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not update the user.", "error"),
  });
  const reset = useMutation({
    mutationFn: (u: Row) => api(`/system/users/${u.id}/reset-password`, { method: "POST", body: { new_password: pw } }),
    onSuccess: () => { toast("Password reset. The user is signed out everywhere."); setResetFor(null); setPw(""); },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not reset the password.", "error"),
  });

  const columns: ColumnDef<Row, any>[] = [
    { header: "Name", accessorKey: "full_name" }, { header: "Email", accessorKey: "email" }, { header: "Role", accessorKey: "role" },
    { header: "Status", accessorKey: "is_active", cell: (c) => (c.getValue() ? "Active" : "Deactivated") },
    { id: "a", header: "", enableSorting: false, enableColumnFilter: false, cell: (c) => {
      const u = c.row.original;
      return (
        <div className="flex justify-end gap-1.5">
          <button className="btn h-7 px-2 text-xs" onClick={() => { setResetFor(u); setPw(""); }}>Reset password</button>
          <button className="btn h-7 px-2 text-xs" disabled={u.id === me?.id || toggle.isPending} title={u.id === me?.id ? "You cannot deactivate yourself" : undefined} onClick={() => toggle.mutate(u)}>
            {u.is_active ? "Deactivate" : "Activate"}
          </button>
        </div>
      );
    } },
  ];

  return (
    <>
      <PageHeader title="Users and roles" note="Role changes and deactivation take effect immediately and sign the user out of existing sessions." actions={<Link className="btn btn-primary" to="/system/users/new">New user</Link>} />
      {resetFor && (
        <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4" onSubmit={(e: FormEvent) => { e.preventDefault(); reset.mutate(resetFor); }}>
          <div className="min-w-64 flex-1">
            <PasswordField label={`New password for ${resetFor.full_name}`} value={pw} onChange={setPw} autoComplete="new-password" />
            <p className="mt-1 text-xs text-muted">{POLICY}</p>
          </div>
          <button type="button" className="btn" onClick={() => setResetFor(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={reset.isPending}>Reset password</button>
        </form>
      )}
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : <DataTable<Row> label="Users" data={q.data ?? []} columns={columns} loading={q.isLoading} />}
    </>
  );
}

export function NewUser() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { branches } = useSession();
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<Row[]>("/system/roles") });
  const [v, setV] = useState({ full_name: "", email: "", password: "", role_id: "", branch_id: "" });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api("/system/users", { method: "POST", body: { ...v, role_id: Number(v.role_id), branch_id: v.branch_id ? Number(v.branch_id) : null } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["users"] }); toast("User created."); nav("/system/users"); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not create the user."),
  });
  const role = (roles.data ?? []).find((r) => String(r.id) === v.role_id);
  return (
    <>
      <PageHeader title="New user" note="Share the initial password through a secure channel; the user can change it under My account." />
      <form onSubmit={(e) => { e.preventDefault(); setError(null); save.mutate(); }} className="max-w-xl space-y-4 rounded-lg border border-line bg-surface p-5">
        {error && <p role="alert" className="rounded-md border border-bad/40 bg-bad/5 p-2.5 text-sm text-bad">{error}</p>}
        <label className="block text-sm font-medium">Full name<input className="field mt-1" required minLength={2} value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></label>
        <label className="block text-sm font-medium">Email<input className="field mt-1" type="email" autoComplete="off" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></label>
        <div>
          <PasswordField label="Initial password" value={v.password} onChange={(p) => setV({ ...v, password: p })} autoComplete="new-password" />
          <p className="mt-1 text-xs text-muted">{POLICY}</p>
        </div>
        <label className="block text-sm font-medium">Role
          <select className="field mt-1" required value={v.role_id} onChange={(e) => setV({ ...v, role_id: e.target.value })}>
            <option value="">Select a role</option>{(roles.data ?? []).map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
          </select>
          {role && <span className="mt-1 block text-xs font-normal text-muted">{role.permissions.length} permissions: {role.permissions.join(", ")}</span>}
        </label>
        <label className="block text-sm font-medium">Home branch
          <select className="field mt-1" value={v.branch_id} onChange={(e) => setV({ ...v, branch_id: e.target.value })}>
            <option value="">None</option>{branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <Link className="btn" to="/system/users">Cancel</Link>
          <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Creating…" : "Create user"}</button>
        </div>
      </form>
    </>
  );
}

export function Account() {
  const { me, signOut } = useSession();
  const nav = useNavigate();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api("/auth/change-password", { method: "POST", body: { current_password: cur, new_password: next } }),
    onSuccess: () => { toast("Password changed. Sign in again."); signOut(); nav("/login"); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not change the password."),
  });
  const mismatch = again !== "" && again !== next;
  return (
    <>
      <PageHeader title="My account" note={`${me?.full_name} · ${me?.email} · ${me?.role}`} />
      <form onSubmit={(e) => { e.preventDefault(); setError(null); if (!mismatch) save.mutate(); }} className="max-w-md space-y-4 rounded-lg border border-line bg-surface p-5">
        <h2 className="font-medium">Change password</h2>
        {error && <p role="alert" className="rounded-md border border-bad/40 bg-bad/5 p-2.5 text-sm text-bad">{error}</p>}
        <PasswordField label="Current password" value={cur} onChange={setCur} autoComplete="current-password" />
        <div>
          <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" />
          <p className="mt-1 text-xs text-muted">{POLICY}</p>
        </div>
        <div>
          <PasswordField label="Repeat new password" value={again} onChange={setAgain} autoComplete="new-password" />
          {mismatch && <p role="alert" className="mt-1 text-xs text-bad">The passwords do not match.</p>}
        </div>
        <button className="btn btn-primary" disabled={save.isPending || mismatch}>{save.isPending ? "Saving…" : "Change password"}</button>
      </form>
    </>
  );
}
