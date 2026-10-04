import { soles } from "@/lib/dates";

const SEGMENTOS = [
  { clave: "necesidad", nombre: "Necesidades", color: "var(--serie-1)" },
  { clave: "deseo", nombre: "Deseos", color: "var(--serie-2)" },
  { clave: "deuda", nombre: "Deudas", color: "var(--serie-3)" },
] as const;

/** Reparto del gasto entre necesidades, deseos y deudas: barra apilada al 100 % con leyenda etiquetada. */
export function BarraNaturaleza({ valores }: { valores: Record<"necesidad" | "deseo" | "deuda", number> }) {
  const total = SEGMENTOS.reduce((s, x) => s + valores[x.clave], 0);
  if (total === 0) return <p className="text-sm text-muted">Sin gastos en este periodo.</p>;
  const pct = (v: number) => Math.round((v / total) * 100);
  const visibles = SEGMENTOS.filter((s) => valores[s.clave] > 0);
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img"
        aria-label={visibles.map((s) => `${s.nombre} ${pct(valores[s.clave])} %`).join(", ")}>
        {visibles.map((s) => (
          <div key={s.clave} style={{ width: `${(valores[s.clave] / total) * 100}%`, background: s.color }}
            title={`${s.nombre}: ${soles(valores[s.clave])}`} />
        ))}
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {SEGMENTOS.map((s) => (
          <li key={s.clave}>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.nombre}
            </p>
            <p className="font-semibold tabular-nums">{soles(valores[s.clave])}</p>
            <p className="text-xs text-muted tabular-nums">{pct(valores[s.clave])} %</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
