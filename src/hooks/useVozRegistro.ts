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
/** Un fin antes de este tiempo sin texto es un fallo de arranque (frecuente en iOS): se reintenta. */
const ARRANQUE_FALLIDO_MS = 700;
const sinSuscripcion = () => () => {};

/**
 * Dictado con el reconocimiento de voz del navegador. Escucha en modo continuo
 * y termina tras una pausa, así una frase con pausas ("dieciocho… soles taxi")
 * llega completa. `onTexto` recibe las frases candidatas (alternativas del
 * reconocedor); quien llama elige la que tiene sentido como movimiento.
 */
export function useVozRegistro(onTexto: (candidatas: string[]) => void) {
  // Se calcula solo en el cliente: en el servidor siempre es false (sin desajuste de hidratación).
  const soportado = useSyncExternalStore(sinSuscripcion, () => constructorVoz() !== null, () => false);
  const [estado, setEstado] = useState<EstadoVoz>("inactivo");
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Reconocedor | null>(null);
  const resultados = useRef<ResultadoTexto[]>([]);
  const cancelado = useRef(false);
  const reintentado = useRef(false);
  const inicio = useRef(0);
  const tSilencio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tLimite = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reintentar = useRef<() => void>(() => {});
  const onTextoRef = useRef(onTexto);
  useEffect(() => { onTextoRef.current = onTexto; }, [onTexto]);

  const limpiarTimers = () => {
    if (tSilencio.current) clearTimeout(tSilencio.current);
    if (tLimite.current) clearTimeout(tLimite.current);
    tSilencio.current = tLimite.current = null;
  };
  const programarSilencio = (ms: number) => {
    if (tSilencio.current) clearTimeout(tSilencio.current);
    tSilencio.current = setTimeout(() => rec.current?.stop(), ms);
  };

  const arrancar = useCallback(() => {
    const Ctor = constructorVoz();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "es-PE";
    r.interimResults = true;
    r.continuous = true; // terminamos nosotros tras una pausa (iOS corta muy pronto si no)
    r.maxAlternatives = 5;
    resultados.current = [];
    inicio.current = Date.now();
    let errorFatal: string | null = null;

    r.onresult = (e) => {
      const todos: ResultadoTexto[] = [];
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const alts: string[] = [];
        for (let j = 0; j < res.length; j++) if (res[j]?.transcript) alts.push(res[j].transcript);
        todos.push(alts);
      }
      resultados.current = todos;
      setParcial(transcripciones(todos)[0] ?? "");
      programarSilencio(SILENCIO_MS);
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      errorFatal = e.error;
    };
    r.onend = () => {
      limpiarTimers();
      rec.current = null;
      if (cancelado.current) return;
      const candidatas = transcripciones(resultados.current);
      if (!candidatas.length) {
        const rapido = Date.now() - inicio.current < ARRANQUE_FALLIDO_MS;
        // iOS a veces termina al instante o sin captar audio: un reintento silencioso.
        const reintentable = errorFatal === null || errorFatal === "no-speech";
        if (!reintentado.current && reintentable && (rapido || errorFatal === "no-speech")) {
          reintentado.current = true;
          reintentar.current();
          return;
        }
        setError(MENSAJES[errorFatal ?? "no-speech"] ?? `No se pudo usar el micrófono. ${AYUDA_TECLADO}`);
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

    rec.current = r;
    try {
      r.start();
    } catch {
      rec.current = null;
      setError(`No se pudo iniciar el micrófono. ${AYUDA_TECLADO}`);
      setEstado("error");
      return;
    }
    programarSilencio(SIN_VOZ_MS);
    tLimite.current = setTimeout(() => r.stop(), MAX_MS);
  }, []);
  useEffect(() => { reintentar.current = arrancar; }, [arrancar]);

  const iniciar = useCallback(() => {
    if (rec.current || !constructorVoz()) return;
    cancelado.current = false;
    reintentado.current = false;
    setParcial("");
    setError(null);
    setEstado("escuchando");
    arrancar();
  }, [arrancar]);

  /** Termina de escuchar y procesa lo dicho. */
  const detener = useCallback(() => rec.current?.stop(), []);

  /** Descarta lo escuchado. */
  const cancelar = useCallback(() => {
    cancelado.current = true;
    limpiarTimers();
    rec.current?.abort();
    rec.current = null;
    setParcial("");
    setEstado("inactivo");
  }, []);

  useEffect(() => () => { cancelado.current = true; limpiarTimers(); rec.current?.abort(); }, []);

  return { soportado, estado, parcial, error, iniciar, detener, cancelar, cerrarError: () => { setError(null); setEstado("inactivo"); } };
}
