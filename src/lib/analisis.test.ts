import { describe, expect, it } from "vitest";
import { compararCategorias, proyeccionMes, serieGasto, techoEje } from "./analisis";
import type { Transaction } from "./types";

const tx = (o: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(), occurred_on: "2026-10-02", occurred_time: null, amount: 10, currency: "PEN", type: "egreso",
  nature: "necesidad", category: "Transporte", subcategory: null, concept: "x", account: null, tags: [], note: null,
  source: "texto", confidence: null, created_at: "", ...o,
});

describe("serieGasto", () => {
  const txs = [
    tx({ occurred_on: "2026-10-02", amount: 18 }),
    tx({ occurred_on: "2026-10-02", amount: 2, type: "deuda" }),
    tx({ occurred_on: "2026-10-02", amount: 2500, type: "ingreso" }),
    tx({ occurred_on: "2026-10-04", amount: 300, type: "ahorro" }),
  ];
  it("un punto por día, con días vacíos, solo gastos", () => {
    const s = serieGasto(txs, { from: "2026-10-01", to: "2026-10-07" });
    expect(s.punto).toBe("dia");
    expect(s.datos.map((d) => d.total)).toEqual([0, 20, 0, 0, 0, 0, 0]);
    expect(s.datos[1]).toMatchObject({ etiqueta: "2", detalle: "2 oct" });
  });
  it("por mes cuando el rango supera 62 días", () => {
    const s = serieGasto([tx({ occurred_on: "2026-03-15", amount: 40 })], { from: "2026-01-01", to: "2026-12-31" });
    expect(s.punto).toBe("mes");
    expect(s.datos).toHaveLength(12);
    expect(s.datos[2]).toMatchObject({ etiqueta: "mar", total: 40 });
  });
});

describe("proyeccionMes", () => {
  const oct = { from: "2026-10-01", to: "2026-10-31" };
  it("extrapola al ritmo diario", () => {
    expect(proyeccionMes(100, oct, "2026-10-10")).toEqual({ proyectado: 310, dia: 10, diasMes: 31 });
  });
  it("no proyecta antes del día 3, fuera del mes ni en otros periodos", () => {
    expect(proyeccionMes(100, oct, "2026-10-02")).toBeNull();
    expect(proyeccionMes(100, oct, "2026-11-05")).toBeNull();
    expect(proyeccionMes(100, { from: "2026-09-28", to: "2026-10-04" }, "2026-10-04")).toBeNull();
  });
});

describe("compararCategorias", () => {
  it("variación por categoría frente al periodo anterior", () => {
    const r = compararCategorias(
      [tx({ amount: 60 }), tx({ amount: 30, category: "Salud" })],
      [tx({ amount: 50 })],
    );
    expect(r).toEqual([
      { categoria: "Transporte", actual: 60, anterior: 50, delta: 20 },
      { categoria: "Salud", actual: 30, anterior: 0, delta: null },
    ]);
  });
});

describe("techoEje", () => {
  it.each([[0, 0], [7, 10], [18, 20], [230, 250], [480, 500], [2100, 2500]])("%d → %d", (a, b) => {
    expect(techoEje(a)).toBe(b);
  });
});
