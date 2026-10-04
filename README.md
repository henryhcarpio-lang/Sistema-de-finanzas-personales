# Sistema de Finanzas Personales

App web mobile-first para registrar movimientos en ~5 segundos: **escribir → interpretar → confirmar → registrar**.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Auth + Postgres con RLS) · Vercel.

## Estado: Fase 1 (núcleo funcional)

- Registro por texto en lenguaje natural ("un sol pasaje", "me depositaron 2,500 soles") con tarjeta **Confirmar | Editar**.
- Clasificación inicial por reglas (tipo, categoría, naturaleza, etiquetas, confianza). Las frases ambiguas ("Banco 500") piden el tipo.
- Registro manual, edición y eliminación con confirmación.
- Historial con filtros por periodo, categoría, tipo y búsqueda, con totales.
- Dashboard: ingresos, gastos, balance, ahorro, necesidades/deseos/deudas, gasto por categoría y comparación con el periodo anterior.
- Autenticación por correo y contraseña; los datos de cada usuario están aislados con RLS.

## Configuración

1. Aplica `supabase/migrations/0001_movimientos.sql` en tu proyecto Supabase (SQL Editor o `supabase db push`).
2. Copia `.env.example` a `.env.local` y completa:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (anon/publishable). **Nunca** la service role key. |

3. `npm install && npm run dev`

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test`

## Deuda técnica / siguientes fases

- Fase 2: categorías editables en la base de datos y preferencias aprendidas de las correcciones.
- Fase 3: voz (micrófono + transcripción).
- Cuentas y deudas solo existen como campo/tipo; sus tablas llegan en fases posteriores.
- El dashboard agrega en el servidor sobre las filas del periodo; si el volumen crece, conviene moverlo a vistas o RPC en SQL.
