"use client";

import { useRef, useState, useTransition } from "react";
import { crearMovimiento } from "@/app/actions";
import { parseMovimiento } from "@/lib/parser";
import { soles, todayLima } from "@/lib/dates";
import type { Categoria, Draft, Preferencia } from "@/lib/types";
import { MovimientoFields, camposAInput, type Campos } from "./MovimientoFields";

type Estado =
  | { k: "idle" }
  | { k: "confirmar"; draft: Draft; texto: string }
  | { k: "editar"; campos: Campos; source: "texto" | "manual"; confidence: number | null; sugerido?: Campos };

const vacio = (): Campos => ({
  amount: "", concept: "", type: "egreso", nature: "necesidad", category: "Otros",
  occurred_on: todayLima(), tags: "", note: "",
});

const draftACampos = (d: Draft): Campos => ({
  amount: String(d.amount), concept: d.concept, type: d.type, nature: d.nature, category: d.category,
  occurred_on: d.occurred_on, tags: d.tags.join(", "), note: "",
});

export function RegistroRapido({ prefs, categorias }: { prefs: Preferencia[]; categorias: Categoria[] }) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<Estado>({ k: "idle" });
  const [aviso, setAviso] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function interpretar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    const draft = parseMovimiento(texto, todayLima(), prefs);
    if (!draft) {
      setAviso({ ok: false, msg: "No encontré un monto. Prueba: “18 soles taxi”." });
      return;
    }
    if (draft.needsType) {
      // Ambigüedad importante: pedir solo lo imprescindible (el tipo).
      setEstado({ k: "editar", campos: draftACampos(draft), source: "texto", confidence: draft.confidence, sugerido: draftACampos(draft) });
      setAviso({ ok: false, msg: "¿Es un ingreso, un pago de deuda o un gasto? Elige el tipo." });
      return;
    }
    setEstado({ k: "confirmar", draft, texto });
  }

  function guardar(c: Campos, source: "texto" | "manual", confidence: number | null, sugerido?: Campos) {
    const r = camposAInput(c);
    if ("error" in r) return setAviso({ ok: false, msg: r.error! });
    // Si el usuario cambió la clasificación propuesta, la app aprende de ello.
    const corregido = !!sugerido && (sugerido.type !== c.type || sugerido.category !== c.category || sugerido.nature !== c.nature);
    start(async () => {
      const res = await crearMovimiento({ ...r.input, source, confidence }, corregido);
      if (!res.ok) return setAviso({ ok: false, msg: res.error });
      setAviso({ ok: true, msg: `Registrado: ${r.input.concept} · ${soles(r.input.amount)}` });
      setEstado({ k: "idle" });
      setTexto("");
      inputRef.current?.focus();
    });
  }

  return (
    <section className="space-y-3">
      <form onSubmit={interpretar} className="card flex items-center gap-2 p-2">
        <input
          ref={inputRef}
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej.: 18 soles taxi"
          aria-label="Describe tu movimiento"
          enterKeyHint="go"
          className="min-h-12 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted"
        />
        <button className="btn-primary" disabled={!texto.trim() || pending}>Listo</button>
      </form>

      {aviso && (
        <p role="status" className={`pop-in rounded-xl px-3 py-2 text-sm ${aviso.ok ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg"}`}>
          {aviso.ok ? "✓ " : ""}{aviso.msg}
        </p>
      )}

      {estado.k === "confirmar" && (
        <div className="card pop-in space-y-4 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{estado.draft.concept}</p>
              <p className="text-xs text-muted capitalize">
                {estado.draft.type} · {estado.draft.category}
                {estado.draft.nature && ` · ${estado.draft.nature}`}
              </p>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${estado.draft.type === "ingreso" ? "text-pos" : ""}`}>
              {soles(estado.draft.amount)}
            </p>
          </div>
          <Confianza valor={estado.draft.confidence} />
          {estado.draft.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {estado.draft.tags.map((t) => (
                <span key={t} className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">#{t}</span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" disabled={pending}
              onClick={() => setEstado({ k: "editar", campos: draftACampos(estado.draft), source: "texto", confidence: estado.draft.confidence, sugerido: draftACampos(estado.draft) })}>
              Editar
            </button>
            <button className="btn-primary" disabled={pending}
              onClick={() => guardar(draftACampos(estado.draft), "texto", estado.draft.confidence)}>
              {pending ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {estado.k === "editar" && (
        <div className="card pop-in space-y-4 p-4">
          <MovimientoFields categorias={categorias} value={estado.campos} onChange={(campos) => setEstado({ ...estado, campos })} />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" disabled={pending} onClick={() => { setEstado({ k: "idle" }); setAviso(null); }}>Cancelar</button>
            <button className="btn-primary" disabled={pending}
              onClick={() => guardar(estado.campos, estado.source, estado.confidence, estado.sugerido)}>
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {estado.k === "idle" && (
        <button className="w-full text-center text-xs font-medium text-muted underline-offset-4 hover:underline"
          onClick={() => { setAviso(null); setEstado({ k: "editar", campos: vacio(), source: "manual", confidence: null }); }}>
          Registro manual
        </button>
      )}
    </section>
  );
}

function Confianza({ valor }: { valor: number }) {
  const [txt, cls] =
    valor >= 0.9 ? ["Aprendido de tus correcciones", "bg-pos/10 text-pos"]
    : valor >= 0.7 ? ["Clasificación segura", "bg-bg text-muted"]
    : ["Revisa la categoría", "bg-neg/10 text-neg"];
  return <p className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{txt}</p>;
}
