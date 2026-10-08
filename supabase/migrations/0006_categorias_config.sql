-- Categorías con grupo, icono y color; nuevas categorías iniciales; renombrar; ajustes.
alter table public.fin_categories
  add column if not exists grupo text check (char_length(grupo) <= 40),
  add column if not exists icono text check (char_length(icono) <= 30),
  add column if not exists color text check (color ~ '^#[0-9a-fA-F]{6}$');

-- Catálogo inicial: completa grupo/icono/color de las existentes y agrega las nuevas a cada usuario.
with catalogo(name, grupo, icono, color, nature) as (values
    ('Alimentación','Comida y bebida','apple','#16a34a','necesidad'),
    ('Supermercado','Comida y bebida','canasta','#10b981','necesidad'),
    ('Almuerzo / comida fuera','Comida y bebida','cubiertos','#d97706','necesidad'),
    ('Restaurantes','Comida y bebida','pizza','#ea580c','deseo'),
    ('Cuidado personal','Estilo de vida','destellos','#ec4899','necesidad'),
    ('Educación','Estilo de vida','birrete','#2563eb','necesidad'),
    ('Entretenimiento','Estilo de vida','control','#9333ea','deseo'),
    ('Ropa','Estilo de vida','polo','#e11d48','deseo'),
    ('Salud','Estilo de vida','estetoscopio','#dc2626','necesidad'),
    ('Compras','Estilo de vida','bolsa','#c026d3','deseo'),
    ('Hijos','Familia','bebe','#f59e0b','necesidad'),
    ('Mascotas','Familia','huella','#a16207','necesidad'),
    ('Regalos','Familia','regalo','#e11d48','deseo'),
    ('Vivienda','Hogar y servicios','casa','#8b5cf6','necesidad'),
    ('Servicios','Hogar y servicios','rayo','#3b82f6','necesidad'),
    ('Suscripciones','Hogar y servicios','repetir','#6366f1','deseo'),
    ('Transporte','Transporte','auto','#0ea5e9','necesidad'),
    ('Gasolina','Transporte','surtidor','#f97316','necesidad'),
    ('Deudas','Finanzas','tarjeta','#b91c1c','deuda'),
    ('Ahorro','Finanzas','alcancia','#16a34a','ahorro'),
    ('Trabajo','Finanzas','maletin','#0f766e','necesidad'),
    ('Otros','Otros','caja','#6b7280',null)
)
, upd as (
  update public.fin_categories c set grupo = k.grupo, icono = k.icono, color = k.color
  from catalogo k where c.name = k.name and c.grupo is null
  returning c.id
)
insert into public.fin_categories (user_id, name, grupo, icono, color, nature)
select u.user_id, k.name, k.grupo, k.icono, k.color, k.nature
from (select distinct user_id from public.fin_categories) u cross join catalogo k
on conflict (user_id, name) do nothing;

-- Renombrar una categoría en todas las tablas del usuario, en una sola transacción.
create or replace function public.fin_renombrar_categoria(viejo text, nuevo text)
returns void language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if char_length(trim(nuevo)) not between 1 and 60 then raise exception 'nombre inválido'; end if;
  update public.fin_categories set name = trim(nuevo) where user_id = uid and name = viejo;
  if not found then raise exception 'categoría no encontrada'; end if;
  update public.fin_transactions set category = trim(nuevo) where user_id = uid and category = viejo;
  update public.fin_budgets set category = trim(nuevo) where user_id = uid and category = viejo;
  update public.fin_recurrents set category = trim(nuevo) where user_id = uid and category = viejo;
  update public.fin_preferences set category = trim(nuevo) where user_id = uid and category = viejo;
end $$;
revoke execute on function public.fin_renombrar_categoria(text, text) from public, anon;
grant execute on function public.fin_renombrar_categoria(text, text) to authenticated;

-- Ajustes del usuario (una fila por usuario).
create table if not exists public.fin_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  nombre text check (char_length(nombre) <= 40),
  voz_idioma text not null default 'es-PE' check (voz_idioma in ('es-PE','es-MX','es-ES','es-CO','es-AR','es-US')),
  voz_activa boolean not null default true,
  cuenta_defecto text check (char_length(cuenta_defecto) <= 40),
  tema text not null default 'sistema' check (tema in ('sistema','claro','oscuro')),
  texto text not null default 'normal' check (texto in ('normal','grande','muy-grande')),
  resumen_inteligente boolean not null default true,
  dias_aviso smallint not null default 7 check (dias_aviso in (3,7,14)),
  umbral_presupuesto smallint not null default 80 check (umbral_presupuesto in (70,80,90)),
  updated_at timestamptz not null default now()
);
alter table public.fin_settings enable row level security;
create policy "fin_set_all_own" on public.fin_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
