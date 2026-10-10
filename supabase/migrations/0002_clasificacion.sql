-- Fase 2: categorías editables y preferencias aprendidas de las correcciones.
create table if not exists public.fin_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  nature text check (nature in ('necesidad','deseo','ahorro','deuda')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.fin_categories enable row level security;
create policy "fin_cat_all_own" on public.fin_categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- keyword: concepto normalizado (minúsculas, sin tildes), p. ej. "pasaje".
create table if not exists public.fin_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  keyword text not null check (char_length(keyword) between 1 and 80),
  type text not null check (type in ('ingreso','egreso','ahorro','deuda')),
  nature text check (nature in ('necesidad','deseo','ahorro','deuda')),
  category text not null,
  hits integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (user_id, keyword)
);
alter table public.fin_preferences enable row level security;
create policy "fin_pref_all_own" on public.fin_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
