import { PERIODOS, rangoPeriodo, todayLima, type Periodo, type Rango } from "./dates";
import { NATURALEZAS, TIPOS, type Naturaleza, type Tipo, type Transaction } from "./types";

export const AGRUPACIONES = ["dia", "categoria", "etiqueta"] as const;
export type Agrupacion = (typeof AGRUPACIONES)[number];

export interface Filtros {
  p: Periodo;
  rango: Rango;
  cat?: string;
  tipo?: Tipo;
  nat?: Naturaleza;
  tag?: string;
  min?: number;
  max?: number;
  q?: string;
  agrupar: Agrupacion;
}

type Params = Record<string, string | string[] | undefined>;

const str = (v: string | string[] | undefined, max = 60) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
const monto = (v: string | string[] | undefined) => {
  const n = Number(str(v)?.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const fecha = (v: string | string[] | undefined) => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
};
const de = <T extends string>(lista: readonly T[], v: string | string[] | undefined) =>
  lista.includes(v as T) ? (v as T) : undefined;

/** Lee los filtros desde la URL; cualquier valor inválido se ignora. */
export function leerFiltros(sp: Params, today = todayLima(), def: Periodo = "mes"): Filtros {
  const p = de(PERIODOS.map((x) => x.v), sp.p) ?? def;
  let min = monto(sp.min);
  let max = monto(sp.max);
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  return {
    p,
    rango: rangoPeriodo(p, today, { from: fecha(sp.from), to: fecha(sp.to) }),
    cat: str(sp.cat),
    tipo: de(TIPOS, sp.tipo),
    nat: de(NATURALEZAS, sp.nat),
    tag: str(sp.tag, 40),
    min,
    max,
    q: str(sp.q),
    agrupar: de(AGRUPACIONES, sp.agrupar) ?? "dia",
  };
}

/** Filtros → query string (solo los valores presentes). `cambios` sobrescribe; `null` quita. */
export function aQuery(f: Filtros, cambios: Partial<Record<keyof Filtros, string | number | null>> = {}): string {
  const base: Record<string, string | number | undefined> = {
    p: f.p,
    from: f.p === "rango" ? f.rango.from : undefined,
    to: f.p === "rango" ? f.rango.to : undefined,
    cat: f.cat, tipo: f.tipo, nat: f.nat, tag: f.tag, min: f.min, max: f.max, q: f.q,
    agrupar: f.agrupar === "dia" ? undefined : f.agrupar,
  };
  for (const [k, v] of Object.entries(cambios)) base[k] = v ?? undefined;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v !== undefined && v !== "") qs.set(k, String(v));
  return qs.toString();
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Filtros activos (además del periodo), con su etiqueta legible, para mostrarlos como chips. */
export function filtrosActivos(f: Filtros): { clave: keyof Filtros; texto: string }[] {
  const out: { clave: keyof Filtros; texto: string }[] = [];
  if (f.q) out.push({ clave: "q", texto: `“${f.q}”` });
  if (f.cat) out.push({ clave: "cat", texto: f.cat });
  if (f.tipo) out.push({ clave: "tipo", texto: cap(f.tipo) });
  if (f.nat) out.push({ clave: "nat", texto: cap(f.nat) });
  if (f.tag) out.push({ clave: "tag", texto: `#${f.tag}` });
  if (f.min !== undefined) out.push({ clave: "min", texto: `≥ S/ ${f.min}` });
  if (f.max !== undefined) out.push({ clave: "max", texto: `≤ S/ ${f.max}` });
  return out;
}

/** Frase que responde la pregunta del usuario, p. ej. "Gastaste S/ 120.00 en Almuerzo este mes". */
export function fraseResumen(f: Filtros, r: { gastos: number; ingresos: number; ahorro: number }, fmt: (n: number) => string): string {
  const periodo = PERIODOS.find((x) => x.v === f.p)!.frase;
  const sobre = [f.cat, f.tag && `#${f.tag}`, f.q && `“${f.q}”`, f.nat && `${f.nat}s`].filter(Boolean).join(" · ");
  const en = sobre ? ` en ${sobre}` : "";
  if (f.tipo === "ingreso") return `Recibiste ${fmt(r.ingresos)}${en} ${periodo}.`;
  if (f.tipo === "ahorro") return `Ahorraste ${fmt(r.ahorro)}${en} ${periodo}.`;
  return `Gastaste ${fmt(r.gastos)}${en} ${periodo}.`;
}

export interface Grupo {
  clave: string;
  titulo: string;
  /** Neto con signo: ingresos suman, el resto resta. */
  total: number;
  items: Transaction[];
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function tituloDia(iso: string, today: string): string {
  if (iso === today) return "Hoy";
  const d = new Date(`${iso}T00:00:00Z`);
  const ayer = new Date(`${today}T00:00:00Z`);
  ayer.setUTCDate(ayer.getUTCDate() - 1);
  if (d.getTime() === ayer.getTime()) return "Ayer";
  return `${cap(DIAS[d.getUTCDay()])} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Agrupa movimientos ya ordenados por fecha descendente. Total neto: ingresos suman, lo demás resta. */
export function agrupar(txs: Transaction[], por: Agrupacion, today = todayLima()): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const t of txs) {
    const claves =
      por === "dia" ? [t.occurred_on]
      : por === "categoria" ? [t.category]
      : t.tags.length ? t.tags : ["(sin etiqueta)"];
    for (const clave of claves) {
      let g = mapa.get(clave);
      if (!g) {
        g = { clave, titulo: por === "dia" ? tituloDia(clave, today) : por === "etiqueta" && clave !== "(sin etiqueta)" ? `#${clave}` : clave, total: 0, items: [] };
        mapa.set(clave, g);
      }
      g.items.push(t);
      g.total += t.type === "ingreso" ? t.amount : -t.amount;
    }
  }
  const grupos = [...mapa.values()];
  // Por día: cronológico (ya viene ordenado). Por categoría/etiqueta: mayor movimiento primero.
  if (por !== "dia") grupos.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  return grupos;
}
