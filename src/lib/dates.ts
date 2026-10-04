const TZ = "America/Lima";

/** Fecha de hoy (YYYY-MM-DD) en hora de Lima. */
export function todayLima(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function fmt(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parts(iso);
  return fmt(y, m, d + n);
}

export type Periodo = "hoy" | "semana" | "mes" | "30d" | "anio" | "rango";

export const PERIODOS: { v: Periodo; l: string; frase: string }[] = [
  { v: "hoy", l: "Hoy", frase: "hoy" },
  { v: "semana", l: "Semana", frase: "esta semana" },
  { v: "mes", l: "Mes", frase: "este mes" },
  { v: "30d", l: "30 días", frase: "en los últimos 30 días" },
  { v: "anio", l: "Año", frase: "este año" },
  { v: "rango", l: "Rango", frase: "en el rango elegido" },
];

export interface Rango {
  from: string;
  to: string; // inclusive
}

/** Semana lunes–domingo que contiene `today`. */
export function rangoPeriodo(
  periodo: Periodo,
  today: string,
  custom?: { from?: string; to?: string },
): Rango {
  const { y, m } = parts(today);
  switch (periodo) {
    case "hoy":
      return { from: today, to: today };
    case "semana": {
      const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // lunes=0
      const from = addDays(today, -dow);
      return { from, to: addDays(from, 6) };
    }
    case "mes":
      return { from: fmt(y, m, 1), to: fmt(y, m + 1, 0) };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "anio":
      return { from: fmt(y, 1, 1), to: fmt(y, 12, 31) };
    case "rango": {
      const from = custom?.from || today;
      const to = custom?.to || today;
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

export function periodoAnterior(r: Rango): Rango {
  const days =
    Math.round(
      (Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86400000,
    ) + 1;
  return { from: addDays(r.from, -days), to: addDays(r.from, -1) };
}

export const soles = (n: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    currencyDisplay: "narrowSymbol",
  }).format(n);
