import { useEffect, useState } from "react";

interface T { id: number; text: string; kind: "ok" | "error" }
let seq = 0;

export const toast = (text: string, kind: T["kind"] = "ok"): void => {
  window.dispatchEvent(new CustomEvent<T>("aether:toast", { detail: { id: ++seq, text, kind } }));
};

export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<T>).detail;
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), t.kind === "error" ? 6000 : 3500);
    };
    window.addEventListener("aether:toast", on);
    return () => window.removeEventListener("aether:toast", on);
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`pointer-events-auto rounded-lg border bg-surface p-3 text-sm shadow-lg ${t.kind === "error" ? "border-bad/50" : "border-line"}`}>
          <span className={t.kind === "error" ? "font-medium text-bad" : "font-medium"}>{t.kind === "error" ? "Not done. " : ""}</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}
