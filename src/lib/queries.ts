import "server-only";
import { requireUser } from "./supabase/server";
import type { Rango } from "./dates";
import type { Transaction } from "./types";

const COLS =
  "id,occurred_on,occurred_time,amount,currency,type,nature,category,subcategory,concept,account,tags,note,source,confidence,created_at";

export async function listarMovimientos(opts: {
  rango?: Rango;
  category?: string;
  type?: string;
  q?: string;
  limit?: number;
}): Promise<Transaction[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("fin_transactions")
    .select(COLS)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts.rango) query = query.gte("occurred_on", opts.rango.from).lte("occurred_on", opts.rango.to);
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.type) query = query.eq("type", opts.type);
  if (opts.q) query = query.ilike("concept", `%${opts.q.replace(/[%_\\]/g, "\\$&")}%`);
  if (opts.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar los movimientos");
  return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[];
}

export async function obtenerMovimiento(id: string): Promise<Transaction | null> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("fin_transactions").select(COLS).eq("id", id).maybeSingle();
  return data ? ({ ...data, amount: Number(data.amount) } as Transaction) : null;
}

export function resumir(txs: Transaction[]) {
  const r = { ingresos: 0, gastos: 0, ahorro: 0, deuda: 0, necesidad: 0, deseo: 0 };
  const porCategoria = new Map<string, number>();
  for (const t of txs) {
    if (t.type === "ingreso") r.ingresos += t.amount;
    else if (t.type === "ahorro") r.ahorro += t.amount;
    else {
      r.gastos += t.amount;
      if (t.type === "deuda") r.deuda += t.amount;
      if (t.nature === "necesidad") r.necesidad += t.amount;
      if (t.nature === "deseo") r.deseo += t.amount;
      porCategoria.set(t.category, (porCategoria.get(t.category) ?? 0) + t.amount);
    }
  }
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
  return { ...r, balance: r.ingresos - r.gastos - r.ahorro, categorias };
}
