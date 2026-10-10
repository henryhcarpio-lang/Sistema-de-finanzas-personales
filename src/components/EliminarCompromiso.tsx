"use client";

import { useState, useTransition } from "react";
import { eliminarCompromiso } from "@/app/actions";

export function EliminarCompromiso({ id, nombre }: { id: string; nombre: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const [pending, start] = useTransition();
  if (!confirmar) {
    return <button className="tap -mr-3 text-muted hover:text-neg" aria-label={`Eliminar ${nombre}`} onClick={() => setConfirmar(true)}>Eliminar</button>;
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
      <span className="text-muted">¿Eliminar? Los pagos hechos se conservan.</span>
      <button className="btn-ghost min-h-11" onClick={() => setConfirmar(false)}>No</button>
      <button className="btn min-h-11 bg-neg text-white" disabled={pending} onClick={() => start(async () => { await eliminarCompromiso(id); })}>Eliminar</button>
    </div>
  );
}
