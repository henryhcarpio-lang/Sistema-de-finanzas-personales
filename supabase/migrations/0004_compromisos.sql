-- Fase 7: deudas y pagos recurrentes. Las fechas de pago se calculan; solo un
-- pago real crea un movimiento (vinculado por recurrent_id + due_date).
create table if not exists public.fin_recurrents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('deuda','recurrente')),
  name text not null check (char_length(name) between 1 and 80),
  creditor text check (char_length(creditor) <= 80),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  frequency text not null check (frequency in ('semanal','mensual','anual')),
  -- mensual: día del mes (si el mes es más corto, el último día); semanal/anual: se usa start_date
  day_of_month smallint check (day_of_month between 1 and 31),
  start_date date not null,
  end_date date,
  installments_total integer check (installments_total > 0),
  initial_amount numeric(12,2) check (initial_amount > 0),
  interest_rate numeric(6,3) check (interest_rate >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (frequency <> 'mensual' or day_of_month is not null)
);
alter table public.fin_recurrents enable row level security;
create policy "fin_rec_all_own" on public.fin_recurrents for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.fin_transactions
  add column if not exists recurrent_id uuid references public.fin_recurrents(id) on delete set null,
  add column if not exists due_date date;
create unique index if not exists fin_transactions_pago_unico
  on public.fin_transactions (recurrent_id, due_date) where recurrent_id is not null;
