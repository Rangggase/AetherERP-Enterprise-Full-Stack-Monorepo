import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { ActionBar, Field, FormGroup } from "../components/Form";
import { toast } from "../components/Toaster";
import { ErrorNote, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

type Row = Record<string, any>;
const POLICY = "Minimal 10 karakter, dengan huruf dan angka.";

function PasswordField({ label, value, onChange, autoComplete, hint }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input className="field" type="password" name={autoComplete} autoComplete={autoComplete} required minLength={10} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
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
    onSuccess: () => { toast("Pengguna diperbarui."); void qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Pengguna tidak bisa diperbarui. Coba lagi.", "error"),
  });
  const reset = useMutation({
    mutationFn: (u: Row) => api(`/system/users/${u.id}/reset-password`, { method: "POST", body: { new_password: pw } }),
    onSuccess: () => { toast("Kata sandi direset. Pengguna keluar dari semua sesi."); setResetFor(null); setPw(""); },
    onError: (e) => toast(e instanceof Error ? e.message : "Kata sandi tidak bisa direset. Coba lagi.", "error"),
  });

  const columns: ColumnDef<Row, any>[] = [
    { header: "Nama", accessorKey: "full_name", meta: { m: "t" } }, { header: "Email", accessorKey: "email", meta: { m: "s" } }, { header: "Peran", accessorKey: "role", meta: { m: "d" } },
    { header: "Status", accessorKey: "is_active", cell: (c) => <span className={`st ${c.getValue() ? "text-good" : "text-muted"}`}>{c.getValue() ? "Aktif" : "Nonaktif"}</span>, meta: { m: "x" } },
    { id: "aksi", header: "", enableSorting: false, enableColumnFilter: false, meta: { m: "x" }, cell: (c) => {
      const u = c.row.original;
      return (
        <div className="flex justify-end gap-1.5">
          <button className="btn btn-sm" onClick={() => { setResetFor(u); setPw(""); }}>Reset kata sandi</button>
          <button className="btn btn-sm" disabled={u.id === me?.id || toggle.isPending} title={u.id === me?.id ? "Anda tidak bisa menonaktifkan diri sendiri" : undefined} onClick={() => toggle.mutate(u)}>{u.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
        </div>
      );
    } },
  ];

  return (
    <>
      <PageHeader title="Pengguna dan peran" sub={q.data ? `${q.data.length} pengguna. Perubahan peran dan penonaktifan berlaku segera dan mengeluarkan pengguna dari sesi yang ada.` : "Memuat…"} actions={<Link className="btn btn-primary" to="/system/users/new">Tambah pengguna</Link>} />
      {resetFor && (
        <form className="mb-5 flex flex-wrap items-end gap-3 border-y border-ink py-4" onSubmit={(e: FormEvent) => { e.preventDefault(); reset.mutate(resetFor); }}>
          <div className="min-w-64 flex-1"><PasswordField label={`Kata sandi baru untuk ${resetFor.full_name}`} value={pw} onChange={setPw} autoComplete="new-password" hint={POLICY} /></div>
          <button type="button" className="btn btn-text" onClick={() => setResetFor(null)}>Batal</button>
          <button className="btn btn-primary" disabled={reset.isPending}>Reset kata sandi</button>
        </form>
      )}
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : <DataTable<Row> label="Pengguna" data={q.data ?? []} columns={columns} loading={q.isLoading} empty="Belum ada pengguna." />}
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
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["users"] }); toast("Pengguna dibuat."); nav("/system/users"); },
    onError: (e) => setError(e instanceof Error ? e.message : "Pengguna tidak bisa dibuat. Coba lagi."),
  });
  const role = (roles.data ?? []).find((r) => String(r.id) === v.role_id);
  return (
    <>
      <PageHeader title="Pengguna baru" sub="Bagikan kata sandi awal lewat saluran yang aman. Pengguna dapat menggantinya di Akun saya." />
      <form onSubmit={(e) => { e.preventDefault(); setError(null); save.mutate(); }}>
        {error && <p role="alert" className="mb-2 border-y border-bad py-3 text-sm text-bad">{error}</p>}
        <FormGroup first title="Akun" hint="Email dipakai untuk masuk.">
          <div className="grid max-w-xl gap-3">
            <Field label="Nama lengkap"><input className="field" name="full_name" required minLength={2} value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></Field>
            <Field label="Email"><input className="field" name="email" spellCheck={false} type="email" autoComplete="off" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
            <PasswordField label="Kata sandi awal" value={v.password} onChange={(p) => setV({ ...v, password: p })} autoComplete="new-password" hint={POLICY} />
          </div>
        </FormGroup>
        <FormGroup title="Akses" hint="Peran menentukan halaman dan aksi yang tersedia.">
          <div className="grid max-w-xl gap-3">
            <Field label="Peran" hint={role ? `${role.permissions.length} izin: ${role.permissions.join(", ")}` : undefined}>
              <select className="field" name="role_id" required value={v.role_id} onChange={(e) => setV({ ...v, role_id: e.target.value })}>
                <option value="">Pilih peran</option>{(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Cabang utama">
              <select className="field" name="branch_id" value={v.branch_id} onChange={(e) => setV({ ...v, branch_id: e.target.value })}>
                <option value="">Tidak ada</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          </div>
        </FormGroup>
        <ActionBar><Link className="btn btn-text" to="/system/users">Batal</Link><button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Membuat…" : "Buat pengguna"}</button></ActionBar>
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
    onSuccess: () => { toast("Kata sandi diganti. Silakan masuk lagi."); signOut(); nav("/login"); },
    onError: (e) => setError(e instanceof Error ? e.message : "Kata sandi tidak bisa diganti. Coba lagi."),
  });
  const mismatch = again !== "" && again !== next;
  return (
    <>
      <PageHeader title="Akun saya" sub={`${me?.full_name} · ${me?.email} · ${me?.role}`} />
      <form onSubmit={(e) => { e.preventDefault(); setError(null); if (!mismatch) save.mutate(); }}>
        {error && <p role="alert" className="mb-2 border-y border-bad py-3 text-sm text-bad">{error}</p>}
        <FormGroup first title="Ganti kata sandi" hint="Setelah diganti, Anda keluar dari semua sesi.">
          <div className="grid max-w-sm gap-3">
            <PasswordField label="Kata sandi saat ini" value={cur} onChange={setCur} autoComplete="current-password" />
            <PasswordField label="Kata sandi baru" value={next} onChange={setNext} autoComplete="new-password" hint={POLICY} />
            <Field label="Ulangi kata sandi baru" error={mismatch ? "Kata sandi tidak sama." : null}>
              <input className={`field ${mismatch ? "field-error" : ""}`} type="password" name="repeat-password" autoComplete="new-password" required minLength={10} value={again} onChange={(e) => setAgain(e.target.value)} />
            </Field>
          </div>
        </FormGroup>
        <ActionBar><button className="btn btn-primary" disabled={save.isPending || mismatch}>{save.isPending ? "Menyimpan…" : "Ganti kata sandi"}</button></ActionBar>
      </form>
    </>
  );
}
