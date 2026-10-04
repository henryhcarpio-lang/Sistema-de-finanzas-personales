import { addDays } from "./dates";

export type Frecuencia = "semanal" | "mensual" | "anual";
export type TipoCompromiso = "deuda" | "recurrente";

export interface Compromiso {
  id: string;
  kind: TipoCompromiso;
  name: string;
  creditor: string | null;
  category: string;
  amount: number;
  frequency: Frecuencia;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  installments_total: number | null;
  initial_amount: number | null;
  interest_rate: number | null;
}

/** Pago real ya registrado: un movimiento vinculado a una cuota. */
export interface Pago {
  recurrent_id: string;
  due_date: string;
  amount: number;
}

export type EstadoCuota = "vencida" | "hoy" | "proxima" | "pagada";

export interface Cuota {
  compromiso: Compromiso;
  fecha: string;
  numero: number; // 1 = primera cuota desde start_date
  estado: EstadoCuota;
}

const ultimoDia = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Fecha de la cuota n (1, 2, …) o null si no existe. */
function fechaCuota(c: Compromiso, n: number): string | null {
  const [y0, m0, d0] = c.start_date.split("-").map(Number);
  let f: string;
  if (c.frequency === "semanal") {
    f = addDays(c.start_date, 7 * (n - 1));
  } else if (c.frequency === "anual") {
    const y = y0 + n - 1;
    f = iso(y, m0, Math.min(d0, ultimoDia(y, m0)));
  } else {
    // Mensual: la primera cuota es el primer "día de pago" en o después del inicio.
    const dia = c.day_of_month ?? d0;
    const primerMesOffset = Math.min(dia, ultimoDia(y0, m0)) >= d0 ? 0 : 1;
    const total = m0 - 1 + primerMesOffset + (n - 1);
    const y = y0 + Math.floor(total / 12);
    const m = (total % 12) + 1;
    f = iso(y, m, Math.min(dia, ultimoDia(y, m)));
  }
  if (c.installments_total && n > c.installments_total) return null;
  if (c.end_date && f > c.end_date) return null;
  return f;
}

/** Cuotas con fecha entre `desde` y `hasta` (incluidos), con su número de orden. */
export function ocurrencias(c: Compromiso, desde: string, hasta: string): { fecha: string; numero: number }[] {
  const out: { fecha: string; numero: number }[] = [];
  for (let n = 1; n < 5000; n++) {
    const f = fechaCuota(c, n);
    if (!f || f > hasta) break;
    if (f >= desde) out.push({ fecha: f, numero: n });
  }
  return out;
}

/** Cuántos días atrás se muestran cuotas impagas como vencidas. */
export const DIAS_VENCIDAS = 60;

/**
 * Calendario de pagos: cuotas impagas vencidas (hasta DIAS_VENCIDAS atrás) y
 * cuotas de los próximos `dias` días. Un compromiso no es un gasto: solo las
 * cuotas con un pago registrado figuran como "pagada".
 */
export function calendario(compromisos: Compromiso[], pagos: Pago[], today: string, dias = 30): Cuota[] {
  const pagadas = new Set(pagos.map((p) => `${p.recurrent_id}|${p.due_date}`));
  const cuotas: Cuota[] = [];
  for (const c of compromisos) {
    for (const o of ocurrencias(c, addDays(today, -DIAS_VENCIDAS), addDays(today, dias))) {
      const pagada = pagadas.has(`${c.id}|${o.fecha}`);
      const estado: EstadoCuota = pagada ? "pagada" : o.fecha < today ? "vencida" : o.fecha === today ? "hoy" : "proxima";
      if (estado === "pagada" && o.fecha < today) continue; // lo pagado del pasado ya no es pendiente
      cuotas.push({ compromiso: c, fecha: o.fecha, numero: o.numero, estado });
    }
  }
  return cuotas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.compromiso.name.localeCompare(b.compromiso.name));
}

/** Próxima cuota impaga de un compromiso a partir de hoy (o la vencida más antigua). */
export function proximaCuota(c: Compromiso, pagos: Pago[], today: string): Cuota | null {
  return calendario([c], pagos, today, 400).find((x) => x.estado !== "pagada") ?? null;
}

export interface ResumenDeuda {
  pagado: number;
  saldo: number | null; // null si no se indicó la deuda inicial
  cuotasPagadas: number;
  cuotasTotal: number | null;
  progreso: number | null; // 0..1
}

export function resumenDeuda(c: Compromiso, pagos: Pago[]): ResumenDeuda {
  const propios = pagos.filter((p) => p.recurrent_id === c.id);
  const pagado = Math.round(propios.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const saldo = c.initial_amount ? Math.max(Math.round((c.initial_amount - pagado) * 100) / 100, 0) : null;
  const progreso =
    c.initial_amount ? Math.min(pagado / c.initial_amount, 1)
    : c.installments_total ? Math.min(propios.length / c.installments_total, 1)
    : null;
  return { pagado, saldo, cuotasPagadas: propios.length, cuotasTotal: c.installments_total, progreso };
}

const FRASE_FRECUENCIA: Record<Frecuencia, string> = { semanal: "cada semana", mensual: "al mes", anual: "al año" };
export const fraseFrecuencia = (c: Pick<Compromiso, "frequency" | "day_of_month">) =>
  c.frequency === "mensual" && c.day_of_month ? `${FRASE_FRECUENCIA.mensual}, día ${c.day_of_month}` : FRASE_FRECUENCIA[c.frequency];
