import { describe, expect, it } from "vitest";
import { DetectorSilencio, aMono, remuestrear, rms } from "./audio";

const recorrer = (d: DetectorSilencio, niveles: [number, number][]) => {
  let ultima = "seguir";
  for (const [nivel, t] of niveles) { ultima = d.empujar(nivel, t); if (ultima !== "seguir") return { ultima, t }; }
  return { ultima, t: -1 };
};
const tramo = (desde: number, hasta: number, nivel: number) => {
  const out: [number, number][] = [];
  for (let t = desde; t < hasta; t += 100) out.push([nivel, t]);
  return out;
};

describe("rms", () => {
  it("calcula el nivel", () => {
    expect(rms([0, 0])).toBe(0);
    expect(rms([0.5, -0.5])).toBeCloseTo(0.5);
  });
});

describe("DetectorSilencio", () => {
  it("corta tras 1,4 s de silencio después de hablar", () => {
    const d = new DetectorSilencio();
    const r = recorrer(d, [...tramo(0, 300, 0.003), ...tramo(300, 1500, 0.1), ...tramo(1500, 5000, 0.004)]);
    expect(r.ultima).toBe("fin");
    expect(r.t).toBeGreaterThanOrEqual(2800);
    expect(r.t).toBeLessThan(3100);
  });
  it("una pausa corta dentro de la frase no corta", () => {
    const d = new DetectorSilencio();
    const r = recorrer(d, [...tramo(0, 300, 0.003), ...tramo(300, 1000, 0.1), ...tramo(1000, 1800, 0.004), ...tramo(1800, 2500, 0.1), ...tramo(2500, 4500, 0.004)]);
    expect(r.ultima).toBe("fin");
    expect(r.t).toBeGreaterThanOrEqual(3800);
  });
  it("sin voz en 6 s → sin-voz", () => {
    expect(recorrer(new DetectorSilencio(), tramo(0, 7000, 0.004)).ultima).toBe("sin-voz");
  });
  it("ruido de fondo alto: el umbral se adapta", () => {
    const d = new DetectorSilencio();
    const r = recorrer(d, [...tramo(0, 300, 0.02), ...tramo(300, 7000, 0.03)]);
    expect(r.ultima).toBe("sin-voz");
  });
  it("si se habla desde el primer instante también funciona", () => {
    const d = new DetectorSilencio();
    expect(recorrer(d, [...tramo(0, 1200, 0.2), ...tramo(1200, 3000, 0.003)]).ultima).toBe("fin");
  });
  it("máximo 12 s", () => {
    expect(recorrer(new DetectorSilencio(), tramo(0, 13000, 0.2)).ultima).toBe("maximo");
  });
});

describe("remuestrear y mono", () => {
  it("48 kHz → 16 kHz conserva duración y forma", () => {
    const e = new Float32Array(48000).map((_, i) => Math.sin(i / 10));
    const s = remuestrear(e, 48000);
    expect(s.length).toBe(16000);
    expect(s[100]).toBeCloseTo(e[300], 3);
  });
  it("mezcla a mono", () => {
    expect(Array.from(aMono([new Float32Array([1, 0]), new Float32Array([0, 1])]))).toEqual([0.5, 0.5]);
  });
});
