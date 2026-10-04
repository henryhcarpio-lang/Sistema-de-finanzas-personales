"use client";

import { useActionState, useState } from "react";
import { autenticar, type LoginState } from "./actions";

export default function LoginPage() {
  const [modo, setModo] = useState<"ingreso" | "registro">("ingreso");
  const [state, action, pending] = useActionState<LoginState, FormData>(autenticar, {});
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-bold tracking-tight"><span className="text-brand">●</span> Finanzas</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Registra tus finanzas en segundos.</p>
      <form action={action} className="card space-y-3 p-4">
        <input type="hidden" name="modo" value={modo} />
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" minLength={8} required className="field"
            autoComplete={modo === "registro" ? "new-password" : "current-password"} />
        </div>
        {state.error && <p role="alert" className="text-sm text-neg">{state.error}</p>}
        {state.info && <p role="status" className="text-sm text-pos">{state.info}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "…" : modo === "ingreso" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>
      <button className="mt-4 text-sm text-muted hover:text-fg" onClick={() => setModo(modo === "ingreso" ? "registro" : "ingreso")}>
        {modo === "ingreso" ? "¿No tienes cuenta? Crear una" : "Ya tengo cuenta"}
      </button>
    </main>
  );
}
