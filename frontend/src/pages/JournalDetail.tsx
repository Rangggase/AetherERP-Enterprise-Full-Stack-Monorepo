import { useParams } from "react-router-dom";
import { useCrumb } from "../components/Shell";
import { InkThreads, sourceLabel } from "../components/signature/InkThreads";
import { Code, DetailSkeleton, ErrorNote, PageHeader, Status } from "../components/ui";
import { date } from "../lib/format";
import { useJournal } from "../lib/journals";
import { roomName } from "../motion/viewTransition";

/** Detail jurnal dengan Jejak Tinta (M1). Data dari daftar jurnal (API tidak punya GET jurnal per id). */
export function JournalDetail() {
  const { id } = useParams();
  const q = useJournal(Number(id));
  useCrumb(q.data?.entry_no);
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  if (q.isLoading) return <DetailSkeleton />;
  const j = q.data;
  if (!j) return <ErrorNote error={new Error(`Jurnal #${id} tidak ditemukan di daftar jurnal yang bisa Anda baca.`)} />;
  return (
    <>
      <PageHeader title={<Code>{j.entry_no}</Code>} room={roomName("je", j.id)}
        sub={`${sourceLabel(j.source_type)} · ${date(j.entry_date)} · ${j.lines.length} baris`}
        actions={<Status value={j.status} />}>
        <p className="mt-1 max-w-prose text-table">{j.description}</p>
      </PageHeader>
      <section className="sheet px-5 py-5 md:px-8" aria-label="Jejak tinta">
        <InkThreads journal={j} />
      </section>
    </>
  );
}
