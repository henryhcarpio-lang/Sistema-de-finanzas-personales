import { describe, expect, it } from "vitest";
import { avisoTrasGasto, estadoPresupuesto } from "./presupuestos";

const fmt = (n: number) => `S/ ${n.toFixed(2)}`;

describe("estadoPresupuesto", () => {
  it("ok: lejos del límite y a buen ritmo", () => {
    expect(estadoPresupuesto(600, 100, 10, 30)).toEqual({ limite: 600, gastado: 100, disponible: 500, porcentaje: 17, proyectado: 300, nivel: "ok" });
  });
  it("riesgo: aún con margen, pero la proyección supera el límite", () => {
    expect(estadoPresupuesto(250, 150, 10, 30)).toMatchObject({ nivel: "riesgo", proyectado: 450, porcentaje: 60 });
  });
  it("atento desde el 80 %", () => {
    expect(estadoPresupuesto(200, 160, 25, 30).nivel).toBe("atento");
  });
  it("excedido desde el 100 %, con disponible negativo", () => {
    expect(estadoPresupuesto(200, 230, 20, 30)).toMatchObject({ nivel: "excedido", disponible: -30, porcentaje: 115 });
  });
  it("sin proyección los dos primeros días", () => {
    expect(estadoPresupuesto(250, 150, 2, 30)).toMatchObject({ proyectado: null, nivel: "ok" });
  });
});

describe("avisoTrasGasto", () => {
  it("mensajes según el nivel", () => {
    expect(avisoTrasGasto("Transporte", estadoPresupuesto(250, 100, 10, 30), fmt)).toBe("Te quedan S/ 150.00 de Transporte este mes.");
    expect(avisoTrasGasto("Transporte", estadoPresupuesto(250, 210, 10, 30), fmt)).toBe("Te quedan S/ 40.00 de Transporte este mes (84 % usado).");
    expect(avisoTrasGasto("Transporte", estadoPresupuesto(250, 270, 10, 30), fmt)).toBe("Superaste el presupuesto de Transporte por S/ 20.00 (108 %).");
  });
});
