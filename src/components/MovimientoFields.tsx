"use client";

import { NATURALEZAS, TIPOS, type Categoria, type Naturaleza, type Tipo } from "@/lib/types";

export interface Campos {
  amount: string;
  concept: string;
  type: Tipo;
  nature: Naturaleza | null;
  category: string;
  occurred_on: string;
  tags: string;
  note: string;
}

const NAT_POR_TIPO: Partial<Record<Tipo, Naturaleza | null>> = { ingreso: null, ahorro: "ahorro", deuda: "deuda" };

/** Campos editables reutilizados por el registro rápido y la edición. */
export function MovimientoFields({ value, onChange, categorias }: {
  value: Campos; onChange: (v: Campos) => void; categorias: Categoria[];
}) {
  const nombres = categorias.map((c) => c.name);
  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label" htmlFor="f-amount">Monto (S/)</label>
        <input id="f-amount" className="field tabular-nums" inputMode="decimal" value={value.amount}
          onChange={(e) => set("amount", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="f-date">Fecha</label>
        <input id="f-date" type="date" className="field" value={value.occurred_on}
          onChange={(e) => set("occurred_on", e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="label" htmlFor="f-concept">Concepto</label>
        <input id="f-concept" className="field" maxLength={120} value={value.concept}
          onChange={(e) => set("concept", e.target.value)} />
      </div>
      <div className="col-span-2">
        <span className="label">Tipo</span>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-bg p-1">
          {TIPOS.map((t) => (
            <button key={t} type="button"
              onClick={() => onChange({
                ...value, type: t,
                nature: t in NAT_POR_TIPO ? NAT_POR_TIPO[t]! : value.nature ?? "necesidad",
                category: t === "ahorro" ? "Ahorro" : t === "deuda" ? "Deudas" : value.category,
              })}
              className={`min-h-10 rounded-lg text-xs font-semibold capitalize transition ${value.type === t ? "bg-surface text-fg shadow-sm" : "text-muted"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="f-cat">Categoría</label>
        <select id="f-cat" className="field" value={value.category}
          onChange={(e) => {
            // Al elegir categoría se propone su naturaleza (editable).
            const cat = categorias.find((c) => c.name === e.target.value);
            onChange({ ...value, category: e.target.value,
              nature: value.type === "ingreso" ? null : cat?.nature ?? value.nature });
          }}>
          {!nombres.includes(value.category) && <option>{value.category}</option>}
          {nombres.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-nat">Naturaleza</label>
        <select id="f-nat" className="field capitalize" value={value.nature ?? ""} disabled={value.type === "ingreso"}
          onChange={(e) => set("nature", (e.target.value || null) as Naturaleza | null)}>
          <option value="">—</option>
          {NATURALEZAS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label" htmlFor="f-tags">Etiquetas (separadas por coma)</label>
        <input id="f-tags" className="field" value={value.tags} onChange={(e) => set("tags", e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="label" htmlFor="f-note">Nota</label>
        <input id="f-note" className="field" maxLength={500} value={value.note} onChange={(e) => set("note", e.target.value)} />
      </div>
    </div>
  );
}

export function camposAInput(c: Campos) {
  const amount = Number(c.amount.replace(",", "."));
  if (!(amount > 0)) return { error: "Ingresa un monto válido" } as const;
  if (!c.concept.trim()) return { error: "Ingresa un concepto" } as const;
  return {
    input: {
      amount,
      currency: "PEN" as const,
      concept: c.concept.trim(),
      type: c.type,
      nature: c.type === "ingreso" ? null : c.nature,
      category: c.category,
      tags: c.tags.split(",").map((s) => s.trim()).filter(Boolean),
      occurred_on: c.occurred_on,
      note: c.note.trim() || null,
    },
  } as const;
}
