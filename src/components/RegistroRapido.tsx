"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { recargaTrasDictar, useVozRegistro } from "@/hooks/useVozRegistro";
import { crearMovimiento, interpretarConIA } from "@/app/actions";
import { conviene } from "@/lib/ia";
import { parseMovimiento } from "@/lib/parser";
import { separarMovimientos } from "@/lib/separar";
import { elegirCandidata } from "@/lib/transcripcion";
import { etiquetaFecha, soles, todayLima } from "@/lib/dates";
import type { Categoria, Draft, Fuente, Preferencia } from "@/lib/types";
import type { AjusteMotor } from "@/lib/voz/motor";
import { MovimientoFields, camposAInput, type Campos } from "./MovimientoFields";

type Estado =
  | { k: "idle" }
  | { k: "confirmar"; draft: Draft; source: Fuente }
  | { k: "varios"; drafts: Draft[]; source: Fuente }
  | { k: "editar"; campos: Campos; source: Fuente; confidence: number | null; sugerido?: Campos };

const vacio = (): Campos => ({
  amount: "", concept: "", type: "egreso", nature: "necesidad", category: "Otros",
  occurred_on: todayLima(), tags: "", note: "",
});

const draftACampos = (d: Draft): Campos => ({
  amount: String(d.amount), concept: d.concept, type: d.type, nature: d.nature, category: d.category,
  occurred_on: d.occurred_on, tags: d.tags.join(", "), note: "",
});

export function RegistroRapido({ prefs, categorias, voz: vozAjustes = { activa: true, idioma: "es-PE", motor: "auto" }, cuenta = null, ia = false }: {
  prefs: Preferencia[]; categorias: Categoria[]; voz?: { activa: boolean; idioma: string; motor?: AjusteMotor }; cuenta?: string | null;
  /** Interpretar con IA (Gemini) las frases que las reglas no entienden bien. */
  ia?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<Estado>({ k: "idle" });
  const [aviso, setAviso] = useState<{ ok: boolean; msg: string; extra?: { texto: string; nivel: string } } | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const [consultandoIA, setConsultandoIA] = useState(false);

  /** Texto escrito o dictado → tarjeta de confirmación (o pedir el tipo si es ambiguo). */
  async function interpretar(frase: string, source: Fuente) {
    setAviso(null);
    // Si las reglas dudan, se consulta la IA; si falla o no hay clave, siguen las reglas.
    if (ia) {
      const hoy0 = todayLima();
      const varias = separarMovimientos(frase, hoy0).frases.length;
      if (conviene(parseMovimiento(frase, hoy0, prefs), varias)) {
        setConsultandoIA(true);
        const r = await interpretarConIA(frase).catch(() => null);
        setConsultandoIA(false);
        if (r?.ok) {
          setEstado(r.drafts.length > 1 ? { k: "varios", drafts: r.drafts, source } : { k: "confirmar", draft: r.drafts[0], source });
          return;
        }
      }
    }
    interpretarConReglas(frase, source);
  }

  function interpretarConReglas(frase: string, source: Fuente) {
    // Varios movimientos en una frase: "un sol taxi, dos soles pasaje".
    const hoy = todayLima();
    const sep = separarMovimientos(frase, hoy);
    if (sep.frases.length > 1) {
      const drafts = sep.frases.map((f) => parseMovimiento(f, hoy, prefs)).filter((d): d is Draft => !!d)
        .map((d) => (sep.fecha && d.occurred_on === hoy ? { ...d, occurred_on: sep.fecha } : d))
        .map((d) => (d.needsType ? { ...d, type: "egreso" as const, needsType: false, confidence: 0.2 } : d));
      if (drafts.length > 1) { setEstado({ k: "varios", drafts, source }); return; }
    }
    const draft = parseMovimiento(frase, hoy, prefs);
    if (!draft) {
      if (source === "voz") {
        // Se deja lo entendido en el campo para corregirlo a mano.
        setTexto(frase);
        setAviso({ ok: false, msg: `Entendí «${frase}», pero no encontré un monto. Corrígelo abajo o vuelve a intentarlo.` });
      } else {
        setAviso({ ok: false, msg: "No encontré un monto. Prueba: “18 soles taxi”." });
      }
      return;
    }
    if (draft.needsType) {
      // Ambigüedad importante: pedir solo lo imprescindible (el tipo).
      setEstado({ k: "editar", campos: draftACampos(draft), source, confidence: draft.confidence, sugerido: draftACampos(draft) });
      setAviso({ ok: false, msg: "¿Es un ingreso, un pago de deuda o un gasto? Elige el tipo." });
      return;
    }
    setEstado({ k: "confirmar", draft, source });
  }

  // De las interpretaciones del reconocedor, se usa la que tiene sentido como movimiento.
  const voz = useVozRegistro((candidatas) =>
    interpretar(elegirCandidata(candidatas, (c) => parseMovimiento(c, todayLima(), prefs)).texto, "voz"), vozAjustes.idioma, vozAjustes.motor ?? "auto");
  const conVoz = voz.soportado && vozAjustes.activa;

  function guardar(c: Campos, source: Fuente, confidence: number | null, sugerido?: Campos) {
    const r = camposAInput(c);
    if ("error" in r) return setAviso({ ok: false, msg: r.error! });
    // Si el usuario cambió la clasificación propuesta, la app aprende de ello.
    const corregido = !!sugerido && (sugerido.type !== c.type || sugerido.category !== c.category || sugerido.nature !== c.nature);
    start(async () => {
      const res = await crearMovimiento({ ...r.input, account: cuenta, source, confidence }, corregido);
      if (!res.ok) return setAviso({ ok: false, msg: res.error });
      const hoy = todayLima();
      const cuando = r.input.occurred_on === hoy ? "" : ` · ${etiquetaFecha(r.input.occurred_on, hoy)}`;
      const msg = `Registrado: ${r.input.concept} · ${soles(r.input.amount)}${cuando}`;
      if (!res.presupuesto && recargarSiHaceFalta(source, msg)) return;
      setAviso({ ok: true, msg, extra: res.presupuesto });
      setEstado({ k: "idle" });
      setTexto("");
      // Tras un dictado no se enfoca el campo: en iPhone abriría el teclado y su dictado,
      // que compiten por el micrófono con el siguiente registro por voz.
      if (source !== "voz") inputRef.current?.focus();
      porTeclado.current = false;
    });
  }

  /** Tras un registro por voz en un iPhone afectado, recarga para que el próximo dictado sea "el primero". */
  const recargarSiHaceFalta = (source: Fuente, msg: string) => {
    if (source !== "voz" || porTeclado.current || voz.motor !== "navegador" || !recargaTrasDictar()) return false;
    try { sessionStorage.setItem("aviso-registro", msg); } catch { return false; }
    window.location.reload();
    return true;
  };
  useEffect(() => {
    try {
      const msg = sessionStorage.getItem("aviso-registro");
      if (msg) { sessionStorage.removeItem("aviso-registro"); setTimeout(() => setAviso({ ok: true, msg }), 0); }
    } catch { /* sin almacenamiento */ }
  }, []);

  function guardarVarios(drafts: Draft[], source: Fuente) {
    start(async () => {
      let ok = 0;
      for (const d of drafts) {
        const r = camposAInput(draftACampos(d));
        if ("error" in r) continue;
        const res = await crearMovimiento({ ...r.input, account: cuenta, source, confidence: d.confidence });
        if (res.ok) ok++;
      }
      const total = drafts.reduce((s2, d) => s2 + d.amount, 0);
      const msg = ok === drafts.length ? `Registrados ${ok} movimientos · ${soles(total)}` : `Se registraron ${ok} de ${drafts.length}. Revisa el historial.`;
      if (ok === drafts.length && recargarSiHaceFalta(source, msg)) return;
      setAviso({ ok: ok === drafts.length, msg });
      setEstado({ k: "idle" });
      setTexto("");
      porTeclado.current = false;
    });
  }

  // Dictado con el micrófono del teclado: al dejar de llegar texto, se interpreta solo.
  const porTeclado = useRef(false);
  const tTeclado = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alEscribir = (v: string) => {
    setTexto(v);
    if (!porTeclado.current) return;
    if (tTeclado.current) clearTimeout(tTeclado.current);
    tTeclado.current = setTimeout(() => {
      if (v.trim() && parseMovimiento(v, todayLima(), prefs)) interpretar(v, "voz");
    }, 1800);
  };

  return (
    <section className="space-y-3">
      {conVoz && (
        <Microfono voz={voz} ocupado={pending} onTeclado={() => { voz.cerrarError(); porTeclado.current = true; setAviso({ ok: true, msg: "Toca 🎤 en el teclado y dicta. Se interpreta solo al terminar." }); inputRef.current?.focus(); }} onIniciar={() => { setAviso(null); setEstado({ k: "idle" }); voz.iniciar(); }} />
      )}

      <form onSubmit={(e) => { e.preventDefault(); interpretar(texto, "texto"); }} className="card flex items-center gap-2 p-2">
        <input
          ref={inputRef}
          autoFocus
          value={texto}
          onChange={(e) => alEscribir(e.target.value)}
          placeholder={conVoz ? "O escribe: 18 soles taxi" : "Ej.: 18 soles taxi"}
          aria-label="Describe tu movimiento"
          enterKeyHint="go"
          className="min-h-12 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted"
        />
        <button className="btn-primary" disabled={!texto.trim() || pending}>Listo</button>
      </form>

      {consultandoIA && (
        <p role="status" className="pop-in rounded-xl bg-bg px-3 py-2 text-sm text-muted" data-testid="ia-consultando">✨ Interpretando con IA…</p>
      )}

      {aviso && (
        <p role="status" className={`pop-in rounded-xl px-3 py-2 text-sm ${aviso.ok ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg"}`}>
          {aviso.ok ? "✓ " : ""}{aviso.msg}
          {aviso.extra && (
            <span data-testid="aviso-presupuesto" className={`mt-1 block text-xs font-medium ${aviso.extra.nivel === "excedido" ? "text-neg" : aviso.extra.nivel === "ok" ? "text-fg/70" : "text-warn"}`}>
              <span aria-hidden>{aviso.extra.nivel === "excedido" ? "✕ " : aviso.extra.nivel === "ok" ? "" : "! "}</span>{aviso.extra.texto}
            </span>
          )}
        </p>
      )}

      {estado.k === "varios" && (
        <div className="card pop-in space-y-3 p-4" aria-label="Varios movimientos">
          <p className="text-sm font-semibold">Entendí {estado.drafts.length} movimientos</p>
          <ul className="divide-y divide-line">
            {estado.drafts.map((d, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{d.concept}</p>
                  <p className="truncate text-xs text-muted">
                    {d.category}{d.nature ? ` · ${d.nature}` : ""}
                    {d.occurred_on !== todayLima() ? ` · ${etiquetaFecha(d.occurred_on, todayLima())}` : ""}
                    {d.confidence < 0.7 && <span className="text-neg"> · revisa</span>}
                  </p>
                </div>
                <span className="shrink-0 text-lg font-bold tabular-nums">{soles(d.amount)}</span>
                <button type="button" className="tap px-2 text-sm text-muted" aria-label={`Quitar ${d.concept}`}
                  onClick={() => {
                    const resto = estado.drafts.filter((_, j) => j !== i);
                    setEstado(resto.length === 1 ? { k: "confirmar", draft: resto[0], source: estado.source } : { ...estado, drafts: resto });
                  }}>Quitar</button>
              </li>
            ))}
          </ul>
          <p className="text-right text-sm text-muted tabular-nums">Total {soles(estado.drafts.reduce((a, d) => a + d.amount, 0))}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => setEstado({ k: "idle" })}>Cancelar</button>
            <button className="btn-primary" disabled={pending} onClick={() => guardarVarios(estado.drafts, estado.source)}>
              {pending ? "Guardando…" : `Confirmar ${estado.drafts.length}`}
            </button>
          </div>
        </div>
      )}

      {estado.k === "confirmar" && (
        <div className="card pop-in space-y-4 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold">{estado.draft.concept}</p>
              <p className="text-xs text-muted capitalize">
                {estado.draft.type} · {estado.draft.category}
                {estado.draft.nature && ` · ${estado.draft.nature}`}
              </p>
            </div>
            <p className={`shrink-0 text-3xl font-bold tabular-nums ${estado.draft.type === "ingreso" ? "text-pos" : ""}`}>
              {soles(estado.draft.amount)}
            </p>
          </div>
          {estado.draft.occurred_on !== todayLima() && (
            <p className="inline-flex items-center gap-1 rounded-lg bg-serie-1/10 px-2 py-1 text-sm font-medium" data-testid="fecha-detectada">
              <span aria-hidden>📅</span> {etiquetaFecha(estado.draft.occurred_on, todayLima())}
            </p>
          )}
          <Confianza valor={estado.draft.confidence} />
          {estado.draft.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {estado.draft.tags.map((t) => (
                <span key={t} className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">#{t}</span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-ghost" disabled={pending}
              onClick={() => setEstado({ k: "editar", campos: draftACampos(estado.draft), source: estado.source, confidence: estado.draft.confidence, sugerido: draftACampos(estado.draft) })}>
              Editar
            </button>
            <button className="btn-primary" disabled={pending}
              onClick={() => guardar(draftACampos(estado.draft), estado.source, estado.draft.confidence)}>
              {pending ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {estado.k === "editar" && (
        <div className="card pop-in space-y-4 p-4">
          <MovimientoFields categorias={categorias} value={estado.campos} onChange={(campos) => setEstado({ ...estado, campos })} />
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-ghost" disabled={pending} onClick={() => { setEstado({ k: "idle" }); setAviso(null); }}>Cancelar</button>
            <button className="btn-primary" disabled={pending}
              onClick={() => guardar(estado.campos, estado.source, estado.confidence, estado.sugerido)}>
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {estado.k === "idle" && (
        <button className="tap w-full text-muted underline-offset-4 hover:underline"
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

function Microfono({ voz, ocupado, onIniciar, onTeclado }: {
  voz: ReturnType<typeof useVozRegistro>; ocupado: boolean; onIniciar: () => void; onTeclado: () => void;
}) {
  const escuchando = voz.estado === "escuchando";
  const procesando = voz.estado === "procesando" || voz.estado === "preparando";
  return (
    <div className="card flex flex-col items-center gap-3 p-5" aria-live="polite">
      <button
        type="button"
        onClick={escuchando ? voz.detener : onIniciar}
        disabled={ocupado || procesando}
        aria-pressed={escuchando}
        aria-label={escuchando ? "Terminar de escuchar" : "Registrar por voz"}
        className={`relative flex size-20 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-50 ${
          escuchando ? "bg-neg text-white" : "bg-brand text-brand-fg"
        }`}
      >
        {escuchando && <span className="absolute inset-0 animate-ping rounded-full bg-neg/40" aria-hidden />}
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="relative">
          {escuchando ? <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /> : (
            <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>
          )}
        </svg>
      </button>
      <p className="min-h-5 text-center text-sm" data-testid="estado-voz">
        {escuchando ? (
          voz.parcial ? <span className="font-medium">“{voz.parcial}”</span> : <span className="text-muted">Escuchando… di, por ejemplo, “18 soles taxi”</span>
        ) : procesando ? (
          voz.estado === "preparando" ? (
            <span className="block text-muted" data-testid="voz-preparando">
              Preparando voz sin conexión (solo la primera vez)…{voz.progreso !== null ? ` ${voz.progreso} %` : ""}
              <span className="mx-auto mt-2 block h-1.5 w-40 overflow-hidden rounded-full bg-bg" aria-hidden>
                <span className="block h-full rounded-full bg-brand transition-all" style={{ width: `${voz.progreso ?? 5}%` }} />
              </span>
            </span>
          ) : <span className="text-muted">{voz.motor === "whisper" ? "Transcribiendo…" : "Procesando…"}</span>
        ) : voz.estado === "error" ? (
          <span className="text-neg">{voz.error}</span>
        ) : (
          <span className="text-muted">Toca y dicta tu movimiento</span>
        )}
      </p>
      {voz.estado === "error" && (
        <div className="grid w-full grid-cols-2 gap-2">
          <button type="button" className="btn-ghost" onClick={onTeclado}>Dictar con el teclado</button>
          <button type="button" className="btn-primary" onClick={onIniciar}>Reintentar</button>
        </div>
      )}
      {voz.eventos.length > 0 && (
        <ol className="w-full rounded-lg bg-bg p-2 font-mono text-[11px] leading-4 text-muted" data-testid="voz-diagnostico">
          {voz.eventos.map((e, i) => <li key={i}>{e}</li>)}
        </ol>
      )}
      {escuchando && (
        <div className="grid w-full grid-cols-2 gap-2">
          <button type="button" className="btn-ghost" onClick={voz.cancelar}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={voz.detener}>Terminar</button>
        </div>
      )}
    </div>
  );
}
