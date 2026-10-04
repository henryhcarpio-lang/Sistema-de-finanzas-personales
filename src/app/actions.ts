"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

function revalidar() {
  revalidatePath("/", "layout");
}

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

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
export async function crearMovimiento(input: MovimientoInput, corregido = false): Promise<ActionResult> {
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
    revalidar();
    return { ok: true, id: data.id };
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
