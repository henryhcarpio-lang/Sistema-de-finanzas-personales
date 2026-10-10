/**
 * Utilidades de audio para la voz sin conexión (Whisper local): nivel de
 * señal, detección de fin de frase por silencio y remuestreo a 16 kHz.
 * Sin dependencias del navegador para poder probarlas.
 */

/** Nivel RMS (0..1) de un bloque de muestras. */
export function rms(muestras: ArrayLike<number>): number {
  if (!muestras.length) return 0;
  let s = 0;
  for (let i = 0; i < muestras.length; i++) s += muestras[i] * muestras[i];
  return Math.sqrt(s / muestras.length);
}

export type Decision = "seguir" | "fin" | "sin-voz" | "maximo";

export interface OpcionesDetector {
  /** Silencio tras haber hablado que da por terminada la frase. */
  silencioMs?: number;
  /** Si en este tiempo no se detecta voz, se detiene. */
  sinVozMs?: number;
  maxMs?: number;
  /** Tiempo inicial para medir el ruido de fondo. */
  calibracionMs?: number;
  /** Nivel mínimo para considerar voz (aunque el ruido sea muy bajo). */
  umbralMin?: number;
}

/**
 * Decide cuándo cortar la grabación. Mide el ruido de fondo al inicio y
 * considera voz lo que lo supera claramente; corta tras una pausa.
 */
export class DetectorSilencio {
  private o: Required<OpcionesDetector>;
  private ruido = 0;
  private nRuido = 0;
  private hablo = false;
  private ultimaVoz = 0;

  constructor(o: OpcionesDetector = {}) {
    this.o = { silencioMs: 1400, sinVozMs: 6000, maxMs: 12_000, calibracionMs: 300, umbralMin: 0.012, ...o };
  }

  get huboVoz() { return this.hablo; }

  umbral(): number {
    return Math.max(this.o.umbralMin, this.ruido * 2.5);
  }

  /** `nivel`: RMS del bloque; `t`: ms desde el inicio de la grabación. */
  empujar(nivel: number, t: number): Decision {
    if (t >= this.o.maxMs) return "maximo";
    // Calibración del ruido de fondo; un nivel alto ya es voz y no cuenta como ruido.
    if (t < this.o.calibracionMs && !this.hablo && nivel < this.o.umbralMin * 2) {
      this.ruido = (this.ruido * this.nRuido + nivel) / (this.nRuido + 1);
      this.nRuido++;
      return "seguir";
    }
    if (nivel >= this.umbral()) {
      this.hablo = true;
      this.ultimaVoz = t;
      return "seguir";
    }
    if (this.hablo && t - this.ultimaVoz >= this.o.silencioMs) return "fin";
    if (!this.hablo && t >= this.o.sinVozMs) return "sin-voz";
    return "seguir";
  }
}

/** Remuestreo lineal (respaldo si OfflineAudioContext no está disponible). */
export function remuestrear(entrada: Float32Array, desde: number, hacia = 16_000): Float32Array {
  if (desde === hacia) return entrada;
  const n = Math.max(1, Math.round((entrada.length * hacia) / desde));
  const salida = new Float32Array(n);
  const paso = desde / hacia;
  for (let i = 0; i < n; i++) {
    const x = i * paso;
    const a = Math.floor(x);
    const b = Math.min(a + 1, entrada.length - 1);
    const f = x - a;
    salida[i] = entrada[a] * (1 - f) + entrada[b] * f;
  }
  return salida;
}

/** Mezcla canales a mono. */
export function aMono(canales: Float32Array[]): Float32Array {
  if (canales.length === 1) return canales[0];
  const n = canales[0].length;
  const out = new Float32Array(n);
  for (const c of canales) for (let i = 0; i < n; i++) out[i] += c[i] / canales.length;
  return out;
}
