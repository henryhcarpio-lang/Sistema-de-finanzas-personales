"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { soles, todayLima } from "@/lib/dates";
import { avisoTrasGasto, estadoPresupuesto } from "@/lib/presupuestos";
import { mesActual } from "@/lib/queries";
import { requireUser } from "@/lib/supabase/server";
import { claveConcepto } from "@/lib/parser";
import { FUENTES, NATURALEZAS, TIPOS } from "@/lib/types";

const Movimiento = z.object({
  amount: z.number().positive().max(1e10),
  currency: z.literal("PEN"),
  concept: z.string().trim().min(1).max(120),
  type: z.enum(TIPOS),
  nature: z.enum(NATURALEZAS).nullable(),
  category: z.string().trim().min(1).max(60),
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
  occurred_on: z.iso.date(),
  note: z.string().trim().max(500).nullable().optional(),
  source: z.enum(FUENTES),
  confidence: z.number().min(0).max(1).nullable(),
});

export type MovimientoInput = z.infer<typeof Movimiento>;
export type ActionResult = { ok: true; id: string } | { ok: false; error: string };
/** Al crear un gasto se informa, si existe, el estado del presupuesto de su categoría. */
export type CrearResult = { ok: true; id: string; presupuesto?: { texto: string; nivel: string } } | { ok: false; error: string };

function revalidar() {
  revalidatePath("/", "layout");
}

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Estado del presupuesto mensual de la categoría tras registrar un gasto del mes en curso. */
async function avisoPresupuesto(supabase: Supa, m: MovimientoInput) {
  if (m.type !== "egreso" && m.type !== "deuda") return undefined;
  const { rango, dia, diasMes } = mesActual();
  if (m.occurred_on < rango.from || m.occurred_on > rango.to) return undefined;
  const { data: b } = await supabase
    .from("fin_budgets").select("monthly_limit").eq("category", m.category).maybeSingle();
  if (!b) return undefined;
  const { data: filas } = await supabase
    .from("fin_transactions").select("amount")
    .eq("category", m.category).in("type", ["egreso", "deuda"])
    .gte("occurred_on", rango.from).lte("occurred_on", rango.to);
  const gastado = (filas ?? []).reduce((s, f) => s + Number(f.amount), 0);
  const e = estadoPresupuesto(Number(b.monthly_limit), gastado, dia, diasMes);
  return { texto: avisoTrasGasto(m.category, e, soles), nivel: e.nivel };
}

/** Guarda la clasificación elegida por el usuario para usarla en futuras entradas. */
async function aprender(supabase: Supa, userId: string, m: MovimientoInput) {
  const keyword = claveConcepto(m.concept);
  if (!keyword) return;
  const { data: prev } = await supabase
    .from("fin_preferences").select("hits").eq("keyword", keyword).maybeSingle();
  await supabase.from("fin_preferences").upsert(
    {
      user_id: userId, keyword, type: m.type, nature: m.nature, category: m.category,
      hits: (prev?.hits ?? 0) + 1, updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,keyword" },
  );
}

/** `corregido`: el usuario cambió la clasificación propuesta; se aprende de ella. */
export async function crearMovimiento(input: MovimientoInput, corregido = false): Promise<CrearResult> {
  const parsed = Movimiento.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  try {
    const { supabase, user } = await requireUser();
    const occurred_time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(new Date());
    const { data, error } = await supabase
      .from("fin_transactions")
      .insert({ ...parsed.data, user_id: user.id, occurred_time })
      .select("id")
      .single();
    if (error) return { ok: false, error: "No se pudo guardar" };
    if (corregido) await aprender(supabase, user.id, parsed.data);
    const presupuesto = await avisoPresupuesto(supabase, parsed.data);
    revalidar();
    return { ok: true, id: data.id, presupuesto };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}

export async function actualizarMovimiento(id: string, input: MovimientoInput): Promise<ActionResult> {
  const parsed = Movimiento.safeParse(input);
  if (!z.uuid().safeParse(id).success || !parsed.success) return { ok: false, error: "Datos inválidos" };
  try {
    const { supabase, user } = await requireUser();
    // RLS garantiza que solo se edite un movimiento propio.
    const { data: antes } = await supabase
      .from("fin_transactions").select("type,nature,category").eq("id", id).maybeSingle();
    const { error } = await supabase.from("fin_transactions").update(parsed.data).eq("id", id);
    if (error) return { ok: false, error: "No se pudo actualizar" };
    const m = parsed.data;
    if (antes && (antes.type !== m.type || antes.nature !== m.nature || antes.category !== m.category)) {
      await aprender(supabase, user.id, m);
    }
    revalidar();
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}

export async function eliminarMovimiento(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Id inválido" };
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("fin_transactions").delete().eq("id", id);
    if (error) return { ok: false, error: "No se pudo eliminar" };
    revalidar();
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}

const Categoria = z.object({
  name: z.string().trim().min(1).max(60),
  nature: z.enum(NATURALEZAS).nullable(),
});

export async function crearCategoria(input: z.infer<typeof Categoria>): Promise<ActionResult> {
  const parsed = Categoria.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nombre inválido" };
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("fin_categories").insert({ ...parsed.data, user_id: user.id }).select("id").single();
    if (error) return { ok: false, error: error.code === "23505" ? "Esa categoría ya existe" : "No se pudo crear" };
    revalidar();
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}

/** Los movimientos conservan el nombre de la categoría aunque se elimine. */
export async function eliminarCategoria(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Id inválido" };
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("fin_categories").delete().eq("id", id);
    if (error) return { ok: false, error: "No se pudo eliminar" };
    revalidar();
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}

const Presupuesto = z.object({
  category: z.string().trim().min(1).max(60),
  monthly_limit: z.number().positive().max(1e9),
});

/** Crea o actualiza el presupuesto mensual de una categoría. */
export async function guardarPresupuesto(input: z.infer<typeof Presupuesto>): Promise<ActionResult> {
  const parsed = Presupuesto.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ingresa un monto válido" };
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("fin_budgets")
      .upsert({ ...parsed.data, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id,category" })
      .select("id").single();
    if (error) return { ok: false, error: "No se pudo guardar" };
    revalidar();
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}

export async function eliminarPresupuesto(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Id inválido" };
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("fin_budgets").delete().eq("id", id);
    if (error) return { ok: false, error: "No se pudo eliminar" };
    revalidar();
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}

const fechaIso = z.iso.date();
const CompromisoInput = z.object({
  kind: z.enum(["deuda", "recurrente"]),
  name: z.string().trim().min(1).max(80),
  creditor: z.string().trim().max(80).nullable(),
  category: z.string().trim().min(1).max(60),
  amount: z.number().positive().max(1e9),
  frequency: z.enum(["semanal", "mensual", "anual"]),
  day_of_month: z.number().int().min(1).max(31).nullable(),
  start_date: fechaIso,
  installments_total: z.number().int().positive().max(1200).nullable(),
  initial_amount: z.number().positive().max(1e10).nullable(),
  interest_rate: z.number().min(0).max(1000).nullable(),
}).refine((c) => c.frequency !== "mensual" || c.day_of_month !== null, { message: "Indica el día de pago" });

export async function crearCompromiso(input: z.infer<typeof CompromisoInput>): Promise<ActionResult> {
  const parsed = CompromisoInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("fin_recurrents").insert({ ...parsed.data, user_id: user.id }).select("id").single();
    if (error) return { ok: false, error: "No se pudo guardar" };
    revalidar();
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}

/** Elimina el compromiso; los pagos ya hechos se conservan como movimientos. */
export async function eliminarCompromiso(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Id inválido" };
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("fin_recurrents").delete().eq("id", id);
    if (error) return { ok: false, error: "No se pudo eliminar" };
    revalidar();
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}

/**
 * Registra el pago de una cuota: crea el movimiento real (fecha de hoy) vinculado
 * a la cuota. El índice único impide pagar dos veces la misma cuota.
 */
export async function pagarCuota(recurrentId: string, dueDate: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(recurrentId).success || !fechaIso.safeParse(dueDate).success) return { ok: false, error: "Datos inválidos" };
  try {
    const { supabase, user } = await requireUser();
    const { data: c } = await supabase
      .from("fin_recurrents").select("kind,name,category,amount").eq("id", recurrentId).maybeSingle();
    if (!c) return { ok: false, error: "Compromiso no encontrado" };
    const { data: cat } = await supabase.from("fin_categories").select("nature").eq("name", c.category).maybeSingle();
    const { data, error } = await supabase.from("fin_transactions").insert({
      user_id: user.id,
      occurred_on: todayLima(),
      amount: Number(c.amount),
      currency: "PEN",
      type: c.kind === "deuda" ? "deuda" : "egreso",
      nature: c.kind === "deuda" ? "deuda" : (cat?.nature ?? "necesidad"),
      category: c.category,
      concept: c.name,
      tags: [],
      source: "manual",
      confidence: null,
      recurrent_id: recurrentId,
      due_date: dueDate,
    }).select("id").single();
    if (error) return { ok: false, error: error.code === "23505" ? "Esta cuota ya está pagada" : "No se pudo registrar el pago" };
    revalidar();
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}
