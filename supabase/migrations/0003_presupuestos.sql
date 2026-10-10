-- Fase 6: presupuestos mensuales por categoría (sobres digitales). No bloquean gastos.
create table if not exists public.fin_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 60),
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);
alter table public.fin_budgets enable row level security;
create policy "fin_budget_all_own" on public.fin_budgets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
