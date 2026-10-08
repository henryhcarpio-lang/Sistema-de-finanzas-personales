"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { transcripciones, type ResultadoTexto } from "@/lib/transcripcion";

// Tipos mínimos de la Web Speech API (no están en lib.dom de TypeScript).
interface AlternativaVoz { transcript: string }
interface ResultadoVoz { isFinal: boolean; length: number; [i: number]: AlternativaVoz }
interface EventoResultado { resultIndex: number; results: ArrayLike<ResultadoVoz> }
interface Reconocedor {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: EventoResultado) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type ConstructorReconocedor = new () => Reconocedor;

function constructorVoz(): ConstructorReconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type EstadoVoz = "inactivo" | "escuchando" | "procesando" | "error";

const AYUDA_TECLADO = "Si la voz falla, toca el campo de texto y usa el micrófono del teclado 🎤.";
const MENSAJES: Record<string, string> = {
  "not-allowed": "Permite el uso del micrófono para registrar por voz (Ajustes › Safari › Micrófono).",
  "service-not-allowed": `El reconocimiento de voz no está disponible ahora. ${AYUDA_TECLADO}`,
  "no-speech": `No te escuché. Toca el micrófono y habla cerca del teléfono. ${AYUDA_TECLADO}`,
  "audio-capture": "No se encontró un micrófono.",
  network: `Sin conexión: el reconocimiento de voz necesita internet. ${AYUDA_TECLADO}`,
};

/** Silencio tras el último resultado para dar por terminada la frase. */
const SILENCIO_MS = 1600;
/** Si en este tiempo no llega nada, se detiene. */
const SIN_VOZ_MS = 6000;
const MAX_MS = 12_000;
/** Si tras pedir stop() el navegador no avisa el fin (pasa en iOS), se cierra igual. */
const GRACIA_FIN_MS = 1500;
/** Un fin antes de este tiempo sin texto es un fallo de arranque (frecuente en iOS): se reintenta una vez. */
const ARRANQUE_FALLIDO_MS = 700;
const sinSuscripcion = () => () => {};
const MSG_SIN_AUDIO = `El micrófono no respondió. Toca «Reintentar». ${AYUDA_TECLADO}`;

/** Suelta un reconocedor: sin manejadores y abortado, para que iOS libere el micrófono. */
function liberar(r: Reconocedor | null) {
  if (!r) return;
  r.onresult = r.onerror = r.onend = null;
  r.onstart = r.onaudiostart = r.onspeechstart = null;
  try { r.abort(); } catch { /* ya terminado */ }
}

const modoDiagnostico = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("voz") === "debug";

/**
 * Dictado con el reconocimiento de voz del navegador. Escucha en modo continuo
 * y termina tras una pausa, así una frase con pausas ("dieciocho… soles taxi")
 * llega completa. `onTexto` recibe las frases candidatas (alternativas del
 * reconocedor); quien llama elige la que tiene sentido como movimiento.
 *
 * Robustez en iPhone: cada dictado usa un reconocedor nuevo y, al terminar, el
 * anterior se aborta (si no, iOS puede dejar el micrófono tomado y el siguiente
 * dictado no oye nada). Si iOS no avisa el fin, un temporizador lo cierra igual,
 * así el botón nunca queda trabado.
 */
export function useVozRegistro(onTexto: (candidatas: string[]) => void, idioma = "es-PE") {
  // Se calcula solo en el cliente: en el servidor siempre es false (sin desajuste de hidratación).
  const soportado = useSyncExternalStore(sinSuscripcion, () => constructorVoz() !== null, () => false);
  const [estado, setEstado] = useState<EstadoVoz>("inactivo");
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [eventos, setEventos] = useState<string[]>([]);
  const rec = useRef<Reconocedor | null>(null);
  const cerrar = useRef<(() => void) | null>(null);
  const reintentado = useRef(false);
  const reintentar = useRef<() => void>(() => {});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onTextoRef = useRef(onTexto);
  useEffect(() => { onTextoRef.current = onTexto; }, [onTexto]);
  const debug = useRef(false);
  useEffect(() => { debug.current = modoDiagnostico(); }, []);
  const t0 = useRef(0);
  const log = (ev: string) => {
    if (debug.current) setEventos((x) => [...x.slice(-30), `${((Date.now() - t0.current) / 1000).toFixed(2)}s ${ev}`]);
  };

  const limpiarTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const despues = (ms: number, fn: () => void) => { const t = setTimeout(fn, ms); timers.current.push(t); return t; };

  const arrancar = useCallback((esReintento: boolean) => {
    const Ctor = constructorVoz();
    if (!Ctor) return;
    liberar(rec.current);
    limpiarTimers();
    const r = new Ctor();
    r.lang = idioma;
    r.interimResults = true;
    r.continuous = true; // terminamos nosotros tras una pausa (iOS corta muy pronto si no)
    r.maxAlternatives = 5;
    const inicio = Date.now();
    let resultados: ResultadoTexto[] = [];
    let errorFatal: string | null = null;
    let hayAudio = false;
    let terminado = false;
    let tSilencio: ReturnType<typeof setTimeout> | null = null;

    /** Pide el fin; si el navegador no responde a tiempo, se cierra igual. */
    const pedirFin = (motivo: string) => {
      log(`stop (${motivo})`);
      try { r.stop(); } catch { /* ya parado */ }
      despues(GRACIA_FIN_MS, () => { if (!terminado) { log("watchdog: sin onend, cierre forzado"); finalizar(); } });
    };
    const silencio = (ms: number) => {
      if (tSilencio) clearTimeout(tSilencio);
      tSilencio = despues(ms, () => pedirFin(ms === SIN_VOZ_MS ? "sin voz" : "pausa"));
    };

    /** Cierre único de esta sesión: libera el micrófono y entrega el texto o el error. */
    const finalizar = () => {
      if (terminado) return;
      terminado = true;
      limpiarTimers();
      liberar(r);
      if (rec.current === r) rec.current = null;
      if (cerrar.current === finalizar) cerrar.current = null;
      const candidatas = transcripciones(resultados);
      if (!candidatas.length) {
        const rapido = Date.now() - inicio < ARRANQUE_FALLIDO_MS;
        // iOS a veces termina al instante sin captar audio: un reintento inmediato (aún dentro del toque).
        if (!reintentado.current && !esReintento && rapido && (errorFatal === null || errorFatal === "no-speech")) {
          reintentado.current = true;
          log("reintento por arranque fallido");
          reintentar.current();
          return;
        }
        const msg = errorFatal && MENSAJES[errorFatal] ? MENSAJES[errorFatal]
          : !hayAudio ? MSG_SIN_AUDIO
          : MENSAJES["no-speech"];
        setError(msg);
        setEstado("error");
        return;
      }
      setEstado("procesando");
      // Un frame para que se vea "Procesando…" antes de mostrar la tarjeta.
      requestAnimationFrame(() => {
        onTextoRef.current(candidatas);
        setEstado("inactivo");
        setParcial("");
      });
    };

    r.onstart = () => log("start");
    r.onaudiostart = () => { hayAudio = true; log("audiostart"); };
    r.onspeechstart = () => { hayAudio = true; log("speechstart"); };
    r.onresult = (e) => {
      hayAudio = true;
      const todos: ResultadoTexto[] = [];
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const alts: string[] = [];
        for (let j = 0; j < res.length; j++) if (res[j]?.transcript) alts.push(res[j].transcript);
        todos.push(alts);
      }
      resultados = todos;
      const texto = transcripciones(todos)[0] ?? "";
      log(`result «${texto}»`);
      setParcial(texto);
      silencio(SILENCIO_MS);
    };
    r.onerror = (e) => {
      log(`error ${e.error}`);
      if (e.error === "aborted") return;
      errorFatal = e.error;
    };
    r.onend = () => { log("end"); finalizar(); };

    rec.current = r;
    cerrar.current = finalizar;
    log(esReintento ? "start() reintento" : "start()");
    try {
      r.start();
    } catch {
      terminado = true;
      liberar(r);
      rec.current = null;
      setError(`No se pudo iniciar el micrófono. ${AYUDA_TECLADO}`);
      setEstado("error");
      return;
    }
    silencio(SIN_VOZ_MS);
    despues(MAX_MS, () => pedirFin("máximo"));
  }, [idioma]);
  useEffect(() => { reintentar.current = () => arrancar(true); }, [arrancar]);

  const iniciar = useCallback(() => {
    if (!constructorVoz()) return;
    // Un toque nuevo nunca se ignora: si quedó algo colgado, se suelta y se empieza de cero.
    if (rec.current) { log("había un reconocedor colgado: se libera"); liberar(rec.current); rec.current = null; cerrar.current = null; }
    t0.current = Date.now();
    if (debug.current) setEventos([]);
    reintentado.current = false;
    setParcial("");
    setError(null);
    setEstado("escuchando");
    arrancar(false);
  }, [arrancar]);

  /** Termina de escuchar y procesa lo dicho. */
  const detener = useCallback(() => {
    const r = rec.current;
    if (!r) return;
    try { r.stop(); } catch { /* ya parado */ }
    // Si el navegador no avisa el fin, se procesa igual.
    const fin = cerrar.current;
    despues(GRACIA_FIN_MS, () => fin?.());
  }, []);

  /** Descarta lo escuchado. */
  const cancelar = useCallback(() => {
    limpiarTimers();
    liberar(rec.current);
    rec.current = null;
    cerrar.current = null;
    setParcial("");
    setEstado("inactivo");
  }, []);

  // Si la app pasa a segundo plano o se bloquea la pantalla, se suelta el micrófono.
  useEffect(() => {
    const oculto = () => { if (document.visibilityState === "hidden" && rec.current) cancelar(); };
    document.addEventListener("visibilitychange", oculto);
    window.addEventListener("pagehide", cancelar);
    return () => {
      document.removeEventListener("visibilitychange", oculto);
      window.removeEventListener("pagehide", cancelar);
      limpiarTimers();
      liberar(rec.current);
      rec.current = null;
    };
  }, [cancelar]);

  return {
    soportado, estado, parcial, error, iniciar, detener, cancelar, eventos,
    cerrarError: () => { setError(null); setEstado("inactivo"); },
  };
}
