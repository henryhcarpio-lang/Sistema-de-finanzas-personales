import Link from "next/link";
import { soles } from "@/lib/dates";
import type { Transaction } from "@/lib/types";
import { IconoCategoria } from "./IconoCategoria";

/** Icono y color por nombre de categoría. */
export type MapaCategorias = Record<string, { icono: string | null; color: string | null }>;

export function TxRow({ t, cats }: { t: Transaction; cats?: MapaCategorias }) {
  const c = cats?.[t.category];
  const positive = t.type === "ingreso";
  return (
    <li>
      <Link href={`/movimientos/${t.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-bg">
        {cats && <IconoCategoria icono={c?.icono} color={c?.color} />}
        <div className="min-w-0 flex-1">
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

export function TxList({ items, empty, cats }: { items: Transaction[]; empty: React.ReactNode; cats?: MapaCategorias }) {
  if (!items.length) return <div className="card p-6 text-center text-sm text-muted">{empty}</div>;
  return <ul className="card divide-y divide-line overflow-hidden">{items.map((t) => <TxRow key={t.id} t={t} cats={cats} />)}</ul>;
}
