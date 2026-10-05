import { addDays } from "./dates";
import type { Transaction } from "./types";

/**
 * Análisis automático del gasto. Todo es informativo: la app sugiere, el
 * usuario decide ("la IA asiste, no decide").
 */

const esGasto = (t: Transaction) => t.type === "egreso" || t.type === "deuda";
const r2 = (n: number) => Math.round(n * 100) / 100;
const mesDe = (iso: string) => iso.slice(0, 7);
const diasDelMes = (mes: string) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();

/** "2026-10" → ["2026-09", "2026-08", "2026-07"] */
export function mesesAnteriores(mes: string, n: number): string[] {
  let [y, m] = mes.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    m--; if (m === 0) { m = 12; y--; }
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}

/** Días mínimos de historial para dar recomendaciones con sentido. */
export const DIAS_MINIMOS = 21;

export interface Atipico { tx: Transaction; usual: number }
export interface Crecimiento { categoria: string; actual: number; promedio: number; pct: number }
export interface Sugerencia { categoria: string; monto: number; promedio: number }

export interface Analisis {
  suficiente: boolean;
  diasHistorial: number;
  mes: { gastado: number; ingresos: number; pctIngresos: number | null; mayor: { categoria: string; monto: number } | null };
  /** Gasto promedio de los meses anteriores hasta el mismo día del mes. */
  promedioAFecha: number | null;
  atipicos: Atipico[];
  crecen: Crecimiento[];
  deseos: { actual: number; anterior: number | null };
  sugerencias: Sugerencia[];
}

/**
 * @param txs movimientos de los últimos ~4 meses (incluido el actual)
 * @param conPresupuesto categorías que ya tienen presupuesto (no se sugieren)
 */
export function analizar(txs: Transaction[], today: string, conPresupuesto: string[] = []): Analisis {
  const mes = mesDe(today);
  const dia = Number(today.slice(8, 10));
  const previos = mesesAnteriores(mes, 3);
  const primera = txs.reduce<string | null>((m, t) => (!m || t.occurred_on < m ? t.occurred_on : m), null);
  const diasHistorial = primera
    ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${primera}T00:00:00Z`)) / 86400000) + 1
    : 0;
  const suficiente = diasHistorial >= DIAS_MINIMOS;

  const delMes = txs.filter((t) => mesDe(t.occurred_on) === mes && t.occurred_on <= today);
  const gastosMes = delMes.filter(esGasto);
  const gastado = r2(gastosMes.reduce((s, t) => s + t.amount, 0));
  const ingresos = r2(delMes.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0));
  const porCat = new Map<string, number>();
  for (const t of gastosMes) porCat.set(t.category, (porCat.get(t.category) ?? 0) + t.amount);
  const top = [...porCat.entries()].sort((a, b) => b[1] - a[1])[0];

  // Solo cuentan los meses anteriores en los que el usuario ya registraba.
  const mesesConDatos = previos.filter((m) => txs.some((t) => mesDe(t.occurred_on) === m));
  const hastaMismoDia = (t: Transaction, m: string) =>
    mesDe(t.occurred_on) === m && Number(t.occurred_on.slice(8, 10)) <= Math.min(dia, diasDelMes(m));

  const promedioAFecha = mesesConDatos.length
    ? r2(mesesConDatos.reduce((s, m) => s + txs.filter((t) => esGasto(t) && hastaMismoDia(t, m)).reduce((a, t) => a + t.amount, 0), 0) / mesesConDatos.length)
    : null;

  // Atípicos: muy por encima de lo habitual en su categoría (mediana + 2,5 × MAD robusto).
  const atipicos: Atipico[] = [];
  if (suficiente) {
    for (const t of gastosMes) {
      const historia = txs.filter((x) => esGasto(x) && x.category === t.category && x.id !== t.id && x.occurred_on < addDays(today, 1)).map((x) => x.amount);
      if (historia.length < 4) continue;
      const m = mediana(historia);
      const mad = mediana(historia.map((x) => Math.abs(x - m)));
      const umbral = m + 2.5 * Math.max(mad, 0.25 * m);
      if (t.amount > umbral && t.amount >= 2 * m && t.amount - m >= 10) atipicos.push({ tx: t, usual: r2(m) });
    }
    atipicos.sort((a, b) => b.tx.amount - b.usual - (a.tx.amount - a.usual));
    // Un solo aviso por categoría: el más llamativo.
    const vistas = new Set<string>();
    const unicos = atipicos.filter((x) => (vistas.has(x.tx.category) ? false : (vistas.add(x.tx.category), true)));
    atipicos.length = 0;
    atipicos.push(...unicos);
  }

  // Categorías que crecen: este mes a la fecha vs. promedio de meses anteriores a la misma fecha.
  const crecen: Crecimiento[] = [];
  if (suficiente && mesesConDatos.length) {
    for (const [categoria, actual] of porCat) {
      const promedio = mesesConDatos.reduce((s, m) =>
        s + txs.filter((t) => esGasto(t) && t.category === categoria && hastaMismoDia(t, m)).reduce((a, t) => a + t.amount, 0), 0) / mesesConDatos.length;
      // Si ya hay un gasto atípico en la categoría, ese aviso lo explica: no se repite.
      if (atipicos.some((x) => x.tx.category === categoria)) continue;
      if (promedio > 0 && actual >= promedio * 1.3 && actual - promedio >= 20) {
        crecen.push({ categoria, actual: r2(actual), promedio: r2(promedio), pct: Math.round(((actual - promedio) / promedio) * 100) });
      }
    }
    crecen.sort((a, b) => b.actual - b.promedio - (a.actual - a.promedio));
  }

  // Deseos: % del gasto del mes vs. meses anteriores.
  const pctDeseo = (xs: Transaction[]) => {
    const total = xs.reduce((s, t) => s + t.amount, 0);
    return total > 0 ? Math.round((xs.filter((t) => t.nature === "deseo").reduce((s, t) => s + t.amount, 0) / total) * 100) : null;
  };
  const gastosPrevios = txs.filter((t) => esGasto(t) && mesesConDatos.includes(mesDe(t.occurred_on)));

  // Presupuesto sugerido: promedio mensual de los meses completos con datos, redondeado hacia arriba a S/ 10.
  const sugerencias: Sugerencia[] = [];
  if (suficiente && mesesConDatos.length) {
    const categorias = new Set(gastosPrevios.map((t) => t.category));
    for (const categoria of categorias) {
      if (conPresupuesto.includes(categoria) || categoria === "Deudas") continue;
      const promedio = gastosPrevios.filter((t) => t.category === categoria).reduce((s, t) => s + t.amount, 0) / mesesConDatos.length;
      if (promedio >= 30) sugerencias.push({ categoria, promedio: r2(promedio), monto: Math.ceil(promedio / 10) * 10 });
    }
    sugerencias.sort((a, b) => b.promedio - a.promedio);
  }

  return {
    suficiente,
    diasHistorial,
    mes: {
      gastado, ingresos,
      pctIngresos: ingresos > 0 ? Math.round((gastado / ingresos) * 100) : null,
      mayor: top ? { categoria: top[0], monto: r2(top[1]) } : null,
    },
    promedioAFecha,
    atipicos: atipicos.slice(0, 2),
    crecen: crecen.slice(0, 2),
    deseos: { actual: pctDeseo(gastosMes) ?? 0, anterior: pctDeseo(gastosPrevios) },
    sugerencias: sugerencias.slice(0, 2),
  };
}
