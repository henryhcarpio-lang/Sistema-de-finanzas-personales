import { PeriodoSelector, leerPeriodo } from "@/components/PeriodoSelector";
import { TxList } from "@/components/TxList";
import { rangoPeriodo, soles, todayLima } from "@/lib/dates";
import { listarMovimientos, resumir } from "@/lib/queries";
import { CATEGORIAS, TIPOS } from "@/lib/types";

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function MovimientosPage({ searchParams }: PageProps<"/movimientos">) {
  const sp = await searchParams;
  const p = leerPeriodo(sp.p);
  const category = str(sp.cat);
  const type = str(sp.tipo);
  const q = str(sp.q)?.slice(0, 60);
  const rango = rangoPeriodo(p, todayLima(), { from: str(sp.from), to: str(sp.to) });
  const txs = await listarMovimientos({ rango, category, type: TIPOS.includes(type as never) ? type : undefined, q });
  const r = resumir(txs);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Movimientos</h1>
      <PeriodoSelector base="/movimientos" actual={p} extra={{ cat: category, tipo: type, q }} from={rango.from} to={rango.to} />
      <form className="grid grid-cols-2 gap-2" action="/movimientos">
        <input type="hidden" name="p" value={p} />
        {p === "rango" && <><input type="hidden" name="from" value={rango.from} /><input type="hidden" name="to" value={rango.to} /></>}
        <input name="q" defaultValue={q} placeholder="Buscar concepto…" className="field col-span-2" />
        <select name="cat" defaultValue={category ?? ""} className="field" aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select name="tipo" defaultValue={type ?? ""} className="field capitalize" aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn-ghost col-span-2">Filtrar</button>
      </form>
      <div className="card flex justify-between p-4 text-sm">
        <span className="text-muted">{txs.length} movimientos</span>
        <span>Gastos <b className="tabular-nums">{soles(r.gastos)}</b> · Ingresos <b className="tabular-nums text-pos">{soles(r.ingresos)}</b></span>
      </div>
      <TxList items={txs} empty="No hay movimientos con estos filtros." />
    </div>
  );
}
