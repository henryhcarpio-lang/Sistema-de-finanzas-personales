import { describe, expect, it } from "vitest";
import { conviene, instruccionesIA, respuestaABorradores, type ContextoIA } from "./ia";
import type { Draft } from "./types";

const ctx: ContextoIA = {
  hoy: "2026-10-15",
  categorias: [
    { name: "Transporte", nature: "necesidad" }, { name: "Regalos", nature: "deseo" },
    { name: "Trabajo", nature: "necesidad" }, { name: "Otros", nature: null },
  ],
  preferencias: [{ keyword: "combi", category: "Transporte" }],
};

describe("instruccionesIA", () => {
  it("incluye fecha, categorías y preferencias", () => {
    const s = instruccionesIA(ctx);
    expect(s).toContain("Hoy es 2026-10-15");
    expect(s).toContain("- Regalos (deseo)");
    expect(s).toContain('"combi" → Transporte');
  });
});

describe("respuestaABorradores", () => {
  it("convierte varios movimientos", () => {
    const d = respuestaABorradores({ movimientos: [
      { amount: 1, concept: "taxi", type: "egreso", nature: "necesidad", category: "Transporte", date: "2026-10-15", confidence: 0.95 },
      { amount: 50, concept: "Regalo a mi hermana", type: "egreso", nature: "deseo", category: "regalos", date: "2026-10-14", confidence: 0.8 },
    ] }, ctx);
    expect(d.map((x) => [x.amount, x.concept, x.category, x.occurred_on])).toEqual([
      [1, "Taxi", "Transporte", "2026-10-15"], [50, "Regalo a mi hermana", "Regalos", "2026-10-14"]]);
    expect(d[0].confidence).toBeLessThan(0.9);
  });
  it("categoría inexistente → Otros con confianza baja", () => {
    const [d] = respuestaABorradores({ movimientos: [{ amount: 5, concept: "x", type: "egreso", category: "Inventada", date: "2026-10-15", confidence: 0.9 }] }, ctx);
    expect(d.category).toBe("Otros");
    expect(d.confidence).toBeLessThan(0.7);
  });
  it("sin fechas futuras ni basura", () => {
    const d = respuestaABorradores({ movimientos: [
      { amount: 5, concept: "pan", type: "egreso", category: "Otros", date: "2027-01-01", confidence: 0.9 },
      { amount: -3, concept: "mal", type: "egreso", category: "Otros", date: "2026-10-15", confidence: 1 },
      { amount: 7, concept: "x", type: "robo", category: "Otros", date: "2026-10-15", confidence: 1 },
      "texto",
    ] }, ctx);
    expect(d).toHaveLength(1);
    expect(d[0].occurred_on).toBe("2026-10-15");
  });
  it("ingreso sin naturaleza; respuesta inválida → []", () => {
    expect(respuestaABorradores({ movimientos: [{ amount: 3000, concept: "Sueldo", type: "ingreso", nature: "necesidad", category: "Trabajo", date: "2026-10-15", confidence: 0.9 }] }, ctx)[0].nature).toBeNull();
    expect(respuestaABorradores("nada", ctx)).toEqual([]);
  });
});

describe("conviene", () => {
  const d = (c: number, needsType = false) => ({ confidence: c, needsType } as Draft);
  it("solo cuando las reglas dudan", () => {
    expect(conviene(null, 1)).toBe(true);
    expect(conviene(d(0.4), 1)).toBe(true);
    expect(conviene(d(0.2, true), 1)).toBe(true);
    expect(conviene(d(0.85), 1)).toBe(false);
    expect(conviene(d(0.4), 2)).toBe(false);
  });
});
