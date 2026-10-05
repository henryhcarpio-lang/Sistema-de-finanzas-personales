-- Cuotas ya pagadas antes de registrar el compromiso en la app (no generan movimientos).
alter table public.fin_recurrents
  add column if not exists installments_paid_before integer not null default 0
  check (installments_paid_before >= 0);
