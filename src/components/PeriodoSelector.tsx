import Link from "next/link";
import type { Periodo } from "@/lib/dates";

const OPS: { v: Periodo; l: string }[] = [
  { v: "hoy", l: "Hoy" }, { v: "semana", l: "Semana" }, { v: "mes", l: "Mes" }, { v: "anio", l: "Año" }, { v: "rango", l: "Rango" },
];

/** Selector de periodo basado en URL (sin JS de cliente). */
export function PeriodoSelector({ base, actual, extra = {}, from, to }: {
  base: string; actual: Periodo; extra?: Record<string, string | undefined>; from?: string; to?: string;
}) {
  const href = (p: Periodo) => {
    const qs = new URLSearchParams(Object.entries({ ...extra, p }).filter(([, v]) => v) as [string, string][]);
    return `${base}?${qs}`;
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-1 rounded-xl bg-surface p-1 ring-1 ring-line">
        {OPS.map((o) => (
          <Link key={o.v} href={href(o.v)} aria-current={actual === o.v ? "true" : undefined}
            className={`flex min-h-10 items-center justify-center rounded-lg text-xs font-semibold transition ${actual === o.v ? "bg-brand text-brand-fg" : "text-muted"}`}>
            {o.l}
          </Link>
        ))}
      </div>
      {actual === "rango" && (
        <form className="flex items-end gap-2" action={base}>
          <input type="hidden" name="p" value="rango" />
          {Object.entries(extra).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
          <label className="flex-1"><span className="label">Desde</span><input type="date" name="from" defaultValue={from} className="field" /></label>
          <label className="flex-1"><span className="label">Hasta</span><input type="date" name="to" defaultValue={to} className="field" /></label>
          <button className="btn-ghost">Ver</button>
        </form>
      )}
    </div>
  );
}

export function leerPeriodo(v: string | string[] | undefined, def: Periodo = "mes"): Periodo {
  return (["hoy", "semana", "mes", "anio", "rango"] as const).includes(v as Periodo) ? (v as Periodo) : def;
}
