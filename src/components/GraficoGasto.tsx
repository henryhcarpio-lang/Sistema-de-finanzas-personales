"use client";

import { useState } from "react";
import { techoEje, type Punto } from "@/lib/analisis";
import { soles } from "@/lib/dates";

const ALTO = 150; // alto del área de barras (unidades del viewBox)
const ANCHO = 340;
const IZQ = 0;
const GAP = 2;

/** Barra con esquinas superiores de 4px y base recta sobre el eje. */
function barra(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${ALTO} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${ALTO} Z`;
}

/** Gasto por día (o por mes): barras de una sola serie, con tooltip por barra y tabla accesible. */
export function GraficoGasto({ datos, punto }: { datos: Punto[]; punto: "dia" | "mes" }) {
  const [activo, setActivo] = useState<number | null>(null);
  const max = Math.max(...datos.map((d) => d.total), 0);
  const techo = techoEje(max);
  const n = datos.length;
  const paso = (ANCHO - IZQ) / n;
  const w = Math.max(paso - GAP, 1);
  const etiquetasX = new Set([0, Math.floor((n - 1) / 2), n - 1]);
  const conGasto = datos.filter((d) => d.total > 0).length;

  if (max === 0) {
    return <p className="py-6 text-center text-sm text-muted">Sin gastos en este periodo.</p>;
  }

  const a = activo !== null ? datos[activo] : null;
  return (
    <div>
      <div className="relative" onPointerLeave={() => setActivo(null)}>
        <svg viewBox={`0 0 ${ANCHO} ${ALTO + 18}`} className="w-full overflow-visible" role="img"
          aria-label={`Gasto por ${punto === "dia" ? "día" : "mes"}: máximo ${soles(max)}, ${conGasto} ${punto === "dia" ? "días" : "meses"} con gasto`}>
          {[techo, techo / 2].map((v) => (
            <g key={v}>
              <line x1={IZQ} x2={ANCHO} y1={ALTO - (v / techo) * ALTO} y2={ALTO - (v / techo) * ALTO}
                className="stroke-line" strokeDasharray="2 3" strokeWidth={1} />
              <text x={ANCHO} y={ALTO - (v / techo) * ALTO - 4} textAnchor="end" className="fill-muted text-[10px]">
                {soles(v).replace(/\.00$/, "")}
              </text>
            </g>
          ))}
          {datos.map((d, i) => {
            const h = (d.total / techo) * ALTO;
            const x = IZQ + i * paso + GAP / 2;
            return (
              <g key={d.clave}>
                {d.total > 0 && (
                  <path d={barra(x, ALTO - h, w, h)} fill="var(--serie-1)"
                    opacity={activo === null || activo === i ? 1 : 0.45} />
                )}
                {/* Zona sensible: toda la columna, más grande que la barra. */}
                <rect x={IZQ + i * paso} y={0} width={paso} height={ALTO} fill="transparent"
                  tabIndex={0} role="button" aria-label={`${d.detalle}: ${soles(d.total)}`}
                  className="cursor-pointer outline-none focus-visible:stroke-brand focus-visible:stroke-2"
                  onPointerEnter={() => setActivo(i)} onFocus={() => setActivo(i)} onBlur={() => setActivo(null)} />
                {etiquetasX.has(i) && (
                  <text x={x + w / 2} y={ALTO + 14} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                    className="fill-muted text-[10px]">{d.etiqueta}</text>
                )}
              </g>
            );
          })}
          <line x1={IZQ} x2={ANCHO} y1={ALTO} y2={ALTO} className="stroke-line" strokeWidth={1} />
        </svg>
        {a && activo !== null && (
          <div role="status"
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-center shadow-md"
            style={{ left: `${Math.min(Math.max(((activo + 0.5) / n) * 100, 12), 88)}%` }}>
            <p className="text-sm font-semibold tabular-nums">{soles(a.total)}</p>
            <p className="text-[11px] text-muted">{a.detalle}</p>
          </div>
        )}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted hover:text-fg">Ver como tabla</summary>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">{punto === "dia" ? "Día" : "Mes"}</th><th className="py-1 text-right font-medium">Gasto</th></tr></thead>
          <tbody>
            {datos.filter((d) => d.total > 0).map((d) => (
              <tr key={d.clave} className="border-t border-line"><td className="py-1">{d.detalle}</td><td className="py-1 text-right tabular-nums">{soles(d.total)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
