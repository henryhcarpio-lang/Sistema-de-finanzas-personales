import { describe, expect, it } from "vitest";
import { extraerFecha } from "./fechaFrase";
import { parseMovimiento } from "./parser";

const T = "2026-10-04"; // domingo

describe("extraerFecha", () => {
  it.each([
    ["ayer 18 soles taxi", "2026-10-03"],
    ["Anteayer 35 soles almuerzo", "2026-10-02"],
    ["antes de ayer 10 soles", "2026-10-02"],
    ["hoy 5 soles pan", T],
    ["hace 3 días 20 soles cine", "2026-10-01"],
    ["hace dos dias 20 soles cine", "2026-10-02"],
    ["el lunes 20 soles cine", "2026-09-28"],
    ["el sábado 40 soles cena", "2026-10-03"],
    ["este miércoles 12 soles", "2026-09-30"],
    ["el domingo 9 soles", T],
    ["el domingo pasado 9 soles", "2026-09-27"],
    ["el 3 de octubre 50 soles farmacia", "2026-10-03"],
    ["el 25 de diciembre 200 soles regalos", "2025-12-25"],
    ["el 2 de enero de 2026 30 soles", "2026-01-02"],
    ["el día 10 15 soles", "2026-09-10"],
    ["el día 2 15 soles", "2026-10-02"],
  ])("%s → %s", (frase, fecha) => {
    expect(extraerFecha(frase, T)?.fecha).toBe(fecha);
  });
  it("sin fecha → null; fechas imposibles se ignoran", () => {
    expect(extraerFecha("18 soles taxi", T)).toBeNull();
    expect(extraerFecha("el 31 de febrero 10 soles", T)).toBeNull();
    expect(extraerFecha("ayerbe 10 soles", T)).toBeNull();
  });
});

describe("parseMovimiento con fecha", () => {
  it("ayer 18 soles taxi", () => {
    expect(parseMovimiento("Ayer 18 soles taxi", T)).toMatchObject({ amount: 18, concept: "Taxi", category: "Transporte", occurred_on: "2026-10-03" });
  });
  it("la fecha explícita no se confunde con el monto", () => {
    expect(parseMovimiento("el 3 de octubre 50 soles farmacia", T)).toMatchObject({ amount: 50, concept: "Farmacia", occurred_on: "2026-10-03", category: "Salud" });
  });
  it("funciona con números dictados y al final de la frase", () => {
    expect(parseMovimiento("treinta y cinco soles almuerzo anteayer", T)).toMatchObject({ amount: 35, concept: "Almuerzo", occurred_on: "2026-10-02" });
  });
  it("sin fecha sigue siendo hoy", () => {
    expect(parseMovimiento("18 soles taxi", T)!.occurred_on).toBe(T);
  });
});
