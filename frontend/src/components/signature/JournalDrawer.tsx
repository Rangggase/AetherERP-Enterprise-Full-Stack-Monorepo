import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchJournal, fetchJournalByNo } from "../../lib/journals";
import { roomName } from "../../motion/viewTransition";
import { Drawer } from "../Layers";
import { ErrorNote, Pencil } from "../ui";
import { InkThreads, sourceLabel } from "./InkThreads";

type Ref = { id?: number; entryNo?: string; date?: string };

/**
 * Laci jejak tinta (M1) yang dibuka dari mana saja: struk posting, buku besar, Akun T, jurnal terbaru di dasbor.
 * Mendengarkan event "aether:journal" (lib/journals.openJournal). Jurnal dicari berdasarkan id atau nomornya sendiri.
 */
export default function JournalDrawerHost() {
  const [ref, setRef] = useState<Ref | null>(null);
  useEffect(() => {
    const on = (e: Event) => setRef((e as CustomEvent<Ref>).detail);
    window.addEventListener("aether:journal", on);
    return () => window.removeEventListener("aether:journal", on);
  }, []);
  const q = useQuery({
    queryKey: ["journal", ref?.id ?? `no:${ref?.entryNo}`],
    enabled: !!ref,
    staleTime: 5 * 60_000,
    queryFn: () => (ref!.id ? fetchJournal(ref!.id, ref!.date) : fetchJournalByNo(ref!.entryNo!, ref!.date)),
  });
  const j = q.data;
  return (
    <Drawer open={!!ref} onClose={() => setRef(null)} title={j ? <span className="code" translate="no">{j.entry_no}</span> : "Jejak tinta"}
      subtitle={j ? sourceLabel(j.source_type) : undefined}
      full={j ? { to: `/accounting/journals/${j.id}`, room: roomName("je", j.id), label: "Buka jurnal" } : undefined}>
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} />
        : q.isLoading || !ref ? <div className="grid gap-3"><Pencil w={60} /><Pencil w={80} /><Pencil w={45} /></div>
        : !j ? <p className="text-muted">Jurnal ini tidak ditemukan di daftar jurnal yang bisa Anda baca.</p>
        : <InkThreads journal={j} />}
    </Drawer>
  );
}
