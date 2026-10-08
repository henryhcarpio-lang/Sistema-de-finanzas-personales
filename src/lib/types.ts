export const TIPOS = ["ingreso", "egreso", "ahorro", "deuda"] as const;
export const NATURALEZAS = ["necesidad", "deseo", "ahorro", "deuda"] as const;
export const FUENTES = ["texto", "voz", "manual"] as const;
type Nat = "necesidad" | "deseo" | "ahorro" | "deuda" | null;

/** Grupos de categorías, en el orden en que se muestran, con su color. */
export const GRUPOS = [
  { nombre: "Comida y bebida", color: "#d97706" },
  { nombre: "Estilo de vida", color: "#db2777" },
  { nombre: "Familia", color: "#f59e0b" },
  { nombre: "Hogar y servicios", color: "#3b82f6" },
  { nombre: "Transporte", color: "#0ea5e9" },
  { nombre: "Finanzas", color: "#16a34a" },
  { nombre: "Otros", color: "#6b7280" },
] as const;
export type Grupo = (typeof GRUPOS)[number]["nombre"];

/** Categorías iniciales: [nombre, grupo, icono, color, naturaleza]. */
export const CATALOGO: [string, Grupo, string, string, Nat][] = [
  ["Alimentación", "Comida y bebida", "apple", "#16a34a", "necesidad"],
  ["Supermercado", "Comida y bebida", "canasta", "#10b981", "necesidad"],
  ["Almuerzo / comida fuera", "Comida y bebida", "cubiertos", "#d97706", "necesidad"],
  ["Restaurantes", "Comida y bebida", "pizza", "#ea580c", "deseo"],
  ["Cuidado personal", "Estilo de vida", "destellos", "#ec4899", "necesidad"],
  ["Educación", "Estilo de vida", "birrete", "#2563eb", "necesidad"],
  ["Entretenimiento", "Estilo de vida", "control", "#9333ea", "deseo"],
  ["Ropa", "Estilo de vida", "polo", "#e11d48", "deseo"],
  ["Salud", "Estilo de vida", "estetoscopio", "#dc2626", "necesidad"],
  ["Compras", "Estilo de vida", "bolsa", "#c026d3", "deseo"],
  ["Hijos", "Familia", "bebe", "#f59e0b", "necesidad"],
  ["Mascotas", "Familia", "huella", "#a16207", "necesidad"],
  ["Regalos", "Familia", "regalo", "#e11d48", "deseo"],
  ["Vivienda", "Hogar y servicios", "casa", "#8b5cf6", "necesidad"],
  ["Servicios", "Hogar y servicios", "rayo", "#3b82f6", "necesidad"],
  ["Suscripciones", "Hogar y servicios", "repetir", "#6366f1", "deseo"],
  ["Transporte", "Transporte", "auto", "#0ea5e9", "necesidad"],
  ["Gasolina", "Transporte", "surtidor", "#f97316", "necesidad"],
  ["Deudas", "Finanzas", "tarjeta", "#b91c1c", "deuda"],
  ["Ahorro", "Finanzas", "alcancia", "#16a34a", "ahorro"],
  ["Trabajo", "Finanzas", "maletin", "#0f766e", "necesidad"],
  ["Otros", "Otros", "caja", "#6b7280", null],
];

export const CATEGORIAS = CATALOGO.map((c) => c[0]);

export type Tipo = (typeof TIPOS)[number];
export type Naturaleza = (typeof NATURALEZAS)[number];
export type Fuente = (typeof FUENTES)[number];

export interface Draft {
  amount: number;
  currency: "PEN";
  concept: string;
  type: Tipo;
  nature: Naturaleza | null;
  category: string;
  tags: string[];
  occurred_on: string; // YYYY-MM-DD
  confidence: number; // 0..1
  /** true cuando el tipo es ambiguo y el usuario debe elegirlo */
  needsType: boolean;
}

export interface Transaction {
  id: string;
  occurred_on: string;
  occurred_time: string | null;
  amount: number;
  currency: string;
  type: Tipo;
  nature: Naturaleza | null;
  category: string;
  subcategory: string | null;
  concept: string;
  account: string | null;
  tags: string[];
  note: string | null;
  source: Fuente;
  confidence: number | null;
  created_at: string;
}

export interface Preferencia {
  keyword: string;
  type: Tipo;
  nature: Naturaleza | null;
  category: string;
  hits: number;
}

export interface Categoria {
  id: string;
  name: string;
  nature: Naturaleza | null;
  grupo: string | null;
  icono: string | null;
  color: string | null;
}
