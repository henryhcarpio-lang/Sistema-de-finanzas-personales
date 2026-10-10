// Whisper local: transcripción en el propio dispositivo (sin servidor, sin costo).
// La librería y el modelo se descargan una vez desde CDN gratuitos y quedan en caché.
const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js";
const MODELOS = { base: "onnx-community/whisper-base", tiny: "onnx-community/whisper-tiny" };

let transcriptor = null;
let cargando = null;
let modeloActual = null;

async function cargar(modelo) {
  if (transcriptor && modeloActual === modelo) return transcriptor;
  if (cargando) return cargando;
  cargando = (async () => {
    const { pipeline, env } = await import(LIB);
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    const archivos = new Map();
    const t = await pipeline("automatic-speech-recognition", MODELOS[modelo] ?? MODELOS.base, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (p) => {
        if (p.status === "progress" && p.total) {
          archivos.set(p.file, { cargado: p.loaded, total: p.total });
          let c = 0, tot = 0;
          for (const a of archivos.values()) { c += a.cargado; tot += a.total; }
          self.postMessage({ type: "progreso", pct: Math.round((c / tot) * 100) });
        }
      },
    });
    transcriptor = t;
    modeloActual = modelo;
    return t;
  })();
  try { return await cargando; } finally { cargando = null; }
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "cargar") {
      const t0 = performance.now();
      await cargar(m.modelo);
      self.postMessage({ type: "listo", ms: Math.round(performance.now() - t0) });
    } else if (m.type === "transcribir") {
      const t = await cargar(m.modelo);
      const t0 = performance.now();
      const r = await t(m.audio, { language: "spanish", task: "transcribe", chunk_length_s: 30, return_timestamps: false });
      const texto = (Array.isArray(r) ? r[0]?.text : r?.text) ?? "";
      self.postMessage({ type: "texto", id: m.id, texto: texto.trim(), ms: Math.round(performance.now() - t0) });
    }
  } catch (err) {
    self.postMessage({ type: "error", id: m.id, mensaje: String(err?.message ?? err) });
  }
};
