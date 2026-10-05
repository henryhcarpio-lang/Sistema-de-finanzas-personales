"use client";

import { useState, useTransition } from "react";
import { crearCategoria, eliminarCategoria } from "@/app/actions";
import { NATURALEZAS, type Categoria, type Naturaleza } from "@/lib/types";

export function GestorCategorias({ categorias }: { categorias: Categoria[] }) {
  const [nombre, setNombre] = useState("");
  const [nature, setNature] = useState<Naturaleza | "">("necesidad");
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const crear = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await crearCategoria({ name: nombre, nature: nature || null });
      if (!r.ok) return setError(r.error);
      setNombre("");
    });
  };
  const eliminar = (id: string) =>
    start(async () => {
      const r = await eliminarCategoria(id);
      if (!r.ok) setError(r.error);
      setBorrando(null);
    });

  return (
    <div className="space-y-4">
      <form onSubmit={crear} className="card grid grid-cols-[1fr_auto] gap-2 p-3">
        <input className="field" placeholder="Nueva categoría" aria-label="Nombre de la categoría" maxLength={60}
          value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <button className="btn-primary" disabled={pending || !nombre.trim()}>Agregar</button>
        <select className="field col-span-2" aria-label="Naturaleza" value={nature}
          onChange={(e) => setNature(e.target.value as Naturaleza | "")}>
          <option value="">Sin naturaleza</option>
          {NATURALEZAS.map((n) => <option key={n} value={n}>{n[0].toUpperCase() + n.slice(1)}</option>)}
        </select>
      </form>
      {error && <p role="alert" className="text-sm text-neg">{error}</p>}
      <ul className="card divide-y divide-line overflow-hidden">
        {categorias.map((c) => (
          <li key={c.id} className="flex min-h-14 items-center justify-between gap-3 px-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted">{c.nature ? c.nature[0].toUpperCase() + c.nature.slice(1) : "Sin naturaleza"}</p>
            </div>
            {borrando === c.id ? (
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => setBorrando(null)}>No</button>
                <button className="btn bg-neg text-white" disabled={pending} onClick={() => eliminar(c.id)}>Eliminar</button>
              </div>
            ) : (
              <button className="tap -mr-3 text-neg" aria-label={`Eliminar ${c.name}`} onClick={() => setBorrando(c.id)}>
                Eliminar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
