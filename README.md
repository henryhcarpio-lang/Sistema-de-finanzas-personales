# Sistema de Finanzas Personales

App web mobile-first para registrar movimientos en ~5 segundos: **escribir → interpretar → confirmar → registrar**.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Auth + Postgres con RLS) · Vercel.

## Estado: Fase 2 (clasificación inteligente) — Fase 1 completada

- Registro por texto en lenguaje natural ("un sol pasaje", "me depositaron 2,500 soles") con tarjeta **Confirmar | Editar**.
- Clasificación inicial por reglas (tipo, categoría, naturaleza, etiquetas, confianza). Las frases ambiguas ("Banco 500") piden el tipo.
- Registro manual, edición y eliminación con confirmación.
- Historial con filtros por periodo, categoría, tipo y búsqueda, con totales.
- Dashboard: ingresos, gastos, balance, ahorro, necesidades/deseos/deudas, gasto por categoría y comparación con el periodo anterior.
- Autenticación por correo y contraseña; los datos de cada usuario están aislados con RLS.
- **Fase 2:** categorías editables por usuario (pantalla *Categorías*), con naturaleza por defecto.
- **Fase 2:** preferencias aprendidas: si corriges tipo, categoría o naturaleza (al registrar o al editar), la app lo recuerda para ese concepto y lo usa con prioridad sobre las reglas. La tarjeta de confirmación indica la confianza.

## Configuración

Proyecto Supabase: `finanzas-personales` (ref `gjcwiwmqgqlhuquyieia`, región sa-east-1). Las migraciones de `supabase/migrations/` (0001 y 0002) ya están aplicadas.

1. Copia `.env.example` a `.env.local`; ya incluye la URL y la clave publicable del proyecto:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (anon/publishable). **Nunca** la service role key. |

2. `npm install && npm run dev`
3. En Vercel, configura las mismas dos variables.

Nota: Supabase pide confirmar el correo al crear una cuenta (Auth → Providers → Email → "Confirm email").

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test`

## Deuda técnica / siguientes fases

- Renombrar una categoría todavía no está soportado (crear + eliminar). Los movimientos guardan el nombre de la categoría como texto.
- Las etiquetas aún no se aprenden de las correcciones.
- Fase 3: voz (micrófono + transcripción).
- Cuentas y deudas solo existen como campo/tipo; sus tablas llegan en fases posteriores.
- El dashboard agrega en el servidor sobre las filas del periodo; si el volumen crece, conviene moverlo a vistas o RPC en SQL.
