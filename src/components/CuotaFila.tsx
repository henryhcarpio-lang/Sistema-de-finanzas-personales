"use client";

import { useState, useTransition } from "react";
import { pagarCuota } from "@/app/actions";
import type { Cuota, EstadoCuota } from "@/lib/compromisos";
import { etiquetaFecha, soles, todayLima } from "@/lib/dates";

const ESTADO: Record<EstadoCuota, { texto: string; icono: string; tinta: string }> = {
  vencida: { texto: "Vencida", icono: "!", tinta: "text-neg" },
  hoy: { texto: "Vence hoy", icono: "●", tinta: "text-warn" },
  proxima: { texto: "Próxima", icono: "○", tinta: "text-muted" },
  pagada: { texto: "Pagada", icono: "✓", tinta: "text-pos" },
};

/** Una cuota del calendario. "Pagar" crea el movimiento real; antes de eso no es un gasto. */
export function CuotaFila({ cuota }: { cuota: Cuota }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const e = ESTADO[cuota.estado];
  const c = cuota.compromiso;
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3" aria-label={`${c.name}, ${e.texto}, ${etiquetaFecha(cuota.fecha, todayLima())}`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{c.name}</p>
        <p className="text-xs text-muted">
          <span className={`font-medium ${e.tinta}`}><span aria-hidden>{e.icono}</span> {e.texto}</span>
          {" · "}{etiquetaFecha(cuota.fecha, todayLima())}
          {c.installments_total ? ` · cuota ${cuota.numero}/${c.installments_total}` : ""}
        </p>
        {error && <p role="alert" className="text-xs text-neg">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">{soles(c.amount)}</span>
        {cuota.estado !== "pagada" && (
          <button className="btn-primary min-h-9 px-3" disabled={pending} aria-label={`Pagar ${c.name} del ${cuota.fecha}`}
            onClick={() => start(async () => {
              setError(null);
              const r = await pagarCuota(c.id, cuota.fecha);
              if (!r.ok) setError(r.error);
            })}>
            {pending ? "…" : "Pagar"}
          </button>
        )}
      </div>
    </li>
  );
}
