"use client";

/**
 * Cliente del worker de Whisper local. Un único worker por página; el modelo
 * se carga una vez (con progreso) y luego cada transcripción es local.
 */
type Mensaje =
  | { type: "progreso"; pct: number }
  | { type: "listo"; ms: number }
  | { type: "texto"; id: number; texto: string; ms: number }
  | { type: "error"; id?: number; mensaje: string };

let worker: Worker | null = null;
let modelo: "base" | "tiny" = "base";
let siguienteId = 1;
const oyentesProgreso = new Set<(pct: number) => void>();
const pendientes = new Map<number, { ok: (t: { texto: string; ms: number }) => void; mal: (e: Error) => void }>();
let cargaEnCurso: Promise<void> | null = null;

const MARCA = "whisper-listo";
export const modeloDescargado = () => { try { return localStorage.getItem(MARCA) === "1"; } catch { return false; } };

function obtener(): Worker {
  if (worker) return worker;
  const w = new Worker("/whisper-worker.js", { type: "module" });
  w.onmessage = (e: MessageEvent<Mensaje>) => {
    const m = e.data;
    if (m.type === "progreso") oyentesProgreso.forEach((f) => f(m.pct));
    else if (m.type === "texto") { pendientes.get(m.id)?.ok({ texto: m.texto, ms: m.ms }); pendientes.delete(m.id); }
    else if (m.type === "error") {
      const err = new Error(m.mensaje);
      if (m.id !== undefined) { pendientes.get(m.id)?.mal(err); pendientes.delete(m.id); }
      else pendientes.forEach((p) => p.mal(err));
    }
  };
  // Si el worker muere (p. ej. sin memoria en el teléfono), se rechaza todo y se recrea la próxima vez.
  w.onerror = (e) => {
    const err = new Error(e.message || "worker");
    pendientes.forEach((p) => p.mal(err));
    pendientes.clear();
    worker = null;
    cargaEnCurso = null;
  };
  worker = w;
  return w;
}

/** Descarga y prepara el modelo (idempotente). `onProgreso` recibe 0..100. */
export function precargar(onProgreso?: (pct: number) => void): Promise<void> {
  if (onProgreso) oyentesProgreso.add(onProgreso);
  const quitar = () => { if (onProgreso) oyentesProgreso.delete(onProgreso); };
  if (!cargaEnCurso) {
    const w = obtener();
    cargaEnCurso = new Promise<void>((ok, mal) => {
      const escuchar = (e: MessageEvent<Mensaje>) => {
        if (e.data.type === "listo") { w.removeEventListener("message", escuchar); try { localStorage.setItem(MARCA, "1"); } catch { /* */ } ok(); }
        else if (e.data.type === "error" && e.data.id === undefined) { w.removeEventListener("message", escuchar); cargaEnCurso = null; mal(new Error(e.data.mensaje)); }
      };
      w.addEventListener("message", escuchar);
      w.postMessage({ type: "cargar", modelo });
    });
  }
  return cargaEnCurso.finally(quitar);
}

/** Transcribe audio mono a 16 kHz. Si el worker se cae por memoria, reintenta una vez con el modelo pequeño. */
export async function transcribir(audio: Float32Array): Promise<{ texto: string; ms: number }> {
  const intentar = () => new Promise<{ texto: string; ms: number }>((ok, mal) => {
    const id = siguienteId++;
    pendientes.set(id, { ok, mal });
    obtener().postMessage({ type: "transcribir", id, audio, modelo }, []);
  });
  try {
    return await intentar();
  } catch (e) {
    if (modelo === "base" && !worker) { modelo = "tiny"; cargaEnCurso = null; return intentar(); }
    throw e;
  }
}
