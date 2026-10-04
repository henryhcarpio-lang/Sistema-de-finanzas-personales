import { soles } from "@/lib/dates";
import type { EstadoPresupuesto, NivelPresupuesto } from "@/lib/presupuestos";

/** Color de estado + icono + texto: el estado nunca se comunica solo con color. */
export const NIVELES: Record<NivelPresupuesto, { texto: string; icono: string; barra: string; tinta: string }> = {
  ok: { texto: "En orden", icono: "✓", barra: "bg-brand", tinta: "text-pos" },
  riesgo: { texto: "En riesgo al ritmo actual", icono: "↗", barra: "bg-warn", tinta: "text-warn" },
  atento: { texto: "Cerca del límite", icono: "!", barra: "bg-warn", tinta: "text-warn" },
  excedido: { texto: "Excedido", icono: "✕", barra: "bg-neg", tinta: "text-neg" },
};

export function BarraSobre({ e }: { e: EstadoPresupuesto }) {
  const n = NIVELES[e.nivel];
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.min(e.porcentaje, 100)} aria-valuetext={`${e.porcentaje} % usado, ${n.texto}`}>
      <div className={`h-full rounded-full ${n.barra}`} style={{ width: `${Math.min(e.porcentaje, 100)}%` }} />
    </div>
  );
}

export function DetalleSobre({ e }: { e: EstadoPresupuesto }) {
  const n = NIVELES[e.nivel];
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
      <span className={`font-medium ${n.tinta}`}><span aria-hidden>{n.icono}</span> {n.texto}</span>
      <span className="text-muted tabular-nums">
        {e.disponible >= 0 ? <>Disponible <b className="text-fg">{soles(e.disponible)}</b></> : <>Excedido en <b className="text-neg">{soles(-e.disponible)}</b></>}
        {e.proyectado !== null && e.nivel !== "excedido" && <> · Proyección {soles(e.proyectado)}</>}
      </span>
    </div>
  );
}
