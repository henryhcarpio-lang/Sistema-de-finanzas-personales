"use client";

import { useState } from "react";
import type { Compromiso } from "@/lib/compromisos";
import { EliminarCompromiso } from "./EliminarCompromiso";
import { FormCompromiso } from "./FormCompromiso";

/** Botones Editar / Eliminar de un compromiso; Editar abre el formulario precargado. */
export function AccionesCompromiso({ compromiso, categorias, pagosApp }: {
  compromiso: Compromiso; categorias: string[]; pagosApp: number;
}) {
  const [editando, setEditando] = useState(false);
  if (editando) {
    return (
      <div className="mt-2 text-left">
        <FormCompromiso categorias={categorias} inicial={compromiso} pagosApp={pagosApp} onCerrar={() => setEditando(false)} />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" className="tap rounded-lg px-3 text-sm font-semibold text-brand" onClick={() => setEditando(true)}
        aria-label={`Editar ${compromiso.name}`}>Editar</button>
      <EliminarCompromiso id={compromiso.id} nombre={compromiso.name} />
    </div>
  );
}
