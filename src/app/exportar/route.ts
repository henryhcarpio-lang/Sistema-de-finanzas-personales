import { requireUser } from "@/lib/supabase/server";
import { todayLima } from "@/lib/dates";

/** CSV con una celda segura: entre comillas y sin fórmulas (=, +, -, @) que Excel ejecutaría. */
const celda = (v: unknown) => {
  let s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

/** Descarga todos los movimientos del usuario en CSV (UTF-8 con BOM para que Excel respete las tildes). */
export async function GET() {
  let ctx;
  try { ctx = await requireUser(); } catch { return new Response("No autenticado", { status: 401 }); }
  const cols = ["occurred_on", "type", "amount", "currency", "category", "nature", "concept", "tags", "account", "note", "source"] as const;
  const titulos = ["Fecha", "Tipo", "Monto", "Moneda", "Categoría", "Naturaleza", "Concepto", "Etiquetas", "Cuenta", "Nota", "Fuente"];
  const filas: string[] = [titulos.map(celda).join(",")];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await ctx.supabase.from("fin_transactions").select(cols.join(","))
      .order("occurred_on", { ascending: false }).range(desde, desde + 999);
    if (error) return new Response("No se pudo exportar", { status: 500 });
    for (const r of (data ?? []) as unknown as Record<string, unknown>[]) filas.push(cols.map((c) => celda(r[c])).join(","));
    if (!data || data.length < 1000) break;
  }
  return new Response("﻿" + filas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="movimientos-${todayLima()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
