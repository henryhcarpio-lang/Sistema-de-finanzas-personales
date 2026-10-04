import Link from "next/link";
import { soles } from "@/lib/dates";
import type { Transaction } from "@/lib/types";

export function TxRow({ t }: { t: Transaction }) {
  const positive = t.type === "ingreso";
  return (
    <li>
      <Link href={`/movimientos/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-bg">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{t.concept}</p>
          <p className="truncate text-xs text-muted">
            {t.category} · {t.occurred_on.slice(8, 10)}/{t.occurred_on.slice(5, 7)}
            {t.type !== "egreso" && ` · ${t.type}`}
          </p>
        </div>
        <span className={`shrink-0 text-sm font-semibold tabular-nums ${positive ? "text-pos" : ""}`}>
          {positive ? "+" : "−"}{soles(t.amount)}
        </span>
      </Link>
    </li>
  );
}

export function TxList({ items, empty }: { items: Transaction[]; empty: React.ReactNode }) {
  if (!items.length) return <div className="card p-6 text-center text-sm text-muted">{empty}</div>;
  return <ul className="card divide-y divide-line overflow-hidden">{items.map((t) => <TxRow key={t.id} t={t} />)}</ul>;
}
