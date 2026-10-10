import Link from "next/link";
import { PERIODOS, addDays, esUnDia, etiquetaFecha, todayLima, type Periodo } from "@/lib/dates";

/** Parámetros que describen el periodo; se quitan al cambiar de periodo. */
const DEL_PERIODO = new Set(["p", "from", "to", "d"]);

/**
 * Selector de periodo basado en URL (sin JS de cliente). En vistas de un día
 * (Hoy, Ayer, Día) muestra un navegador ‹ fecha › y un selector de fecha.
 */
export function PeriodoSelector({ base, actual, extra = {}, from, to }: {
  base: string; actual: Periodo; extra?: Record<string, string | undefined>; from?: string; to?: string;
}) {
  const hoy = todayLima();
  const conservar = Object.entries(extra).filter(([k, v]) => v && !DEL_PERIODO.has(k)) as [string, string][];
  const href = (p: Periodo, d?: string) => {
    const qs = new URLSearchParams([...conservar, ["p", p], ...(d ? [["d", d] as [string, string]] : [])]);
    return `${base}?${qs}`;
  };
  // Ir a un día concreto: hoy y ayer usan su chip propio.
  const hrefDia = (d: string) => (d === hoy ? href("hoy") : d === addDays(hoy, -1) ? href("ayer") : href("dia", d));
  const dia = from ?? hoy;

  return (
    <div className="space-y-2">
      <nav aria-label="Periodo" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-1.5 rounded-xl bg-surface p-1 ring-1 ring-line">
          {PERIODOS.map((o) => (
            <Link key={o.v} href={o.v === "dia" ? href("dia", dia) : href(o.v)} aria-current={actual === o.v ? "true" : undefined}
              className={`flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition ${actual === o.v ? "bg-brand text-brand-fg" : "text-muted hover:text-fg"}`}>
              {o.l}
            </Link>
          ))}
        </div>
      </nav>

      {esUnDia(actual) && (
        <div className="flex items-center gap-2" data-testid="navegador-dia">
          <Link href={hrefDia(addDays(dia, -1))} aria-label="Día anterior"
            className="btn-ghost w-12 shrink-0 px-0 text-2xl">‹</Link>
          <form action={base} className="flex flex-1 items-center gap-2">
            {conservar.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input type="hidden" name="p" value="dia" />
            <label className="relative flex-1">
              <span className="sr-only">Elegir día</span>
              <input type="date" name="d" defaultValue={dia} max={hoy} aria-label="Elegir día"
                className="field text-center font-semibold" />
            </label>
            <button className="btn-ghost px-4">Ver</button>
          </form>
          {dia < hoy ? (
            <Link href={hrefDia(addDays(dia, 1))} aria-label="Día siguiente" className="btn-ghost w-12 shrink-0 px-0 text-2xl">›</Link>
          ) : (
            <span aria-disabled="true" aria-label="Día siguiente" className="btn-ghost w-12 shrink-0 cursor-not-allowed px-0 text-2xl opacity-40">›</span>
          )}
        </div>
      )}
      {esUnDia(actual) && <p className="px-1 text-xs text-muted" data-testid="dia-elegido">{etiquetaFecha(dia, hoy)}</p>}

      {actual === "rango" && (
        <form className="flex items-end gap-2" action={base}>
          <input type="hidden" name="p" value="rango" />
          {conservar.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label className="flex-1"><span className="label">Desde</span><input type="date" name="from" defaultValue={from} max={hoy} className="field" /></label>
          <label className="flex-1"><span className="label">Hasta</span><input type="date" name="to" defaultValue={to} className="field" /></label>
          <button className="btn-ghost">Ver</button>
        </form>
      )}
    </div>
  );
}

export function leerPeriodo(v: string | string[] | undefined, def: Periodo = "mes"): Periodo {
  return PERIODOS.some((x) => x.v === v) ? (v as Periodo) : def;
}
