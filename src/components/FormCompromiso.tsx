"use client";

import { useState, useTransition } from "react";
import { crearCompromiso } from "@/app/actions";
import { todayLima } from "@/lib/dates";

type Kind = "deuda" | "recurrente";
const num = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : null);

/** Alta de un préstamo/tarjeta o de un pago recurrente, con los campos mínimos. */
export function FormCompromiso({ categorias }: { categorias: string[] }) {
  const [abierto, setAbierto] = useState(false);
  const [kind, setKind] = useState<Kind>("deuda");
  const [f, setF] = useState({
    name: "", creditor: "", amount: "", frequency: "mensual" as "semanal" | "mensual" | "anual",
    day: "15", start: todayLima(), category: "Deudas", installments: "", initial: "", rate: "",
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
    start(async () => {
      const r = await crearCompromiso({
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
      });
      if (!r.ok) return setError(r.error);
      setAbierto(false);
      // Se reinicia también la fecha: si no, el siguiente compromiso heredaría cuotas pasadas.
      setF({ ...f, name: "", creditor: "", amount: "", installments: "", initial: "", rate: "", start: todayLima() });
    });
  };

  return (
    <form onSubmit={enviar} className="card pop-in grid grid-cols-2 gap-3 p-4" aria-label="Nuevo compromiso">
      <div className="col-span-2 grid grid-cols-2 gap-1 rounded-xl bg-bg p-1">
        {(["deuda", "recurrente"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k}
            onClick={() => { setKind(k); set("category", k === "deuda" ? "Deudas" : "Servicios"); }}
            className={`min-h-10 rounded-lg text-xs font-semibold ${kind === k ? "bg-surface shadow-sm" : "text-muted"}`}>
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
        <label><span className="label">Primer pago</span>
          <input className="field" type="date" value={f.start} onChange={(e) => set("start", e.target.value)} /></label>
      )}
      <label><span className="label">Categoría</span>
        <select className="field" value={f.category} onChange={(e) => set("category", e.target.value)}>
          {!categorias.includes(f.category) && <option>{f.category}</option>}
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select></label>
      {f.frequency === "mensual" && (
        <label><span className="label">Desde</span>
          <input className="field" type="date" value={f.start} onChange={(e) => set("start", e.target.value)} /></label>
      )}
      <label><span className="label">Nº de cuotas (opcional)</span>
        <input className="field tabular-nums" inputMode="numeric" value={f.installments} onChange={(e) => set("installments", e.target.value)} /></label>
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
