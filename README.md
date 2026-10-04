# Sistema de Finanzas Personales

App web mobile-first para registrar movimientos en ~5 segundos: **hablar o escribir → interpretar → confirmar → registrar**.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Auth + Postgres con RLS) · Vercel.

## Estado: Fases 1 a 7 completadas

- Registro por texto en lenguaje natural ("un sol pasaje", "me depositaron 2,500 soles") con tarjeta **Confirmar | Editar**.
- Clasificación inicial por reglas (tipo, categoría, naturaleza, etiquetas, confianza). Las frases ambiguas ("Banco 500") piden el tipo.
- Registro manual, edición y eliminación con confirmación.
- Historial con filtros por periodo, categoría, tipo y búsqueda, con totales.
- **Fase 4:** filtros por naturaleza, etiqueta y rango de monto; periodo "Últimos 30 días"; búsqueda en concepto y nota; agrupación por día, categoría o etiqueta con subtotales; frase de respuesta ("Gastaste S/ 60.00 en Almuerzo este mes"); filtros activos como chips; las categorías del dashboard abren su historial. Los filtros viven en la URL (se pueden guardar o compartir).
- Dashboard: ingresos, gastos, balance, ahorro, necesidades/deseos/deudas, gasto por categoría y comparación con el periodo anterior.
- Autenticación por correo y contraseña; los datos de cada usuario están aislados con RLS.
- **Fase 5:** dashboard avanzado: gráfico de gasto por día (por mes en el periodo Año) con tooltip, foco con teclado y vista de tabla; reparto necesidades / deseos / deudas; proyección del gasto al cierre del mes; variación por categoría y total frente al periodo anterior.
- **Fase 6:** presupuestos mensuales por categoría (sobres): gastado, disponible, % usado y proyección; estados *en orden*, *en riesgo* (la proyección supera el límite), *cerca del límite* (≥ 80 %) y *excedido*, siempre con icono y texto. Al registrar un gasto con presupuesto, la app dice cuánto queda. Nunca bloquea un gasto.
- **Fase 7:** deudas y pagos recurrentes (pestaña *Pagos*). Cuotas mensuales, semanales o anuales calculadas a partir de cada compromiso; vencidas, de hoy y próximas; botón **Pagar** que crea el movimiento real vinculado a la cuota (una cuota futura nunca cuenta como gasto, y no se puede pagar dos veces). Deudas con saldo, cuotas pagadas/total, acreedor y tasa. El dashboard muestra los próximos compromisos de 7 días.
- **Fechas en la frase:** "ayer 18 soles taxi", "anteayer…", "hace 3 días…", "el lunes…", "el 3 de octubre…", "el día 10…". La tarjeta muestra la fecha detectada.
- **Instalable:** manifiesto e iconos para "Agregar a la pantalla de inicio" (Android e iPhone).
- **Fase 2:** categorías editables por usuario (pantalla *Categorías*), con naturaleza por defecto.
- **Fase 2:** preferencias aprendidas: si corriges tipo, categoría o naturaleza (al registrar o al editar), la app lo recuerda para ese concepto y lo usa con prioridad sobre las reglas. La tarjeta de confirmación indica la confianza.
- **Fase 3:** registro por voz. Botón de micrófono con estados *escuchando* (transcripción en vivo), *procesando*, tarjeta de confirmación y *error*. Termina solo tras una pausa (o con *Terminar*, máximo 10 s). Entiende números dictados ("treinta y cinco soles", "dos mil quinientos", "dieciocho soles con cincuenta"). Los movimientos se guardan con fuente `voz`.

## Uso diario

1. Abre https://finanzas-personales-pun8.vercel.app en el celular y, en el menú del navegador, elige **"Agregar a la pantalla de inicio"**: queda como una app.
2. **Registrar:** toca el micrófono y di "dieciocho soles taxi", o escríbelo. ¿Te olvidaste ayer? Di "ayer dieciocho soles taxi". Revisa la tarjeta y pulsa **Confirmar**.
3. Si la categoría no es la correcta, pulsa **Editar** y corrígela: la próxima vez la app lo recordará.
4. **Dashboard:** cómo vas en el mes, proyección de cierre y en qué estás gastando (toca una categoría para ver su detalle).
5. **Movimientos:** busca, filtra y agrupa para responder "¿cuánto gasté en…?".
6. **Presupuestos:** define un límite mensual para tus categorías principales; la app te avisa al acercarte.
7. **Pagos:** registra una vez tus préstamos, tarjetas y pagos fijos; cuando pagues una cuota, pulsa **Pagar** y queda registrada como gasto.

## Producción

- URL: https://finanzas-personales-pun8.vercel.app (proyecto Vercel `finanzas-personales`, funciones en `gru1`, São Paulo, junto a Supabase).
- En Supabase → Authentication → URL Configuration, usa esa URL como **Site URL** y en **Redirect URLs**.

## Configuración

Proyecto Supabase: `finanzas-personales` (ref `gjcwiwmqgqlhuquyieia`, región sa-east-1). Las migraciones de `supabase/migrations/` (0001 a 0004) ya están aplicadas.

1. Copia `.env.example` a `.env.local`; ya incluye la URL y la clave publicable del proyecto:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (anon/publishable). **Nunca** la service role key. |

2. `npm install && npm run dev`
3. En Vercel, configura las mismas dos variables.

Nota: Supabase pide confirmar el correo al crear una cuenta (Auth → Providers → Email → "Confirm email").

## Voz: compatibilidad

Usa el reconocimiento de voz del navegador (Web Speech API, idioma `es-PE`): sin costo, sin claves y sin pasar el audio por nuestro servidor (el navegador lo envía a su propio servicio de reconocimiento).

- Funciona en Chrome (Android y escritorio), Edge y Safari (iOS 14.5+ / macOS).
- En navegadores sin soporte (p. ej. Firefox) el micrófono no aparece y se usa el registro por texto.
- El micrófono requiere HTTPS (Vercel lo cumple; `localhost` también) y que el usuario conceda el permiso.

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run e2e`

### Pruebas end-to-end (`npm run e2e`)

Recorren la app en un navegador (375 px) contra Supabase real. **Vacían la cuenta de prueba en cada suite: nunca uses tu cuenta real.**

```bash
npm run build && npm start   # en otra terminal
BASE_URL=http://localhost:3000 E2E_EMAIL=... E2E_PASSWORD=... npm run e2e
```

Necesitan una cuenta de prueba confirmada en Supabase y `.env.local`. Opcional: `CHROMIUM_PATH` si Playwright no encuentra el navegador. Las capturas quedan en `e2e/capturas/` (ignorado por git).

## Deuda técnica / siguientes fases

- Renombrar una categoría todavía no está soportado (crear + eliminar). Los movimientos guardan el nombre de la categoría como texto.
- Las etiquetas aún no se aprenden de las correcciones.
- Los presupuestos son mensuales; periodos semanales o anuales quedan para más adelante.
- La app es instalable pero aún no funciona sin conexión (no hay service worker).
- Voz: si en el futuro se necesita soporte en Firefox o más precisión, se puede cambiar a transcripción en el servidor (p. ej. Whisper); el componente solo entrega texto a `parseMovimiento`.
- Cuentas (efectivo, banco, tarjeta) solo existen como campo; su gestión llega más adelante.
- Compromisos: aún no se editan (se eliminan y se crean de nuevo). El monto pagado es siempre la cuota; un pago parcial se registra editando el movimiento creado. No hay recordatorios por notificación.
- El dashboard agrega en el servidor sobre las filas del periodo; si el volumen crece, conviene moverlo a vistas o RPC en SQL.
