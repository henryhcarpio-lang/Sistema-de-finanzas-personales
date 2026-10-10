/**
 * Elección del motor de dictado. "navegador" = Web Speech API (rápido, con
 * texto en vivo); "whisper" = grabación + Whisper ejecutado en el propio
 * dispositivo (gratis, sin servidor; funciona donde Web Speech no existe o falla).
 */
export type Motor = "navegador" | "whisper";
export type AjusteMotor = "auto" | "navegador" | "whisper";

export interface Capacidades {
  webSpeech: boolean;
  /** getUserMedia + MediaRecorder + Worker + AudioContext + WebAssembly. */
  grabacion: boolean;
}

/**
 * - Ajuste explícito: se respeta si el dispositivo lo soporta.
 * - Automático: Web Speech salvo que no exista o ya haya fallado en este
 *   dispositivo (iPhone: abre el micrófono y no devuelve texto); entonces Whisper.
 */
export function elegirMotor(ajuste: AjusteMotor, c: Capacidades, falloNavegador: boolean): Motor | null {
  if (ajuste === "navegador") return c.webSpeech ? "navegador" : c.grabacion ? "whisper" : null;
  if (ajuste === "whisper") return c.grabacion ? "whisper" : c.webSpeech ? "navegador" : null;
  if (c.webSpeech && !(falloNavegador && c.grabacion)) return "navegador";
  return c.grabacion ? "whisper" : null;
}

/** Tipo de audio que graba MediaRecorder en este navegador (iOS: mp4; resto: webm/opus). */
export function tipoGrabacion(soporta: (t: string) => boolean): string | undefined {
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(soporta);
}
