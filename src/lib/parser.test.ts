import { describe, expect, it } from "vitest";
import { parseMovimiento } from "./parser";
import { rangoPeriodo } from "./dates";

const T = "2026-10-04";
const p = (s: string) => parseMovimiento(s, T)!;

describe("parseMovimiento", () => {
  it("un sol pasaje", () => {
    const d = p("Un sol pasaje.");
    expect(d).toMatchObject({ amount: 1, type: "egreso", category: "Transporte", nature: "necesidad", occurred_on: T });
    expect(d.concept).toBe("Pasaje");
  });
  it("gasté 18 soles en taxi", () => {
    const d = p("Gasté 18 soles en taxi.");
    expect(d).toMatchObject({ amount: 18, category: "Transporte" });
    expect(d.tags).toContain("Taxi");
  });
  it("35 soles almuerzo", () => {
    expect(p("35 soles almuerzo")).toMatchObject({ amount: 35, category: "Almuerzo / comida fuera" });
  });
  it("pagué 620 soles del banco => deuda", () => {
    expect(p("Pagué 620 soles del banco")).toMatchObject({ amount: 620, type: "deuda", nature: "deuda" });
  });
  it("me depositaron 2,500 soles => ingreso", () => {
    expect(p("Me depositaron 2,500 soles")).toMatchObject({ amount: 2500, type: "ingreso", nature: null });
  });
  it("separé 300 soles para ahorro", () => {
    expect(p("Separé 300 soles para ahorro")).toMatchObject({ amount: 300, type: "ahorro" });
  });
  it("banco 500 es ambiguo", () => {
    const d = p("Banco 500");
    expect(d.needsType).toBe(true);
    expect(d.confidence).toBeLessThan(0.5);
  });
  it("decimales y sin monto", () => {
    expect(p("18.50 café").amount).toBe(18.5);
    expect(p("18,5 café").amount).toBe(18.5);
    expect(parseMovimiento("hola", T)).toBeNull();
  });
});

describe("rangoPeriodo", () => {
  it("semana lunes-domingo, mes y año", () => {
    expect(rangoPeriodo("semana", T)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(rangoPeriodo("mes", T)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(rangoPeriodo("anio", T)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
});

describe("concepto", () => {
  it("quita verbos con tilde", () => {
    expect(p("Gasté 18 soles en taxi").concept).toBe("Taxi");
    expect(p("Pagué 35 del almuerzo").concept).toBe("Almuerzo");
  });
});

describe("preferencias aprendidas", () => {
  const prefs = [
    { keyword: "pasaje", type: "egreso" as const, nature: "deseo" as const, category: "Entretenimiento", hits: 1 },
    { keyword: "banco", type: "deuda" as const, nature: "deuda" as const, category: "Deudas", hits: 2 },
  ];
  it("una corrección previa tiene prioridad sobre las reglas", () => {
    const d = parseMovimiento("Un sol pasaje", T, prefs)!;
    expect(d).toMatchObject({ category: "Entretenimiento", nature: "deseo", confidence: 0.95 });
  });
  it("resuelve la ambigüedad aprendida de 'Banco 500'", () => {
    const d = parseMovimiento("Banco 500", T, prefs)!;
    expect(d).toMatchObject({ type: "deuda", needsType: false });
  });
  it("solo coincide con palabras completas", () => {
    expect(parseMovimiento("20 soles pasajero", T, prefs)!.category).not.toBe("Entretenimiento");
  });
});

describe("números dictados (voz)", () => {
  it.each([
    ["dieciocho soles taxi", 18],
    ["treinta y cinco soles almuerzo", 35],
    ["ciento veinte soles supermercado", 120],
    ["me depositaron dos mil quinientos soles", 2500],
    ["veintidós soles cine", 22],
    ["mil soles alquiler", 1000],
    ["dieciocho soles con cincuenta taxi", 18.5],
    ["18 soles con 50 taxi", 18.5],
    ["un sol con veinte céntimos pasaje", 1.2],
  ])("%s → %d", (frase, monto) => {
    expect(p(frase).amount).toBe(monto);
  });
  it("el concepto no arrastra el número ni los céntimos", () => {
    expect(p("dieciocho soles con cincuenta taxi").concept).toBe("Taxi");
    expect(p("18 soles con 50 taxi").concept).toBe("Taxi");
  });
  it("palabras sueltas sin 'soles' no son monto", () => {
    expect(parseMovimiento("dos pasajes", T)).toBeNull();
  });
});
