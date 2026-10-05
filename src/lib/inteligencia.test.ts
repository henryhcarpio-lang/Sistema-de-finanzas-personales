import { describe, expect, it } from "vitest";
import { analizar, mesesAnteriores } from "./inteligencia";
import type { Transaction } from "./types";

const T = "2026-10-15";
let n = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: String(++n), occurred_on: T, occurred_time: null, amount: 10, currency: "PEN", type: "egreso",
  nature: "necesidad", category: "Transporte", subcategory: null, concept: "x", account: null, tags: [], note: null,
  source: "texto", confidence: null, created_at: "", ...o,
});

/** Historial típico: 3 meses previos con transporte ~S/ 100 a mitad de mes y salud ~S/ 40 al mes. */
function historial(): Transaction[] {
  const out: Transaction[] = [];
  for (const m of ["2026-07", "2026-08", "2026-09"]) {
    for (const d of ["03", "08", "12", "20"]) out.push(tx({ occurred_on: `${m}-${d}`, amount: 25, category: "Transporte" }));
    out.push(tx({ occurred_on: `${m}-10`, amount: 40, category: "Salud" }));
    out.push(tx({ occurred_on: `${m}-14`, amount: 30, category: "Almuerzo / comida fuera", nature: "deseo" }));
    out.push(tx({ occurred_on: `${m}-01`, amount: 3000, category: "Trabajo", type: "ingreso", nature: null }));
  }
  return out;
}

describe("mesesAnteriores", () => {
  it("cruza el año", () => expect(mesesAnteriores("2026-02", 3)).toEqual(["2026-01", "2025-12", "2025-11"]));
});

describe("analizar", () => {
  it("con poco historial no da recomendaciones", () => {
    const a = analizar([tx({ occurred_on: "2026-10-10", amount: 500 })], T);
    expect(a.suficiente).toBe(false);
    expect(a.atipicos).toEqual([]);
    expect(a.sugerencias).toEqual([]);
  });

  it("resumen del mes: gastado, % de ingresos y mayor categoría", () => {
    const a = analizar([...historial(),
      tx({ occurred_on: "2026-10-01", amount: 3000, category: "Trabajo", type: "ingreso", nature: null }),
      tx({ occurred_on: "2026-10-05", amount: 60, category: "Transporte" }),
      tx({ occurred_on: "2026-10-06", amount: 90, category: "Almuerzo / comida fuera", nature: "deseo" }),
    ], T);
    expect(a.mes).toEqual({ gastado: 150, ingresos: 3000, pctIngresos: 5, mayor: { categoria: "Almuerzo / comida fuera", monto: 90 } });
    // Hasta el día 15: 3 viajes (75) + salud (40) + almuerzo (30) = 145 por mes
    expect(a.promedioAFecha).toBe(145);
  });

  it("detecta un gasto atípico frente a lo habitual de su categoría", () => {
    const a = analizar([...historial(), tx({ id: "raro", occurred_on: "2026-10-09", amount: 180, category: "Salud" }), tx({ occurred_on: "2026-10-02", amount: 40, category: "Salud" })], T);
    expect(a.atipicos.map((x) => [x.tx.id, x.usual])).toEqual([["raro", 40]]);
  });

  it("no marca como atípico un gasto normal", () => {
    expect(analizar([...historial(), tx({ occurred_on: "2026-10-09", amount: 45, category: "Salud" })], T).atipicos).toEqual([]);
  });

  it("categorías que crecen, comparando a la misma fecha", () => {
    // Cuatro viajes normales (S/ 40, no atípicos) que suman más que lo usual a la fecha.
    const viajes = ["02", "05", "08", "11"].map((d) => tx({ occurred_on: `2026-10-${d}`, amount: 40, category: "Transporte" }));
    const a = analizar([...historial(), ...viajes], T);
    expect(a.atipicos).toEqual([]);
    // A la misma fecha (día 15) los meses previos llevaban 75 en transporte.
    expect(a.crecen).toEqual([{ categoria: "Transporte", actual: 160, promedio: 75, pct: 113 }]);
  });

  it("porcentaje de deseos: mes actual vs. anteriores", () => {
    const a = analizar([...historial(), tx({ occurred_on: "2026-10-05", amount: 50, nature: "deseo", category: "Entretenimiento" }), tx({ occurred_on: "2026-10-06", amount: 50 })], T);
    expect(a.deseos).toEqual({ actual: 50, anterior: 18 });
  });

  it("sugiere presupuestos para categorías sin presupuesto, redondeando hacia arriba", () => {
    const a = analizar(historial(), T, ["Salud"]);
    expect(a.sugerencias).toEqual([
      { categoria: "Transporte", promedio: 100, monto: 100 },
      { categoria: "Almuerzo / comida fuera", promedio: 30, monto: 30 },
    ]);
  });
});

describe("sin avisos repetidos", () => {
  it("un atípico por categoría, y la categoría no se repite como 'sube'", () => {
    const a = analizar([...historial(),
      tx({ id: "t1", occurred_on: "2026-10-01", amount: 90, category: "Transporte" }),
      tx({ id: "t2", occurred_on: "2026-10-02", amount: 95, category: "Transporte" })], T);
    expect(a.atipicos.map((x) => x.tx.id)).toEqual(["t2"]);
    expect(a.crecen.map((c) => c.categoria)).not.toContain("Transporte");
  });
});
