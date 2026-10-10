import { z } from "zod";
import { addDays } from "./dates";
import { NATURALEZAS, TIPOS, type Draft, type Naturaleza } from "./types";

/**
 * Interpretación con IA (Gemini, plan gratuito) de frases que las reglas no
 * entienden bien. Aquí solo lo puro: el prompt, el esquema de respuesta y la
 * validación. La IA asiste, no decide: el resultado siempre se confirma.
 */

export interface ContextoIA {
  hoy: string;
  categorias: { name: string; nature: Naturaleza | null }[];
  /** Correcciones aprendidas del usuario: concepto → categoría. */
  preferencias: { keyword: string; category: string }[];
}

export const MAX_TEXTO_IA = 300;

export function instruccionesIA(c: ContextoIA): string {
  const cats = c.categorias.map((x) => `- ${x.name}${x.nature ? ` (${x.nature})` : ""}`).join("\n");
  const prefs = c.preferencias.slice(0, 40).map((p) => `- "${p.keyword}" → ${p.category}`).join("\n");
  return `Eres el intérprete de una app peruana de finanzas personales. Recibes lo que el usuario dictó o escribió y devuelves los movimientos de dinero que describe.

Reglas:
- Moneda: soles peruanos (S/). "un sol veinte" = 1.20; "dos cincuenta" = 2.50; "medio sol" = 0.50; "luca" = 1; "lucas" = soles.
- Puede haber varios movimientos en una frase: devuelve uno por cada monto.
- La transcripción puede tener errores de dictado: corrige palabras evidentes ("pash" → "pasaje").
- type: "egreso" (gasto), "ingreso" (me pagaron, sueldo, depósito recibido), "ahorro" (separé/guardé dinero), "deuda" (pago de préstamo, tarjeta o cuota).
- nature: "necesidad", "deseo", "ahorro" o "deuda"; null solo para ingresos.
- category: EXACTAMENTE una de la lista; si ninguna encaja, "Otros".
- concept: 1 a 4 palabras, en español, con mayúscula inicial (p. ej. "Taxi", "Menú", "Regalo a mi hermana").
- date: YYYY-MM-DD. Hoy es ${c.hoy}. "ayer" = día anterior. Sin fecha → hoy. Nunca una fecha futura.
- confidence: 0 a 1, qué tan seguro estás de la categoría.
- Si no hay ningún monto de dinero, devuelve una lista vacía. No inventes montos.

Categorías del usuario:
${cats}
${prefs ? `\nPreferencias aprendidas (tienen prioridad):\n${prefs}\n` : ""}`;
}

/** Esquema de respuesta (subconjunto OpenAPI que acepta Gemini en responseSchema). */
export const ESQUEMA_IA = {
  type: "OBJECT",
  properties: {
    movimientos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          amount: { type: "NUMBER" },
          concept: { type: "STRING" },
          type: { type: "STRING", enum: [...TIPOS] },
          nature: { type: "STRING", enum: [...NATURALEZAS], nullable: true },
          category: { type: "STRING" },
          date: { type: "STRING" },
          confidence: { type: "NUMBER" },
        },
        required: ["amount", "concept", "type", "category", "date", "confidence"],
      },
    },
  },
  required: ["movimientos"],
} as const;

const Item = z.object({
  amount: z.number().positive().max(1e9),
  concept: z.string().trim().min(1).max(120),
  type: z.enum(TIPOS),
  nature: z.enum(NATURALEZAS).nullable().optional(),
  category: z.string().trim().min(1).max(60),
  date: z.iso.date().optional().catch(undefined),
  confidence: z.number().min(0).max(1).catch(0.6),
});
const Respuesta = z.object({ movimientos: z.array(z.unknown()).max(20) });

/**
 * Convierte la respuesta de la IA en borradores seguros: descarta ítems
 * inválidos, fuerza categorías existentes, sin fechas futuras ni muy antiguas.
 */
export function respuestaABorradores(json: unknown, c: ContextoIA): Draft[] {
  const r = Respuesta.safeParse(json);
  if (!r.success) return [];
  const nombres = new Map(c.categorias.map((x) => [x.name.toLowerCase(), x]));
  const out: Draft[] = [];
  for (const crudo of r.data.movimientos) {
    const p = Item.safeParse(crudo);
    if (!p.success) continue;
    const m = p.data;
    const cat = nombres.get(m.category.toLowerCase());
    const fecha = m.date && m.date <= c.hoy && m.date >= addDays(c.hoy, -366) ? m.date : c.hoy;
    const nature: Naturaleza | null = m.type === "ingreso" ? null
      : m.type === "ahorro" ? "ahorro" : m.type === "deuda" ? "deuda"
      : (m.nature ?? cat?.nature ?? "necesidad");
    const concept = m.concept.charAt(0).toUpperCase() + m.concept.slice(1);
    out.push({
      amount: Math.round(m.amount * 100) / 100,
      currency: "PEN",
      concept,
      type: m.type,
      nature,
      category: cat?.name ?? "Otros",
      tags: [],
      occurred_on: fecha,
      // Nunca "aprendido": la IA sugiere; se marca como revisable si dudó.
      confidence: Math.min(cat ? m.confidence : 0.4, 0.89),
      needsType: false,
    });
  }
  return out;
}

/** Las reglas locales bastan; la IA solo se consulta cuando dudan. */
export function conviene(regla: Draft | null, varios: number): boolean {
  if (varios > 1) return false;
  return !regla || regla.needsType || regla.confidence < 0.7;
}
