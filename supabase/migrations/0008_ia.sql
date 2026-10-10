-- Interpretación con IA (Gemini, plan gratuito): interruptor y límite diario por usuario.
alter table public.fin_settings
  add column if not exists usar_ia boolean not null default true,
  add column if not exists ia_dia date,
  add column if not exists ia_usos integer not null default 0 check (ia_usos >= 0);
