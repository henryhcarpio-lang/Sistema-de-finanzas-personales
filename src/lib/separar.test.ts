import { describe, expect, it } from "vitest";
import { separarMovimientos } from "./separar";

const T = "2026-10-15";
const sep = (s: string) => separarMovimientos(s, T).frases;

describe("separarMovimientos", () => {
  it("sin separadores, dictado de corrido", () => {
    expect(sep("Un sol taxi dos soles pasaje")).toEqual(["Un sol taxi", "dos soles pasaje"]);
    expect(sep("18 taxi 20 almuerzo")).toEqual(["18 taxi", "20 almuerzo"]);
    expect(sep("taxi 18 soles almuerzo 20 soles")).toEqual(["taxi 18 soles", "almuerzo 20 soles"]);
  });
  it("con comas, 'y', 'también'", () => {
    expect(sep("5 soles pan, 3 soles leche")).toEqual(["5 soles pan", "3 soles leche"]);
    expect(sep("5 soles pan y 3 soles leche y 10 soles taxi")).toEqual(["5 soles pan", "3 soles leche", "10 soles taxi"]);
  });
  it("no rompe montos compuestos ni frases de un solo gasto", () => {
    expect(sep("treinta y cinco soles almuerzo")).toEqual(["treinta y cinco soles almuerzo"]);
    expect(sep("dos mil quinientos soles alquiler")).toEqual(["dos mil quinientos soles alquiler"]);
    expect(sep("un sol veinte pasaje")).toEqual(["un sol veinte pasaje"]);
    expect(sep("compré 2 polos a 30 soles")).toEqual(["compré 2 polos a 30 soles"]);
    expect(sep("8 soles pan 2 panetones")).toEqual(["8 soles pan 2 panetones"]);
    expect(sep("pagué la cuota 8 del préstamo 500 soles")).toEqual(["pagué la cuota 8 del préstamo 500 soles"]);
    expect(sep("arroz y frejol 12 soles")).toEqual(["arroz y frejol 12 soles"]);
    expect(sep("45 soles pollo a la brasa")).toEqual(["45 soles pollo a la brasa"]);
  });
  it("la fecha del inicio vale para todos", () => {
    expect(separarMovimientos("ayer 5 soles pan y 3 soles leche", T)).toEqual({ frases: ["5 soles pan", "3 soles leche"], fecha: "2026-10-14" });
  });
});
