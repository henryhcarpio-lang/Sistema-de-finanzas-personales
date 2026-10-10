"use client";

import { useState, useTransition } from "react";
import { guardarPresupuesto } from "@/app/actions";
import { soles } from "@/lib/dates";

/** Acepta un presupuesto sugerido; solo se crea si el usuario lo toca. */
export function UsarSugerencia({ categoria, monto }: { categoria: string; monto: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button className="btn-ghost px-4" disabled={pending} aria-label={`Usar presupuesto de ${soles(monto)} para ${categoria}`}
        onClick={() => start(async () => {
          const r = await guardarPresupuesto({ category: categoria, monthly_limit: monto });
          if (!r.ok) setError(r.error);
        })}>
        {pending ? "…" : `Usar ${soles(monto).replace(/\.00$/, "")}`}
      </button>
      {error && <span role="alert" className="text-sm text-neg">{error}</span>}
    </span>
  );
}
