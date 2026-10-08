import Link from "next/link";
import { PeriodoSelector } from "@/components/PeriodoSelector";
import { TxRow } from "@/components/TxList";
import { soles } from "@/lib/dates";
import { agrupar, aQuery, filtrosActivos, fraseResumen, leerFiltros, type Agrupacion } from "@/lib/filtros";
import { listarCategorias, listarEtiquetas, listarMovimientos, mapaCategorias, resumir } from "@/lib/queries";
import { NATURALEZAS, TIPOS } from "@/lib/types";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const AGRUPAR: { v: Agrupacion; l: string }[] = [
  { v: "dia", l: "Por día" }, { v: "categoria", l: "Por categoría" }, { v: "etiqueta", l: "Por etiqueta" },
];

export default async function MovimientosPage({ searchParams }: PageProps<"/movimientos">) {
  const f = leerFiltros(await searchParams);
  const [categorias, etiquetas, txs] = await Promise.all([
    listarCategorias(),
    listarEtiquetas(),
    listarMovimientos({
      rango: f.rango, category: f.cat, type: f.tipo, nature: f.nat, tag: f.tag, min: f.min, max: f.max, q: f.q,
    }),
  ]);
  const r = resumir(txs);
  const cats = mapaCategorias(categorias);
  const grupos = agrupar(txs, f.agrupar);
  const chips = filtrosActivos(f);
  const avanzados = !!(f.nat || f.tag || f.min !== undefined || f.max !== undefined);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Movimientos</h1>
      <PeriodoSelector base="/movimientos" actual={f.p} from={f.rango.from} to={f.rango.to}
        extra={Object.fromEntries(new URLSearchParams(aQuery(f, { p: null }))) } />

      <form className="space-y-2" action="/movimientos" role="search">
        <input type="hidden" name="p" value={f.p} />
        {f.p === "rango" && <><input type="hidden" name="from" value={f.rango.from} /><input type="hidden" name="to" value={f.rango.to} /></>}
        {f.agrupar !== "dia" && <input type="hidden" name="agrupar" value={f.agrupar} />}
        <input name="q" type="search" defaultValue={f.q} placeholder="Buscar en concepto o nota…" aria-label="Buscar" className="field" />
        <div className="grid grid-cols-2 gap-2">
          <select name="cat" defaultValue={f.cat ?? ""} className="field" aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {f.cat && !categorias.some((c) => c.name === f.cat) && <option>{f.cat}</option>}
            {categorias.map((c) => <option key={c.id}>{c.name}</option>)}
          </select>
          <select name="tipo" defaultValue={f.tipo ?? ""} className="field" aria-label="Tipo">
            <option value="">Todos los tipos</option>
            {TIPOS.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
          </select>
        </div>
        <details open={avanzados} className="group">
          <summary className="tap -ml-3 cursor-pointer list-none text-muted hover:text-fg">
            <span className="group-open:hidden">+ Más filtros</span><span className="hidden group-open:inline">− Menos filtros</span>
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select name="nat" defaultValue={f.nat ?? ""} className="field" aria-label="Naturaleza">
              <option value="">Toda naturaleza</option>
              {NATURALEZAS.map((n) => <option key={n} value={n}>{cap(n)}</option>)}
            </select>
            <select name="tag" defaultValue={f.tag ?? ""} className="field" aria-label="Etiqueta">
              <option value="">Todas las etiquetas</option>
              {f.tag && !etiquetas.includes(f.tag) && <option>{f.tag}</option>}
              {etiquetas.map((t) => <option key={t} value={t}>#{t}</option>)}
            </select>
            <input name="min" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={f.min} placeholder="Monto mínimo" aria-label="Monto mínimo" className="field" />
            <input name="max" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={f.max} placeholder="Monto máximo" aria-label="Monto máximo" className="field" />
          </div>
        </details>
        <button className="btn-ghost w-full">Filtrar</button>
      </form>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros activos">
          {chips.map((c) => (
            <Link key={c.clave} href={`/movimientos?${aQuery(f, { [c.clave]: null })}`} aria-label={`Quitar filtro ${c.texto}`}
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-brand/10 px-3 text-xs font-medium text-brand">
              {c.texto} <span aria-hidden>×</span>
            </Link>
          ))}
          <Link href={`/movimientos?${aQuery({ ...f, cat: undefined, tipo: undefined, nat: undefined, tag: undefined, min: undefined, max: undefined, q: undefined })}`}
            className="px-2 text-xs text-muted hover:text-fg">Limpiar</Link>
        </div>
      )}

      <section className="card space-y-3 p-4">
        <p className="text-base font-semibold" data-testid="frase-resumen">{fraseResumen(f, r, soles)}</p>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div><p className="text-xs text-muted">Movimientos</p><p className="font-semibold tabular-nums">{txs.length}</p></div>
          <div><p className="text-xs text-muted">Gastos</p><p className="font-semibold tabular-nums">{soles(r.gastos)}</p></div>
          <div><p className="text-xs text-muted">Ingresos</p><p className="font-semibold tabular-nums text-pos">{soles(r.ingresos)}</p></div>
        </div>
      </section>

      <nav className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1 ring-1 ring-line" aria-label="Agrupar">
        {AGRUPAR.map((a) => (
          <Link key={a.v} href={`/movimientos?${aQuery(f, { agrupar: a.v === "dia" ? null : a.v })}`}
            aria-current={f.agrupar === a.v ? "true" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-lg text-xs font-semibold transition ${f.agrupar === a.v ? "bg-fg text-bg" : "text-muted"}`}>
            {a.l}
          </Link>
        ))}
      </nav>

      {grupos.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">No hay movimientos con estos filtros.</div>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <section key={g.clave} aria-label={g.titulo}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold">{g.titulo}</h2>
                <span className={`text-xs font-semibold tabular-nums ${g.total >= 0 ? "text-pos" : "text-muted"}`}>
                  {g.total >= 0 ? "+" : "−"}{soles(Math.abs(g.total))}
                </span>
              </div>
              <ul className="card divide-y divide-line overflow-hidden">
                {g.items.map((t) => <TxRow key={t.id} t={t} cats={cats} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
