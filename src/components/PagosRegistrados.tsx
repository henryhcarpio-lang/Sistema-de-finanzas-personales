import Link from "next/link";
import type { Compromiso, Pago } from "@/lib/compromisos";
import { etiquetaFecha, soles, todayLima } from "@/lib/dates";

/** Pagos ya hechos de un compromiso; cada uno abre su movimiento para editarlo o eliminarlo. */
export function PagosRegistrados({ compromiso, pagos }: { compromiso: Compromiso; pagos: Pago[] }) {
  if (pagos.length === 0) return null;
  const hoy = todayLima();
  const previas = compromiso.installments_paid_before ?? 0;
  // Número de cuota según el orden de vencimiento.
  const orden = [...pagos].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const numero = (p: Pago) => previas + orden.indexOf(p) + 1;
  const recientes = [...pagos].sort((a, b) => b.due_date.localeCompare(a.due_date)).slice(0, 5);
  return (
    <details className="group">
      <summary className="tap flex cursor-pointer list-none items-center text-sm font-medium text-brand">
        <span aria-hidden className="mr-1 transition group-open:rotate-90">›</span>
        Pagos registrados ({pagos.length})
      </summary>
      <ul className="mt-1 divide-y divide-line rounded-xl bg-bg">
        {recientes.map((p) => (
          <li key={p.id ?? p.due_date} className="flex items-center justify-between gap-2 pl-3">
            <span className="text-sm">
              {compromiso.installments_total ? `Cuota ${numero(p)} · ` : ""}
              <span className="text-muted">{etiquetaFecha(p.occurred_on ?? p.due_date, hoy)}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-sm tabular-nums">{soles(p.amount)}</span>
              {p.id && <Link href={`/movimientos/${p.id}`} className="tap flex items-center justify-center px-3 text-sm font-semibold text-brand"
                aria-label={`Editar pago del ${p.occurred_on ?? p.due_date}`}>Editar</Link>}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
