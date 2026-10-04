export const TIPOS = ["ingreso", "egreso", "ahorro", "deuda"] as const;
export const NATURALEZAS = ["necesidad", "deseo", "ahorro", "deuda"] as const;
export const FUENTES = ["texto", "voz", "manual"] as const;
export const CATEGORIAS = [
  "Alimentación",
  "Almuerzo / comida fuera",
  "Supermercado",
  "Transporte",
  "Vivienda",
  "Servicios",
  "Salud",
  "Educación",
  "Entretenimiento",
  "Compras",
  "Suscripciones",
  "Trabajo",
  "Deudas",
  "Ahorro",
  "Otros",
] as const;

/** Naturaleza sugerida al crear las categorías iniciales de un usuario. */
export const NATURALEZA_INICIAL: Record<(typeof CATEGORIAS)[number], "necesidad" | "deseo" | "ahorro" | "deuda" | null> = {
  "Alimentación": "necesidad",
  "Almuerzo / comida fuera": "necesidad",
  "Supermercado": "necesidad",
  "Transporte": "necesidad",
  "Vivienda": "necesidad",
  "Servicios": "necesidad",
  "Salud": "necesidad",
  "Educación": "necesidad",
  "Entretenimiento": "deseo",
  "Compras": "deseo",
  "Suscripciones": "deseo",
  "Trabajo": "necesidad",
  "Deudas": "deuda",
  "Ahorro": "ahorro",
  "Otros": null,
};

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
}
