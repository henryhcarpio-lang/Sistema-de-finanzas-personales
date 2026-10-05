import "server-only";
import { requireUser } from "./supabase/server";
import { rangoPeriodo, todayLima, type Rango } from "./dates";
import type { Compromiso, Pago } from "./compromisos";
import { estadoPresupuesto, type EstadoPresupuesto } from "./presupuestos";
import { CATEGORIAS, NATURALEZA_INICIAL, type Categoria, type Preferencia, type Transaction } from "./types";

const COLS =
  "id,occurred_on,occurred_time,amount,currency,type,nature,category,subcategory,concept,account,tags,note,source,confidence,created_at";

export async function listarMovimientos(opts: {
  rango?: Rango;
  category?: string;
  type?: string;
  nature?: string;
  tag?: string;
  min?: number;
  max?: number;
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
  if (opts.nature) query = query.eq("nature", opts.nature);
  if (opts.tag) query = query.contains("tags", [opts.tag]);
  if (opts.min !== undefined) query = query.gte("amount", opts.min);
  if (opts.max !== undefined) query = query.lte("amount", opts.max);
  if (opts.q) {
    // Busca en concepto y nota. Se quitan los caracteres con significado en el filtro .or() de PostgREST.
    const term = opts.q.replace(/[%_\\,().*"]/g, " ").trim();
    if (term) query = query.or(`concept.ilike.%${term}%,note.ilike.%${term}%`);
  }
  if (opts.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar los movimientos");
  return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[];
}

/** Etiquetas usadas por el usuario (para el filtro), de las más frecuentes a las menos. */
export async function listarEtiquetas(): Promise<string[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("fin_transactions").select("tags").neq("tags", "{}")
    .order("occurred_on", { ascending: false }).limit(2000);
  const cuenta = new Map<string, number>();
  for (const r of data ?? []) for (const t of r.tags as string[]) cuenta.set(t, (cuenta.get(t) ?? 0) + 1);
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
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

/** Categorías del usuario; la primera vez se crean las iniciales para que pueda editarlas. */
export async function listarCategorias(): Promise<Categoria[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("fin_categories").select("id,name,nature").order("name");
  if (error) throw new Error("No se pudieron cargar las categorías");
  if (data.length) return data as Categoria[];
  // Se usa lo que devuelve el upsert: repetir el mismo SELECT en este render
  // devolvería la respuesta vacía memorizada por Next.
  const { data: creadas } = await supabase
    .from("fin_categories")
    .upsert(
      CATEGORIAS.map((name) => ({ name, nature: NATURALEZA_INICIAL[name], user_id: user.id })),
      { onConflict: "user_id,name" },
    )
    .select("id,name,nature");
  return ((creadas ?? []) as Categoria[]).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function listarPreferencias(): Promise<Preferencia[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("fin_preferences")
    .select("keyword,type,nature,category,hits")
    .order("hits", { ascending: false })
    .limit(500);
  return (data ?? []) as Preferencia[];
}

export interface Presupuesto {
  id: string;
  category: string;
  monthly_limit: number;
}

export type PresupuestoConEstado = Presupuesto & { estado: EstadoPresupuesto };

/** Mes en curso (Lima): rango, día actual y días del mes. */
export function mesActual(today = todayLima()) {
  const rango = rangoPeriodo("mes", today);
  return { rango, dia: Number(today.slice(8, 10)), diasMes: Number(rango.to.slice(8, 10)) };
}

/** Presupuestos del usuario con lo gastado en el mes en curso, los más comprometidos primero. */
export async function listarPresupuestos(): Promise<PresupuestoConEstado[]> {
  const { supabase } = await requireUser();
  const { rango, dia, diasMes } = mesActual();
  const [{ data: budgets, error }, txs] = await Promise.all([
    supabase.from("fin_budgets").select("id,category,monthly_limit").order("category"),
    listarMovimientos({ rango }),
  ]);
  if (error) throw new Error("No se pudieron cargar los presupuestos");
  const gastado = new Map<string, number>();
  for (const t of txs) {
    if (t.type === "egreso" || t.type === "deuda") gastado.set(t.category, (gastado.get(t.category) ?? 0) + t.amount);
  }
  return (budgets ?? [])
    .map((b) => {
      const limite = Number(b.monthly_limit);
      return { ...b, monthly_limit: limite, estado: estadoPresupuesto(limite, gastado.get(b.category) ?? 0, dia, diasMes) };
    })
    .sort((a, b) => b.estado.porcentaje - a.estado.porcentaje);
}

/** Compromisos activos (deudas y recurrentes). */
export async function listarCompromisos(): Promise<Compromiso[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("fin_recurrents")
    .select("id,kind,name,creditor,category,amount,frequency,day_of_month,start_date,end_date,installments_total,initial_amount,interest_rate,installments_paid_before")
    .eq("active", true)
    .order("name");
  if (error) throw new Error("No se pudieron cargar los compromisos");
  return (data ?? []).map((c) => ({
    ...c,
    amount: Number(c.amount),
    initial_amount: c.initial_amount === null ? null : Number(c.initial_amount),
    interest_rate: c.interest_rate === null ? null : Number(c.interest_rate),
  })) as Compromiso[];
}

/** Pagos registrados (movimientos vinculados a una cuota). */
export async function listarPagos(): Promise<Pago[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("fin_transactions").select("id,recurrent_id,due_date,amount,occurred_on")
    .order("occurred_on", { ascending: false })
    .not("recurrent_id", "is", null).limit(5000);
  return (data ?? []).map((p) => ({ ...p, amount: Number(p.amount) })) as Pago[];
}
