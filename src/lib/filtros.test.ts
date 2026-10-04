import { describe, expect, it } from "vitest";
import { agrupar, aQuery, filtrosActivos, fraseResumen, leerFiltros } from "./filtros";
import type { Transaction } from "./types";

const T = "2026-10-04";

describe("leerFiltros", () => {
  it("valores por defecto: mes, agrupado por día", () => {
    const f = leerFiltros({}, T);
    expect(f).toMatchObject({ p: "mes", agrupar: "dia", rango: { from: "2026-10-01", to: "2026-10-31" } });
  });
  it("últimos 30 días incluye hoy", () => {
    expect(leerFiltros({ p: "30d" }, T).rango).toEqual({ from: "2026-09-05", to: T });
  });
  it("ignora valores inválidos y ordena min/max", () => {
    const f = leerFiltros({ p: "x", tipo: "robo", nat: "deseo", min: "50", max: "10", from: "ayer" }, T);
    expect(f.p).toBe("mes");
    expect(f.tipo).toBeUndefined();
    expect(f.nat).toBe("deseo");
    expect([f.min, f.max]).toEqual([10, 50]);
  });
});

describe("aQuery y chips", () => {
  it("serializa solo lo presente y permite quitar un filtro", () => {
    const f = leerFiltros({ p: "semana", cat: "Transporte", min: "5" }, T);
    expect(aQuery(f)).toBe("p=semana&cat=Transporte&min=5");
    expect(aQuery(f, { cat: null })).toBe("p=semana&min=5");
    expect(filtrosActivos(f).map((c) => c.texto)).toEqual(["Transporte", "≥ S/ 5"]);
  });
  it("conserva las fechas del rango personalizado", () => {
    const f = leerFiltros({ p: "rango", from: "2026-09-01", to: "2026-09-15" }, T);
    expect(aQuery(f)).toBe("p=rango&from=2026-09-01&to=2026-09-15");
  });
});

describe("fraseResumen", () => {
  const fmt = (n: number) => `S/ ${n.toFixed(2)}`;
  const r = { gastos: 120, ingresos: 2500, ahorro: 300 };
  it("responde '¿cuánto gasté en almuerzos este mes?'", () => {
    const f = leerFiltros({ cat: "Almuerzo / comida fuera" }, T);
    expect(fraseResumen(f, r, fmt)).toBe("Gastaste S/ 120.00 en Almuerzo / comida fuera este mes.");
  });
  it("ingresos y ahorro", () => {
    expect(fraseResumen(leerFiltros({ tipo: "ingreso", p: "30d" }, T), r, fmt)).toBe("Recibiste S/ 2500.00 en los últimos 30 días.");
    expect(fraseResumen(leerFiltros({ tipo: "ahorro", p: "anio" }, T), r, fmt)).toBe("Ahorraste S/ 300.00 este año.");
  });
});

const tx = (o: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(), occurred_on: T, occurred_time: null, amount: 10, currency: "PEN", type: "egreso",
  nature: "necesidad", category: "Transporte", subcategory: null, concept: "x", account: null, tags: [], note: null,
  source: "texto", confidence: null, created_at: "", ...o,
});

describe("agrupar", () => {
  const txs = [
    tx({ amount: 18, tags: ["Taxi"] }),
    tx({ amount: 2500, type: "ingreso", category: "Trabajo", nature: null }),
    tx({ occurred_on: "2026-10-03", amount: 35, category: "Almuerzo / comida fuera" }),
    tx({ occurred_on: "2026-09-28", amount: 1, tags: ["Pasaje"] }),
  ];
  it("por día con títulos Hoy / Ayer / fecha y total neto", () => {
    const g = agrupar(txs, "dia", T);
    expect(g.map((x) => x.titulo)).toEqual(["Hoy", "Ayer", "Lunes 28/09"]);
    expect(g[0].total).toBe(2482);
  });
  it("por categoría, ordenado por importe", () => {
    expect(agrupar(txs, "categoria", T).map((x) => [x.titulo, x.total])).toEqual([
      ["Trabajo", 2500], ["Almuerzo / comida fuera", -35], ["Transporte", -19],
    ]);
  });
  it("por etiqueta, incluye los que no tienen", () => {
    expect(agrupar(txs, "etiqueta", T).map((x) => x.titulo)).toEqual(["(sin etiqueta)", "#Taxi", "#Pasaje"]);
  });
});
