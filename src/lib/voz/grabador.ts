"use client";

import { DetectorSilencio, aMono, remuestrear, rms, type Decision } from "./audio";
import { tipoGrabacion } from "./motor";

export type FinGrabacion =
  | { tipo: "audio"; audio: Float32Array; ms: number }
  | { tipo: "sin-voz" }
  | { tipo: "cancelado" }
  | { tipo: "error"; codigo: "permiso" | "sin-microfono" | "otro"; detalle: string };

export interface Grabacion {
  /** Termina y procesa lo grabado. */
  detener(): void;
  /** Descarta lo grabado. */
  cancelar(): void;
  fin: Promise<FinGrabacion>;
}

/** El navegador puede grabar y procesar audio localmente. */
export function puedeGrabar(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { MediaRecorder?: unknown; AudioContext?: unknown; webkitAudioContext?: unknown; WebAssembly?: unknown; Worker?: unknown };
  return !!(typeof navigator.mediaDevices?.getUserMedia === "function" && w.MediaRecorder && (w.AudioContext || w.webkitAudioContext) && w.WebAssembly && w.Worker);
}

let ctxCompartido: AudioContext | null = null;
/** Un AudioContext por página, creado/reanudado dentro del toque (requisito de iOS). */
function contexto(): AudioContext {
  const C = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  if (!ctxCompartido || ctxCompartido.state === "closed") ctxCompartido = new C();
  if (ctxCompartido.state === "suspended") void ctxCompartido.resume();
  return ctxCompartido;
}

/** Decodifica lo grabado a mono 16 kHz (lo que espera Whisper). */
async function a16k(blob: Blob): Promise<Float32Array> {
  const datos = await blob.arrayBuffer();
  const ctx = contexto();
  const buf = await new Promise<AudioBuffer>((ok, mal) => {
    const p = ctx.decodeAudioData(datos, ok, mal); // forma con callbacks: compatible con Safari antiguo
    if (p && typeof p.then === "function") p.then(ok, mal);
  });
  const canales = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
  return remuestrear(aMono(canales), buf.sampleRate, 16_000);
}

/**
 * Graba desde el micrófono y corta solo tras una pausa (detector de silencio).
 * Al terminar SIEMPRE suelta el micrófono (track.stop()), para que el
 * siguiente dictado funcione igual que el primero.
 */
export function grabar(opciones: { onLog?: (m: string) => void; onNivel?: (n: number) => void } = {}): Grabacion {
  const log = opciones.onLog ?? (() => {});
  let resolver!: (f: FinGrabacion) => void;
  const fin = new Promise<FinGrabacion>((r) => { resolver = r; });
  let terminado = false;
  let cancelado = false;
  let rec: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let intervalo: ReturnType<typeof setInterval> | null = null;
  let fuente: MediaStreamAudioSourceNode | null = null;
  let razon: Decision | "manual" = "manual";
  const trozos: Blob[] = [];
  const t0 = performance.now();
  const ctx = contexto(); // dentro del toque

  const soltar = () => {
    if (intervalo) clearInterval(intervalo);
    intervalo = null;
    try { fuente?.disconnect(); } catch { /* */ }
    stream?.getTracks().forEach((t) => t.stop());
    log("micrófono liberado");
  };
  const terminar = (f: FinGrabacion) => {
    if (terminado) return;
    terminado = true;
    soltar();
    resolver(f);
  };
  const parar = (motivo: Decision | "manual") => {
    razon = motivo;
    if (rec && rec.state !== "inactive") { log(`stop (${motivo})`); rec.stop(); }
    else terminar(cancelado ? { tipo: "cancelado" } : { tipo: "sin-voz" });
  };

  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
    .then((s) => {
      stream = s;
      if (cancelado || terminado) { terminar({ tipo: "cancelado" }); return; }
      log("micrófono abierto");
      const tipo = tipoGrabacion((t) => MediaRecorder.isTypeSupported?.(t) ?? false);
      rec = new MediaRecorder(s, tipo ? { mimeType: tipo } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size) trozos.push(e.data); };
      rec.onstop = async () => {
        const ms = Math.round(performance.now() - t0);
        soltar();
        if (cancelado) return terminar({ tipo: "cancelado" });
        if (razon === "sin-voz") return terminar({ tipo: "sin-voz" });
        try {
          const audio = await a16k(new Blob(trozos, { type: rec?.mimeType || tipo || "audio/webm" }));
          log(`audio ${(audio.length / 16000).toFixed(1)} s`);
          terminar({ tipo: "audio", audio, ms });
        } catch (e) {
          terminar({ tipo: "error", codigo: "otro", detalle: `decodificar: ${String(e)}` });
        }
      };
      rec.start(250);
      // Detector de silencio con el nivel del micrófono.
      fuente = ctx.createMediaStreamSource(s);
      const analizador = ctx.createAnalyser();
      analizador.fftSize = 2048;
      fuente.connect(analizador);
      const buf = new Float32Array(analizador.fftSize);
      const det = new DetectorSilencio();
      intervalo = setInterval(() => {
        analizador.getFloatTimeDomainData(buf);
        const n = rms(buf);
        opciones.onNivel?.(n);
        const d = det.empujar(n, performance.now() - t0);
        if (d !== "seguir") parar(d);
      }, 100);
    })
    .catch((e: DOMException) => {
      const codigo = e?.name === "NotAllowedError" || e?.name === "SecurityError" ? "permiso"
        : e?.name === "NotFoundError" || e?.name === "OverconstrainedError" ? "sin-microfono" : "otro";
      terminar({ tipo: "error", codigo, detalle: `${e?.name}: ${e?.message}` });
    });

  return {
    fin,
    detener: () => parar("manual"),
    cancelar: () => { cancelado = true; parar("manual"); },
  };
}
