"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Tipos mínimos de la Web Speech API (no están en lib.dom de TypeScript).
interface ResultadoVoz { isFinal: boolean; 0: { transcript: string } }
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

const MENSAJES: Record<string, string> = {
  "not-allowed": "Permite el uso del micrófono en tu navegador para registrar por voz.",
  "service-not-allowed": "Permite el uso del micrófono en tu navegador para registrar por voz.",
  "no-speech": "No te escuché. Toca el micrófono e inténtalo de nuevo.",
  "audio-capture": "No se encontró un micrófono.",
  network: "Sin conexión: el reconocimiento de voz necesita internet.",
};

const MAX_MS = 10_000;
const sinSuscripcion = () => () => {};

/**
 * Dictado con el reconocimiento de voz del navegador. `onTexto` recibe la
 * transcripción final; la interpretación la hace quien llama.
 */
export function useVozRegistro(onTexto: (texto: string) => void) {
  // Se calcula solo en el cliente: en el servidor siempre es false (sin desajuste de hidratación).
  const soportado = useSyncExternalStore(sinSuscripcion, () => constructorVoz() !== null, () => false);
  const [estado, setEstado] = useState<EstadoVoz>("inactivo");
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Reconocedor | null>(null);
  const texto = useRef("");
  const cancelado = useRef(false);
  const limite = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTextoRef = useRef(onTexto);
  useEffect(() => { onTextoRef.current = onTexto; }, [onTexto]);

  const limpiar = () => {
    if (limite.current) clearTimeout(limite.current);
    limite.current = null;
    rec.current = null;
  };

  const iniciar = useCallback(() => {
    const Ctor = constructorVoz();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = "es-PE";
    r.interimResults = true;
    r.continuous = false; // termina sola tras una pausa
    r.maxAlternatives = 1;
    texto.current = "";
    cancelado.current = false;
    setParcial("");
    setError(null);

    r.onresult = (e) => {
      let final = "";
      let provisional = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else provisional += res[0].transcript;
      }
      texto.current = (final || provisional).trim();
      setParcial((final + provisional).trim());
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      cancelado.current = true;
      setError(MENSAJES[e.error] ?? "No se pudo usar el micrófono. Escribe el movimiento.");
      setEstado("error");
    };
    r.onend = () => {
      limpiar();
      if (cancelado.current) return;
      const t = texto.current;
      if (!t) {
        setError(MENSAJES["no-speech"]);
        setEstado("error");
        return;
      }
      setEstado("procesando");
      // Un frame para que se vea "Procesando…" antes de mostrar la tarjeta.
      requestAnimationFrame(() => {
        onTextoRef.current(t);
        setEstado("inactivo");
        setParcial("");
      });
    };

    rec.current = r;
    setEstado("escuchando");
    try {
      r.start();
    } catch {
      limpiar();
      setError("No se pudo iniciar el micrófono.");
      setEstado("error");
      return;
    }
    limite.current = setTimeout(() => r.stop(), MAX_MS);
  }, []);

  /** Termina de escuchar y procesa lo dicho. */
  const detener = useCallback(() => rec.current?.stop(), []);

  /** Descarta lo escuchado. */
  const cancelar = useCallback(() => {
    cancelado.current = true;
    rec.current?.abort();
    limpiar();
    setParcial("");
    setEstado("inactivo");
  }, []);

  useEffect(() => () => { cancelado.current = true; rec.current?.abort(); }, []);

  return { soportado, estado, parcial, error, iniciar, detener, cancelar, cerrarError: () => { setError(null); setEstado("inactivo"); } };
}
