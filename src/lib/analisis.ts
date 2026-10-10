import { addDays, type Rango } from "./dates";
import type { Transaction } from "./types";

/** Gasto = todo lo que sale y no es ahorro (egresos y pagos de deuda), igual que `resumir`. */
const esGasto = (t: Transaction) => t.type === "egreso" || t.type === "deuda";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export interface Punto {
  clave: string; // YYYY-MM-DD o YYYY-MM
  etiqueta: string; // corta, para el eje
  detalle: string; // larga, para el tooltip y la tabla
  total: number;
}

const diasEntre = (r: Rango) =>
  Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86400000) + 1;

/**
 * Serie de gasto del periodo, con todos los días (o meses, si el rango supera
 * 62 días) aunque no tengan movimientos, para que el eje sea continuo.
 */
export function serieGasto(txs: Transaction[], rango: Rango): { punto: "dia" | "mes"; datos: Punto[] } {
  const porMes = diasEntre(rango) > 62;
  const totales = new Map<string, number>();
  for (const t of txs) {
    if (!esGasto(t)) continue;
    const k = porMes ? t.occurred_on.slice(0, 7) : t.occurred_on;
    totales.set(k, (totales.get(k) ?? 0) + t.amount);
  }
  const datos: Punto[] = [];
  if (porMes) {
    let [y, m] = rango.from.slice(0, 7).split("-").map(Number);
    const fin = rango.to.slice(0, 7);
    for (;;) {
      const k = `${y}-${String(m).padStart(2, "0")}`;
      datos.push({ clave: k, etiqueta: MESES[m - 1], detalle: `${MESES[m - 1]} ${y}`, total: totales.get(k) ?? 0 });
      if (k >= fin) break;
      m++;
      if (m > 12) { m = 1; y++; }
    }
  } else {
    for (let d = rango.from; d <= rango.to; d = addDays(d, 1)) {
      const dia = Number(d.slice(8, 10));
      datos.push({ clave: d, etiqueta: String(dia), detalle: `${dia} ${MESES[Number(d.slice(5, 7)) - 1]}`, total: totales.get(d) ?? 0 });
    }
  }
  return { punto: porMes ? "mes" : "dia", datos };
}

/**
 * Proyección de gasto al cierre del mes al ritmo actual. Solo tiene sentido
 * para el mes en curso y a partir del 3.er día (antes es ruido).
 */
export function proyeccionMes(gastado: number, rango: Rango, today: string): { proyectado: number; dia: number; diasMes: number } | null {
  if (today < rango.from || today > rango.to || rango.from.slice(8) !== "01") return null;
  const diasMes = diasEntre(rango);
  const dia = Number(today.slice(8, 10));
  if (diasMes < 28 || dia < 3 || gastado <= 0) return null;
  return { proyectado: Math.round((gastado / dia) * diasMes * 100) / 100, dia, diasMes };
}

export interface ComparacionCategoria {
  categoria: string;
  actual: number;
  anterior: number;
  /** Variación en %; null si antes no había gasto. */
  delta: number | null;
}

/** Gasto por categoría frente al periodo anterior, ordenado por gasto actual. */
export function compararCategorias(actual: Transaction[], anterior: Transaction[], max = 6): ComparacionCategoria[] {
  const suma = (txs: Transaction[]) => {
    const m = new Map<string, number>();
    for (const t of txs) if (esGasto(t)) m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
    return m;
  };
  const a = suma(actual);
  const b = suma(anterior);
  return [...a.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, max)
    .map(([categoria, v]) => {
      const prev = b.get(categoria) ?? 0;
      return { categoria, actual: v, anterior: prev, delta: prev > 0 ? Math.round(((v - prev) / prev) * 100) : null };
    });
}

/** Valor "redondo" ≥ max para la línea de referencia del eje (1, 2, 5 × 10ⁿ). */
export function techoEje(max: number): number {
  if (max <= 0) return 0;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * p >= max) return f * p;
  return 10 * p;
}
