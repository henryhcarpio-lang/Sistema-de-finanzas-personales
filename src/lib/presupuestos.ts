/** Umbral a partir del cual se avisa que el presupuesto se está acabando. */
export const UMBRAL_ATENCION = 0.8;

export type NivelPresupuesto = "ok" | "riesgo" | "atento" | "excedido";

export interface EstadoPresupuesto {
  limite: number;
  gastado: number;
  disponible: number; // negativo si se excedió
  porcentaje: number; // 0..∞, redondeado
  /** Gasto al cierre del mes al ritmo actual; null antes del día 3 (poco dato). */
  proyectado: number | null;
  nivel: NivelPresupuesto;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Estado de un sobre. Prioridad: excedido > atento (≥ umbral, 80 % por defecto) > riesgo (la
 * proyección supera el límite) > ok. Nunca bloquea: solo informa.
 */
export function estadoPresupuesto(limite: number, gastado: number, dia: number, diasMes: number, umbral = UMBRAL_ATENCION): EstadoPresupuesto {
  const ratio = limite > 0 ? gastado / limite : 0;
  const proyectado = dia >= 3 && gastado > 0 ? r2((gastado / dia) * diasMes) : null;
  const nivel: NivelPresupuesto =
    ratio >= 1 ? "excedido"
    : ratio >= umbral ? "atento"
    : proyectado !== null && proyectado > limite ? "riesgo"
    : "ok";
  return { limite, gastado: r2(gastado), disponible: r2(limite - gastado), porcentaje: Math.round(ratio * 100), proyectado, nivel };
}

/** Mensaje corto tras registrar un gasto en una categoría con presupuesto. */
export function avisoTrasGasto(categoria: string, e: EstadoPresupuesto, fmt: (n: number) => string): string {
  if (e.nivel === "excedido") return `Superaste el presupuesto de ${categoria} por ${fmt(-e.disponible)} (${e.porcentaje} %).`;
  if (e.nivel === "atento") return `Te quedan ${fmt(e.disponible)} de ${categoria} este mes (${e.porcentaje} % usado).`;
  return `Te quedan ${fmt(e.disponible)} de ${categoria} este mes.`;
}
