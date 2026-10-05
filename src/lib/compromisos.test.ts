import { describe, expect, it } from "vitest";
import { calendario, ocurrencias, proximaCuota, resumenDeuda, type Compromiso } from "./compromisos";

const T = "2026-10-04";
const base = (o: Partial<Compromiso>): Compromiso => ({
  id: "c1", kind: "deuda", name: "Préstamo banco", creditor: "Banco", category: "Deudas", amount: 620,
  frequency: "mensual", day_of_month: 15, start_date: "2026-01-01", end_date: null,
  installments_total: null, initial_amount: null, interest_rate: null, ...o,
});

describe("ocurrencias", () => {
  it("mensual: el día de pago de cada mes", () => {
    expect(ocurrencias(base({}), "2026-09-01", "2026-11-30").map((o) => o.fecha)).toEqual(["2026-09-15", "2026-10-15", "2026-11-15"]);
  });
  it("mensual día 31: último día en meses cortos", () => {
    const c = base({ day_of_month: 31, start_date: "2026-01-31" });
    expect(ocurrencias(c, "2026-02-01", "2026-04-30").map((o) => o.fecha)).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("mensual: si el inicio es después del día de pago, empieza el mes siguiente", () => {
    const c = base({ start_date: "2026-03-20" });
    expect(ocurrencias(c, "2026-01-01", "2026-05-31")).toEqual([{ fecha: "2026-04-15", numero: 1 }, { fecha: "2026-05-15", numero: 2 }]);
  });
  it("semanal y anual", () => {
    expect(ocurrencias(base({ frequency: "semanal", start_date: "2026-09-21" }), "2026-09-28", "2026-10-12").map((o) => o.fecha))
      .toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(ocurrencias(base({ frequency: "anual", start_date: "2024-02-29" }), "2025-01-01", "2026-12-31").map((o) => o.fecha))
      .toEqual(["2025-02-28", "2026-02-28"]);
  });
  it("respeta el número de cuotas y la fecha de fin", () => {
    expect(ocurrencias(base({ installments_total: 3 }), "2026-01-01", "2026-12-31").map((o) => o.numero)).toEqual([1, 2, 3]);
    expect(ocurrencias(base({ end_date: "2026-03-01" }), "2026-01-01", "2026-12-31")).toHaveLength(2);
  });
});

describe("calendario", () => {
  const prestamo = base({ start_date: "2026-08-01", day_of_month: 1 });
  const netflix = base({ id: "c2", kind: "recurrente", name: "Netflix", amount: 45, day_of_month: 10, category: "Suscripciones" });
  it("vencidas impagas, hoy y próximas; lo pagado del pasado no aparece", () => {
    const pagos = [{ recurrent_id: "c1", due_date: "2026-08-01", amount: 620 }];
    const cal = calendario([prestamo, netflix], pagos, T, 30);
    expect(cal.map((c) => [c.compromiso.name, c.fecha, c.estado])).toEqual([
      ["Netflix", "2026-08-10", "vencida"],
      ["Préstamo banco", "2026-09-01", "vencida"],
      ["Netflix", "2026-09-10", "vencida"],
      ["Préstamo banco", "2026-10-01", "vencida"],
      ["Netflix", "2026-10-10", "proxima"],
      ["Préstamo banco", "2026-11-01", "proxima"],
    ]);
  });
  it("una cuota futura pagada por adelantado figura como pagada", () => {
    const cal = calendario([netflix], [{ recurrent_id: "c2", due_date: "2026-10-10", amount: 45 }], T, 10);
    expect(cal.find((c) => c.fecha === "2026-10-10")?.estado).toBe("pagada");
  });
  it("cuota de hoy", () => {
    expect(calendario([base({ day_of_month: 4, start_date: "2026-10-01" })], [], T, 0)[0].estado).toBe("hoy");
  });
});

describe("resumenDeuda y próxima cuota", () => {
  it("saldo, cuotas pagadas y progreso", () => {
    const c = base({ initial_amount: 6200, installments_total: 10 });
    const pagos = [{ recurrent_id: "c1", due_date: "2026-01-15", amount: 620 }, { recurrent_id: "c1", due_date: "2026-02-15", amount: 620 }, { recurrent_id: "otro", due_date: "2026-02-15", amount: 9 }];
    expect(resumenDeuda(c, pagos)).toEqual({ pagado: 1240, saldo: 4960, cuotasPagadas: 2, cuotasTotal: 10, progreso: 0.2 });
  });
  it("sin deuda inicial: progreso por cuotas", () => {
    expect(resumenDeuda(base({ installments_total: 4 }), [{ recurrent_id: "c1", due_date: "x", amount: 1 }]).progreso).toBe(0.25);
  });
  it("próxima cuota: la vencida más antigua si hay", () => {
    expect(proximaCuota(base({ start_date: "2026-09-01" }), [], T)).toMatchObject({ fecha: "2026-09-15", estado: "vencida" });
    expect(proximaCuota(base({ start_date: "2026-09-01" }), [{ recurrent_id: "c1", due_date: "2026-09-15", amount: 620 }], T)).toMatchObject({ fecha: "2026-10-15", estado: "proxima" });
  });
});

describe("cuotas pagadas antes de usar la app", () => {
  const p = base({ installments_total: 12, installments_paid_before: 7, start_date: "2026-10-01", amount: 100, initial_amount: 1200 });
  it("numera desde la cuota 8 y termina en la 12", () => {
    const o = ocurrencias(p, "2026-01-01", "2027-12-31");
    expect(o.map((x) => x.numero)).toEqual([8, 9, 10, 11, 12]);
    expect(o[0].fecha).toBe("2026-10-15");
  });
  it("el resumen cuenta las previas sin crear gastos", () => {
    expect(resumenDeuda(p, [{ recurrent_id: "c1", due_date: "2026-10-15", amount: 100 }]))
      .toEqual({ pagado: 800, saldo: 400, cuotasPagadas: 8, cuotasTotal: 12, progreso: 800 / 1200 });
  });
});
