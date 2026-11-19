import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Page } from "./types";

/** Jurnal seperti dikembalikan GET /accounting/journals. */
export interface JournalLine { account_code: string; account_name: string; debit: string; credit: string; memo: string | null }
export interface Journal {
  id: number; entry_no: string; entry_date: string; branch_id: number; description: string;
  source_type: string | null; status: string; reverses_id: number | null; total: string; lines: JournalLine[];
}

/**
 * API tidak punya GET jurnal per id atau per nomor. Pencarian identitas di bawah membaca daftar jurnal
 * (dipersempit dengan tanggal bila diketahui) dan mencocokkan id atau nomor jurnal itu sendiri.
 * Ini bukan menebak relasi antar-dokumen: yang dicari adalah jurnal yang sama.
 */
async function scan(match: (j: Journal) => boolean, params: Record<string, unknown> = {}): Promise<Journal | null> {
  for (let page = 1; page <= 50; page++) {
    const r = await api<Page<Journal>>("/accounting/journals", { params: { page_size: 200, page, ...params } });
    const hit = r.items.find(match);
    if (hit) return hit;
    if (page * r.page_size >= r.total) return null;
  }
  return null;
}

export function fetchJournal(id: number, date?: string): Promise<Journal | null> {
  return scan((j) => j.id === id, date ? { start: date, end: date } : {}).then((j) => j ?? (date ? scan((x) => x.id === id) : null));
}

export function fetchJournalByNo(entryNo: string, date?: string): Promise<Journal | null> {
  return scan((j) => j.entry_no === entryNo, date ? { start: date, end: date } : {});
}

export function useJournal(id: number | null | undefined, enabled = true) {
  return useQuery({ queryKey: ["journal", id], enabled: enabled && !!id, staleTime: 5 * 60_000, queryFn: () => fetchJournal(id!) });
}

/** Jumlah dalam sen (bilangan bulat) agar perbandingan debit dan kredit tepat. */
export const cents = (v: string | number | null | undefined): number => Math.round(Number(v ?? 0) * 100);

export function totals(lines: JournalLine[]): { debit: number; credit: number; balanced: boolean } {
  const debit = lines.reduce((s, l) => s + cents(l.debit), 0);
  const credit = lines.reduce((s, l) => s + cents(l.credit), 0);
  return { debit, credit, balanced: debit === credit };
}

/** Event global: buka laci jejak tinta untuk jurnal ini (dipakai struk dan tabel). */
export function openJournal(ref: { id?: number; entryNo?: string; date?: string }): void {
  window.dispatchEvent(new CustomEvent("aether:journal", { detail: ref }));
}
