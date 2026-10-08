"use client";

import { Check, ChevronRight, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { actualizarCategoria, crearCategoria, eliminarCategoria } from "@/app/actions";
import { ICONOS } from "@/lib/iconos";
import { GRUPOS, NATURALEZAS, type Categoria, type Naturaleza } from "@/lib/types";
import { IconoCategoria } from "./IconoCategoria";

const COLORES = ["#16a34a", "#10b981", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#c026d3", "#db2777", "#e11d48", "#dc2626", "#ea580c", "#f59e0b", "#a16207", "#0f766e", "#6b7280"];
const colorGrupo = (g: string) => GRUPOS.find((x) => x.nombre === g)?.color ?? "#6b7280";
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Categorías agrupadas, con icono y color. Tocar una abre su edición. */
export function GestorCategorias({ categorias, conteo }: { categorias: Categoria[]; conteo: Record<string, number> }) {
  const [abierta, setAbierta] = useState<string | null>(null); // id, "nueva" o null
  const grupos = [...GRUPOS.map((g) => g.nombre as string), ...new Set(categorias.map((c) => c.grupo ?? "Otros"))]
    .filter((g, i, a) => a.indexOf(g) === i)
    .map((g) => ({ g, items: categorias.filter((c) => (c.grupo ?? "Otros") === g).sort((a, b) => a.name.localeCompare(b.name, "es")) }))
    .filter((x) => x.items.length);

  return (
    <div className="space-y-5">
      {abierta === "nueva" ? (
        <EditorCategoria onCerrar={() => setAbierta(null)} />
      ) : (
        <button className="btn-primary w-full gap-2" onClick={() => setAbierta("nueva")}><Plus size={20} aria-hidden /> Nueva categoría</button>
      )}

      {grupos.map(({ g, items }) => (
        <section key={g} aria-label={g} className="space-y-2">
          <h2 className="flex items-center gap-2 px-1 text-base font-semibold">
            <span aria-hidden className="size-3.5 rounded-[4px]" style={{ backgroundColor: colorGrupo(g) }} />{g}
          </h2>
          <ul className="space-y-2">
            {items.map((c) => (
              <li key={c.id}>
                {abierta === c.id ? (
                  <EditorCategoria categoria={c} onCerrar={() => setAbierta(null)} />
                ) : (
                  <button onClick={() => setAbierta(c.id)} aria-label={`Editar categoría ${c.name}`}
                    className="card flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left transition active:scale-[0.99]">
                    <IconoCategoria icono={c.icono} color={c.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium">
                        {c.name} <span className="font-normal text-muted tabular-nums">({conteo[c.name] ?? 0})</span>
                      </span>
                      <span className="block text-xs text-muted">{c.nature ? cap(c.nature) : "Sin naturaleza"}</span>
                    </span>
                    <ChevronRight size={20} className="text-muted" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Alta o edición: nombre, grupo, naturaleza, color e icono. */
function EditorCategoria({ categoria, onCerrar }: { categoria?: Categoria; onCerrar: () => void }) {
  const [f, setF] = useState({
    name: categoria?.name ?? "",
    grupo: categoria?.grupo ?? "Otros",
    nature: (categoria ? categoria.nature ?? "" : "necesidad") as Naturaleza | "",
    color: categoria?.color ?? "#3b82f6",
    icono: categoria?.icono ?? "etiqueta",
  });
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.name.trim()) return setError("Ponle un nombre");
    start(async () => {
      const datos = { ...f, name: f.name.trim(), nature: f.nature || null };
      const r = categoria ? await actualizarCategoria(categoria.id, datos) : await crearCategoria(datos);
      if (!r.ok) return setError(r.error);
      onCerrar();
    });
  };

  return (
    <form onSubmit={guardar} className="card pop-in space-y-4 p-4" aria-label={categoria ? `Editar ${categoria.name}` : "Nueva categoría"}>
      <div className="flex items-center gap-3">
        <IconoCategoria icono={f.icono} color={f.color} size="lg" />
        <label className="flex-1"><span className="label">Nombre</span>
          <input className="field" maxLength={60} value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!categoria} /></label>
      </div>
      {categoria && f.name.trim() && f.name.trim() !== categoria.name && (
        <p className="text-xs text-muted">Se renombrará también en tus movimientos, presupuestos y pagos.</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label><span className="label">Grupo</span>
          <select className="field" value={f.grupo} onChange={(e) => set("grupo", e.target.value)}>
            {GRUPOS.map((g) => <option key={g.nombre}>{g.nombre}</option>)}
            {!GRUPOS.some((g) => g.nombre === f.grupo) && <option>{f.grupo}</option>}
          </select></label>
        <label><span className="label">Naturaleza</span>
          <select className="field" value={f.nature} onChange={(e) => set("nature", e.target.value as Naturaleza | "")}>
            <option value="">Sin naturaleza</option>
            {NATURALEZAS.map((n) => <option key={n} value={n}>{cap(n)}</option>)}
          </select></label>
      </div>

      <fieldset>
        <legend className="label">Color</legend>
        <div className="flex flex-wrap gap-1.5">
          {COLORES.map((c) => (
            <button key={c} type="button" onClick={() => set("color", c)} aria-label={`Color ${c}`} aria-pressed={f.color === c}
              className="flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-fg"
              style={{ backgroundColor: c }}>
              {f.color === c && <Check size={18} className="text-white" aria-hidden />}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Icono</legend>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
          {Object.entries(ICONOS).map(([nombre, I]) => (
            <button key={nombre} type="button" onClick={() => set("icono", nombre)} aria-label={`Icono ${nombre}`} aria-pressed={f.icono === nombre}
              className="flex aspect-square min-h-11 items-center justify-center rounded-xl bg-bg text-muted aria-pressed:ring-2"
              style={f.icono === nombre ? { color: f.color, backgroundColor: `${f.color}1f`, boxShadow: `inset 0 0 0 2px ${f.color}` } : undefined}>
              <I size={22} aria-hidden />
            </button>
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="text-sm text-neg">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-ghost" onClick={onCerrar}>Cancelar</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
      </div>

      {categoria && (borrar ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3 text-sm">
          <span className="text-muted">¿Eliminar? Tus movimientos conservan el nombre.</span>
          <button type="button" className="btn-ghost" onClick={() => setBorrar(false)}>No</button>
          <button type="button" className="btn bg-neg text-white" disabled={pending}
            onClick={() => start(async () => { const r = await eliminarCategoria(categoria.id); if (!r.ok) setError(r.error); else onCerrar(); })}>
            Eliminar
          </button>
        </div>
      ) : (
        <div className="border-t border-line pt-2 text-right">
          <button type="button" className="tap px-2 text-neg" onClick={() => setBorrar(true)}>Eliminar categoría</button>
        </div>
      ))}
    </form>
  );
}
