-- Fase 1: movimientos. Multiusuario desde el inicio (user_id + RLS).
create table if not exists public.fin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occurred_on date not null,
  occurred_time time,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'PEN',
  type text not null check (type in ('ingreso','egreso','ahorro','deuda')),
  nature text check (nature in ('necesidad','deseo','ahorro','deuda')),
  category text not null,
  subcategory text,
  concept text not null,
  account text,
  tags text[] not null default '{}',
  note text,
  source text not null default 'texto' check (source in ('texto','voz','manual')),
  confidence numeric(3,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_transactions_user_date_idx
  on public.fin_transactions (user_id, occurred_on desc);

create or replace function public.fin_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists fin_transactions_touch on public.fin_transactions;
create trigger fin_transactions_touch before update on public.fin_transactions
  for each row execute function public.fin_touch_updated_at();

alter table public.fin_transactions enable row level security;

create policy "fin_tx_select_own" on public.fin_transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "fin_tx_insert_own" on public.fin_transactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "fin_tx_update_own" on public.fin_transactions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "fin_tx_delete_own" on public.fin_transactions
  for delete to authenticated using (user_id = (select auth.uid()));
