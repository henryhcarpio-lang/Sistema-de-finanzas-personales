-- Motor de dictado: automático (Web Speech y, si falla, Whisper local), navegador o Whisper local.
alter table public.fin_settings
  add column if not exists voz_motor text not null default 'auto' check (voz_motor in ('auto','navegador','whisper'));
