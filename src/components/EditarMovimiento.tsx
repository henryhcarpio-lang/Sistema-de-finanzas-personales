"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actualizarMovimiento, eliminarMovimiento } from "@/app/actions";
import type { Transaction } from "@/lib/types";
import { MovimientoFields, camposAInput, type Campos } from "./MovimientoFields";

export function EditarMovimiento({ t }: { t: Transaction }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [campos, setCampos] = useState<Campos>({
    amount: String(t.amount), concept: t.concept, type: t.type, nature: t.nature, category: t.category,
    occurred_on: t.occurred_on, tags: t.tags.join(", "), note: t.note ?? "",
  });

  const guardar = () => {
    const r = camposAInput(campos);
    if ("error" in r) return setError(r.error!);
    start(async () => {
      const res = await actualizarMovimiento(t.id, { ...r.input, source: t.source, confidence: t.confidence });
      if (!res.ok) return setError(res.error);
      router.push("/movimientos");
    });
  };
  const eliminar = () =>
    start(async () => {
      const res = await eliminarMovimiento(t.id);
      if (!res.ok) return setError(res.error);
      router.push("/movimientos");
    });

  return (
    <div className="card space-y-4 p-4">
      <MovimientoFields value={campos} onChange={setCampos} />
      {error && <p role="alert" className="text-sm text-neg">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" disabled={pending} onClick={() => router.back()}>Cancelar</button>
        <button className="btn-primary" disabled={pending} onClick={guardar}>{pending ? "Guardando…" : "Guardar"}</button>
      </div>
      {confirmDelete ? (
        <div className="pop-in flex items-center justify-between gap-2 rounded-xl bg-neg/10 p-3 text-sm">
          <span className="text-neg">¿Eliminar definitivamente?</span>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>No</button>
            <button className="btn bg-neg text-white" disabled={pending} onClick={eliminar}>Eliminar</button>
          </div>
        </div>
      ) : (
        <button className="w-full text-sm font-medium text-neg" onClick={() => setConfirmDelete(true)}>Eliminar movimiento</button>
      )}
    </div>
  );
}
