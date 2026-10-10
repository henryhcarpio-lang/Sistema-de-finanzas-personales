"use client";

import { useState, useTransition } from "react";
import { actualizarCompromiso, crearCompromiso } from "@/app/actions";
import type { Compromiso } from "@/lib/compromisos";
import { todayLima } from "@/lib/dates";

type Kind = "deuda" | "recurrente";
const num = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : null);

const txt = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

/**
 * Alta o edición de un préstamo/tarjeta o de un pago recurrente. Con `inicial`
 * edita; `pagosApp` son las cuotas ya pagadas desde la app (para "voy en la cuota N").
 */
export function FormCompromiso({ categorias, inicial, pagosApp = 0, onCerrar }: {
  categorias: string[]; inicial?: Compromiso; pagosApp?: number; onCerrar?: () => void;
}) {
  const editando = !!inicial;
  const [abierto, setAbiertoRaw] = useState(editando);
  const setAbierto = (v: boolean) => { setAbiertoRaw(v); if (!v) onCerrar?.(); };
  const [kind, setKind] = useState<Kind>(inicial?.kind ?? "deuda");
  const [f, setF] = useState({
    name: inicial?.name ?? "", creditor: inicial?.creditor ?? "", amount: txt(inicial?.amount),
    frequency: (inicial?.frequency ?? "mensual") as "semanal" | "mensual" | "anual",
    day: txt(inicial?.day_of_month ?? 15), start: inicial?.start_date ?? todayLima(),
    category: inicial?.category ?? "Deudas", installments: txt(inicial?.installments_total),
    initial: txt(inicial?.initial_amount), rate: txt(inicial?.interest_rate),
    actual: String((inicial?.installments_paid_before ?? 0) + pagosApp + 1),
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });

  if (!abierto) {
    return <button className="btn-primary w-full" onClick={() => setAbierto(true)}>+ Agregar deuda o pago recurrente</button>;
  }

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = num(f.amount);
    if (!f.name.trim()) return setError("Ponle un nombre");
    if (!amount || amount <= 0) return setError("Ingresa el monto de la cuota");
    const total = num(f.installments);
    const actual = total ? num(f.actual) ?? 1 : 1;
    if (!Number.isInteger(actual) || actual < 1) return setError("La cuota actual debe ser 1 o más");
    if (total && actual > total) return setError(`La cuota actual no puede pasar de ${total}`);
    const previas = Math.max(actual - 1 - pagosApp, 0);
    start(async () => {
      const datos = {
        kind,
        name: f.name,
        creditor: kind === "deuda" && f.creditor.trim() ? f.creditor.trim() : null,
        category: f.category,
        amount,
        frequency: f.frequency,
        day_of_month: f.frequency === "mensual" ? num(f.day) : null,
        start_date: f.start,
        installments_total: num(f.installments),
        initial_amount: kind === "deuda" ? num(f.initial) : null,
        interest_rate: kind === "deuda" ? num(f.rate) : null,
        installments_paid_before: previas,
      };
      const r = inicial ? await actualizarCompromiso(inicial.id, datos) : await crearCompromiso(datos);
      if (!r.ok) return setError(r.error);
      setAbierto(false);
      // Se reinicia también la fecha: si no, el siguiente compromiso heredaría cuotas pasadas.
      if (!editando) setF({ ...f, name: "", creditor: "", amount: "", installments: "", initial: "", rate: "", actual: "1", start: todayLima() });
    });
  };

  return (
    <form onSubmit={enviar} className="card pop-in grid grid-cols-2 gap-3 p-4" aria-label={editando ? `Editar ${inicial.name}` : "Nuevo compromiso"}>
      <div className="col-span-2 grid grid-cols-2 gap-1 rounded-xl bg-bg p-1">
        {(["deuda", "recurrente"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k}
            onClick={() => { setKind(k); set("category", k === "deuda" ? "Deudas" : "Servicios"); }}
            className={`min-h-11 rounded-lg text-sm font-semibold ${kind === k ? "bg-surface shadow-sm" : "text-muted"}`}>
            {k === "deuda" ? "Deuda (préstamo, tarjeta)" : "Pago recurrente"}
          </button>
        ))}
      </div>
      <label className="col-span-2"><span className="label">Nombre</span>
        <input className="field" maxLength={80} placeholder={kind === "deuda" ? "Préstamo banco" : "Internet, Netflix, alquiler…"} value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label><span className="label">Cuota (S/)</span>
        <input className="field tabular-nums" inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></label>
      <label><span className="label">Frecuencia</span>
        <select className="field" value={f.frequency} onChange={(e) => set("frequency", e.target.value)}>
          <option value="mensual">Mensual</option><option value="semanal">Semanal</option><option value="anual">Anual</option>
        </select></label>
      {f.frequency === "mensual" ? (
        <label><span className="label">Día de pago</span>
          <input className="field tabular-nums" type="number" min={1} max={31} value={f.day} onChange={(e) => set("day", e.target.value)} /></label>
      ) : (
        <label><span className="label">{num(f.installments) && num(f.actual) !== 1 ? "Próximo pago" : "Primer pago"}</span>
          <input className="field" type="date" value={f.start} onChange={(e) => set("start", e.target.value)} /></label>
      )}
      <label><span className="label">Categoría</span>
        <select className="field" value={f.category} onChange={(e) => set("category", e.target.value)}>
          {!categorias.includes(f.category) && <option>{f.category}</option>}
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select></label>
      {f.frequency === "mensual" && (
        <label><span className="label">{num(f.installments) && num(f.actual) !== 1 ? "Desde (próximo pago)" : "Desde"}</span>
          <input className="field" type="date" value={f.start} onChange={(e) => set("start", e.target.value)} /></label>
      )}
      <label><span className="label">Nº de cuotas (opcional)</span>
        <input className="field tabular-nums" inputMode="numeric" value={f.installments} onChange={(e) => set("installments", e.target.value)} /></label>
      {num(f.installments) ? (
        <label><span className="label">Voy en la cuota Nº</span>
          <input className="field tabular-nums" inputMode="numeric" value={f.actual} onChange={(e) => set("actual", e.target.value)} /></label>
      ) : null}
      {kind === "deuda" && (
        <>
          <label><span className="label">Deuda total (opcional)</span>
            <input className="field tabular-nums" inputMode="decimal" value={f.initial} onChange={(e) => set("initial", e.target.value)} /></label>
          <label><span className="label">Acreedor (opcional)</span>
            <input className="field" maxLength={80} value={f.creditor} onChange={(e) => set("creditor", e.target.value)} /></label>
          <label><span className="label">Tasa anual % (opcional)</span>
            <input className="field tabular-nums" inputMode="decimal" value={f.rate} onChange={(e) => set("rate", e.target.value)} /></label>
        </>
      )}
      {error && <p role="alert" className="col-span-2 text-sm text-neg">{error}</p>}
      <button type="button" className="btn-ghost" onClick={() => setAbierto(false)}>Cancelar</button>
      <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}
