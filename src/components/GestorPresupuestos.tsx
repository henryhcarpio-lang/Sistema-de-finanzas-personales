"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { eliminarPresupuesto, guardarPresupuesto } from "@/app/actions";
import { soles } from "@/lib/dates";
import type { PresupuestoConEstado } from "@/lib/queries";
import { BarraSobre, DetalleSobre } from "./EstadoSobre";

export function GestorPresupuestos({ presupuestos, categorias }: { presupuestos: PresupuestoConEstado[]; categorias: string[] }) {
  const libres = categorias.filter((c) => !presupuestos.some((p) => p.category === c));
  const [cat, setCat] = useState(libres[0] ?? "");
  const [monto, setMonto] = useState("");
  const [editando, setEditando] = useState<{ id: string; monto: string } | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const guardar = (category: string, valor: string, despues: () => void) => {
    setError(null);
    const n = Number(valor.replace(",", "."));
    if (!(n > 0)) return setError("Ingresa un monto mayor que cero");
    start(async () => {
      const r = await guardarPresupuesto({ category, monthly_limit: n });
      if (!r.ok) return setError(r.error);
      despues();
    });
  };

  return (
    <div className="space-y-4">
      {libres.length > 0 && (
        <form className="card grid grid-cols-[1fr_7rem] gap-2 p-3"
          onSubmit={(e) => { e.preventDefault(); guardar(cat, monto, () => { setMonto(""); setCat(libres.find((c) => c !== cat) ?? ""); }); }}>
          <select className="field" aria-label="Categoría del presupuesto" value={cat} onChange={(e) => setCat(e.target.value)}>
            {libres.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className="field tabular-nums" inputMode="decimal" placeholder="S/ al mes" aria-label="Límite mensual"
            value={monto} onChange={(e) => setMonto(e.target.value)} />
          <button className="btn-primary col-span-2" disabled={pending || !monto.trim()}>Agregar presupuesto</button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-neg">{error}</p>}

      {presupuestos.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          Aún no tienes presupuestos. Empieza por las categorías donde más gastas, por ejemplo Alimentación o Transporte.
        </div>
      ) : (
        <ul className="space-y-3">
          {presupuestos.map((p) => (
            <li key={p.id} className="card space-y-2 p-4" aria-label={`Presupuesto de ${p.category}`}>
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/movimientos?p=mes&cat=${encodeURIComponent(p.category)}`} className="truncate font-semibold hover:underline">{p.category}</Link>
                {editando?.id === p.id ? (
                  <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); guardar(p.category, editando.monto, () => setEditando(null)); }}>
                    <input autoFocus className="field w-28 tabular-nums" inputMode="decimal" aria-label={`Nuevo límite de ${p.category}`}
                      value={editando.monto} onChange={(e) => setEditando({ id: p.id, monto: e.target.value })} />
                    <button className="btn-primary min-h-11 px-3" disabled={pending}>OK</button>
                  </form>
                ) : (
                  <button className="shrink-0 text-sm tabular-nums" aria-label={`Editar límite de ${p.category}`}
                    onClick={() => setEditando({ id: p.id, monto: String(p.monthly_limit) })}>
                    <b>{soles(p.estado.gastado)}</b> <span className="text-muted">de {soles(p.monthly_limit)} ✎</span>
                  </button>
                )}
              </div>
              <BarraSobre e={p.estado} />
              <DetalleSobre e={p.estado} />
              {borrando === p.id ? (
                <div className="flex items-center justify-end gap-2 text-sm">
                  <span className="text-muted">¿Quitar este presupuesto?</span>
                  <button className="btn-ghost min-h-11" onClick={() => setBorrando(null)}>No</button>
                  <button className="btn min-h-11 bg-neg text-white" disabled={pending}
                    onClick={() => start(async () => { const r = await eliminarPresupuesto(p.id); if (!r.ok) setError(r.error); setBorrando(null); })}>Quitar</button>
                </div>
              ) : (
                <div className="text-right">
                  <button className="tap -mr-3 text-muted hover:text-neg" onClick={() => setBorrando(p.id)} aria-label={`Quitar presupuesto de ${p.category}`}>Quitar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
