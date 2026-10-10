"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { soles, todayLima } from "@/lib/dates";
import { avisoTrasGasto, estadoPresupuesto } from "@/lib/presupuestos";
import { mesActual } from "@/lib/queries";
import { requireUser } from "@/lib/supabase/server";
import { claveConcepto } from "@/lib/parser";
import { FUENTES, NATURALEZAS, TIPOS, type Draft } from "@/lib/types";
import { ESQUEMA_IA, MAX_TEXTO_IA, instruccionesIA, respuestaABorradores, type ContextoIA } from "@/lib/ia";

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
  account: z.string().trim().max(40).nullable().optional(),
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
  const { data: aj } = await supabase.from("fin_settings").select("umbral_presupuesto").maybeSingle();
  const e = estadoPresupuesto(Number(b.monthly_limit), gastado, dia, diasMes, (aj?.umbral_presupuesto ?? 80) / 100);
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
  grupo: z.string().trim().min(1).max(40).nullable().optional(),
  icono: z.string().trim().min(1).max(30).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

export async function crearCategoria(input: z.input<typeof Categoria>): Promise<ActionResult> {
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

/**
 * Edita una categoría. Si cambia el nombre, se renombra también en movimientos,
 * presupuestos, compromisos y preferencias (función SQL transaccional).
 */
export async function actualizarCategoria(id: string, input: z.input<typeof Categoria>): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Id inválido" };
  const parsed = Categoria.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  try {
    const { supabase } = await requireUser();
    const { data: actual } = await supabase.from("fin_categories").select("name").eq("id", id).maybeSingle();
    if (!actual) return { ok: false, error: "Categoría no encontrada" };
    const { name, ...resto } = parsed.data;
    if (name !== actual.name) {
      const { error } = await supabase.rpc("fin_renombrar_categoria", { viejo: actual.name, nuevo: name });
      if (error) return { ok: false, error: error.code === "23505" ? "Ya tienes una categoría con ese nombre" : "No se pudo renombrar" };
    }
    const { error } = await supabase.from("fin_categories").update(resto).eq("id", id);
    if (error) return { ok: false, error: "No se pudo guardar" };
    revalidar();
    return { ok: true, id };
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
  installments_paid_before: z.number().int().min(0).max(1200).default(0),
}).refine((c) => c.frequency !== "mensual" || c.day_of_month !== null, { message: "Indica el día de pago" })
  .refine((c) => !c.installments_total || c.installments_paid_before < c.installments_total,
    { message: "La cuota actual no puede pasar del total de cuotas" });

export async function crearCompromiso(input: z.input<typeof CompromisoInput>): Promise<ActionResult> {
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

/** Edita un compromiso. Los pagos ya hechos siguen como movimientos. */
export async function actualizarCompromiso(id: string, input: z.input<typeof CompromisoInput>): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Id inválido" };
  const parsed = CompromisoInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("fin_recurrents").update(parsed.data).eq("id", id);
    if (error) return { ok: false, error: "No se pudo guardar" };
    revalidar();
    return { ok: true, id };
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

const AjustesInput = z.object({
  nombre: z.string().trim().max(40).nullable(),
  voz_idioma: z.enum(["es-PE", "es-MX", "es-ES", "es-CO", "es-AR", "es-US"]),
  voz_activa: z.boolean(),
  voz_motor: z.enum(["auto", "navegador", "whisper"]),
  usar_ia: z.boolean(),
  cuenta_defecto: z.string().trim().max(40).nullable(),
  tema: z.enum(["sistema", "claro", "oscuro"]),
  texto: z.enum(["normal", "grande", "muy-grande"]),
  resumen_inteligente: z.boolean(),
  dias_aviso: z.union([z.literal(3), z.literal(7), z.literal(14)]),
  umbral_presupuesto: z.union([z.literal(70), z.literal(80), z.literal(90)]),
}).partial();

/** Guarda uno o varios ajustes. Tema y tamaño de texto van también en cookie para el primer render. */
export async function guardarAjustes(input: z.input<typeof AjustesInput>): Promise<ActionResult> {
  const parsed = AjustesInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ajuste inválido" };
  try {
    const { supabase, user } = await requireUser();
    const datos = { ...parsed.data, nombre: parsed.data.nombre === "" ? null : parsed.data.nombre, cuenta_defecto: parsed.data.cuenta_defecto === "" ? null : parsed.data.cuenta_defecto };
    for (const k of Object.keys(datos) as (keyof typeof datos)[]) if (datos[k] === undefined) delete datos[k];
    const { error } = await supabase.from("fin_settings")
      .upsert({ ...datos, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return { ok: false, error: "No se pudo guardar" };
    const c = await cookies();
    const anio = 60 * 60 * 24 * 365;
    if (datos.tema) c.set("tema", datos.tema, { maxAge: anio, path: "/", sameSite: "lax" });
    if (datos.texto) c.set("texto", datos.texto, { maxAge: anio, path: "/", sameSite: "lax" });
    revalidar();
    return { ok: true, id: user.id };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}

/** Cambia la contraseña de la sesión actual. */
export async function cambiarContrasena(nueva: string): Promise<ActionResult> {
  if (typeof nueva !== "string" || nueva.length < 8 || nueva.length > 72) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres" };
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase.auth.updateUser({ password: nueva });
    if (error) return { ok: false, error: error.message.includes("different") ? "Debe ser distinta de la actual" : "No se pudo cambiar la contraseña" };
    return { ok: true, id: user.id };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}

/**
 * Borra todos los datos del usuario (movimientos, compromisos, presupuestos,
 * preferencias, categorías y ajustes). Exige escribir "BORRAR".
 */
export async function borrarMisDatos(confirmacion: string): Promise<ActionResult> {
  if (confirmacion !== "BORRAR") return { ok: false, error: "Escribe BORRAR para confirmar" };
  try {
    const { supabase, user } = await requireUser();
    for (const t of ["fin_transactions", "fin_recurrents", "fin_budgets", "fin_preferences", "fin_categories", "fin_settings"]) {
      const { error } = await supabase.from(t).delete().eq("user_id", user.id);
      if (error) return { ok: false, error: "No se pudo borrar todo; inténtalo de nuevo" };
    }
    revalidar();
    return { ok: true, id: user.id };
  } catch {
    return { ok: false, error: "Sesión expirada" };
  }
}

const LIMITE_IA_DIA = 200;

export type ResultadoIA =
  | { ok: true; drafts: Draft[] }
  | { ok: false; motivo: "sin-clave" | "desactivada" | "limite" | "error" | "vacio" };

/**
 * Interpreta una frase con Gemini (plan gratuito) cuando las reglas locales dudan.
 * La clave vive solo en el servidor. Ante cualquier fallo devuelve ok:false y la
 * app sigue con las reglas: la IA nunca bloquea el registro.
 */
export async function interpretarConIA(texto: string): Promise<ResultadoIA> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) return { ok: false, motivo: "sin-clave" };
  const frase = typeof texto === "string" ? texto.trim().slice(0, MAX_TEXTO_IA) : "";
  if (!frase) return { ok: false, motivo: "vacio" };
  try {
    const { supabase, user } = await requireUser();
    const hoy = todayLima();
    const { data: aj } = await supabase.from("fin_settings").select("usar_ia,ia_dia,ia_usos").maybeSingle();
    if (aj && aj.usar_ia === false) return { ok: false, motivo: "desactivada" };
    const usos = aj?.ia_dia === hoy ? aj.ia_usos : 0;
    if (usos >= LIMITE_IA_DIA) return { ok: false, motivo: "limite" };
    await supabase.from("fin_settings").upsert({ user_id: user.id, ia_dia: hoy, ia_usos: usos + 1 }, { onConflict: "user_id" });

    const [{ data: cats }, { data: prefs }] = await Promise.all([
      supabase.from("fin_categories").select("name,nature").order("name"),
      supabase.from("fin_preferences").select("keyword,category").order("hits", { ascending: false }).limit(40),
    ]);
    const ctx: ContextoIA = { hoy, categorias: (cats ?? []) as ContextoIA["categorias"], preferencias: prefs ?? [] };
    const modelo = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
    const base = process.env.GEMINI_API_URL ?? "https://generativelanguage.googleapis.com";
    const res = await fetch(`${base}/v1beta/models/${modelo}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruccionesIA(ctx) }] },
        contents: [{ role: "user", parts: [{ text: frase }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: ESQUEMA_IA },
      }),
    });
    if (!res.ok) return { ok: false, motivo: "error" };
    const cuerpo = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const salida = cuerpo.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const drafts = respuestaABorradores(JSON.parse(salida), ctx);
    return drafts.length ? { ok: true, drafts } : { ok: false, motivo: "vacio" };
  } catch {
    return { ok: false, motivo: "error" };
  }
}
