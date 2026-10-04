"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
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

export async function crearMovimiento(input: MovimientoInput): Promise<ActionResult> {
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
    const { supabase } = await requireUser();
    // RLS garantiza que solo se edite un movimiento propio.
    const { error } = await supabase.from("fin_transactions").update(parsed.data).eq("id", id);
    if (error) return { ok: false, error: "No se pudo actualizar" };
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
