import { B, K, U, entrar, lanzar, ok, reiniciar, token } from "./comun.mjs";
await reiniciar();

const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const d = new Date(`${hoy}T00:00:00Z`);
d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
const inicioMesAnt = d.toISOString().slice(0, 10);
const diaHoy = Number(hoy.slice(8, 10));

const b = await lanzar();
const p = await b.newPage({ viewport: { width: 375, height: 740 } });
const errs = [];
p.on("console", (x) => x.type() === "error" && errs.push(x.text()));
p.on("pageerror", (e) => errs.push(String(e)));
const plano = async (loc) => (await loc.innerText()).replace(/\s/g, " ");
await entrar(p);

await p.goto(B + "/pagos");
await p.getByText("Agrega tus préstamos").waitFor();
ok(true, "estado vacío explicativo");

// 1. Préstamo con cuotas el día 1 desde el mes anterior → cuotas vencidas
await p.click("button:has-text('Agregar deuda o pago recurrente')");
const form = p.locator("form[aria-label='Nuevo compromiso']");
await form.getByLabel("Nombre").fill("Préstamo banco");
await form.getByLabel("Cuota (S/)").fill("620");
await form.getByLabel("Día de pago").fill("1");
await form.getByLabel("Desde").fill(inicioMesAnt);
await form.getByLabel("Nº de cuotas (opcional)").fill("10");
await form.getByLabel("Deuda total (opcional)").fill("6200");
await form.getByLabel("Acreedor (opcional)").fill("BCP");
await form.getByLabel("Tasa anual % (opcional)").fill("18.5");
await form.locator("button:has-text('Guardar')").click();
const deuda = p.locator("article[aria-label='Deuda Préstamo banco']");
await deuda.waitFor();
const vencidasEsperadas = diaHoy > 1 ? 2 : 1;
const banner = p.getByRole("status").filter({ hasText: "vencida" });
ok((await plano(banner)).includes(`${vencidasEsperadas} cuota`), `${vencidasEsperadas} cuota(s) vencida(s) sin registrar`);
ok((await plano(deuda)).includes("BCP") && (await plano(deuda)).includes("18.5 % anual"), "deuda muestra acreedor y tasa");
await p.screenshot({ path: "e2e/capturas/71-pagos-vencidas.png", fullPage: true });

// 2. Pagar la cuota más antigua
const primera = p.getByRole("button", { name: `Pagar Préstamo banco del ${inicioMesAnt}` });
await primera.click();
await primera.waitFor({ state: "detached" });
const t = await token();
const h = { apikey: K, Authorization: `Bearer ${t}` };
const filas = await (await fetch(`${U}/rest/v1/fin_transactions?select=amount,type,due_date,occurred_on,recurrent_id,concept`, { headers: h })).json();
ok(filas.length === 1 && filas[0].due_date === inicioMesAnt && filas[0].occurred_on === hoy && filas[0].type === "deuda" && Number(filas[0].amount) === 620 && filas[0].recurrent_id,
  "pagar crea UN movimiento real: hoy, tipo deuda, vinculado a la cuota");
const res = await plano(deuda.getByTestId("resumen-deuda"));
ok(res.includes("Saldo S/ 5,580.00") && res.includes("1/10 cuotas"), "saldo baja a S/ 5,580.00 y 1/10 cuotas");

// 3. La misma cuota no se puede pagar dos veces (índice único en la base)
const dup = await fetch(`${U}/rest/v1/fin_transactions`, { method: "POST", headers: { ...h, "Content-Type": "application/json" },
  body: JSON.stringify({ ...filas[0], currency: "PEN", category: "Deudas", nature: "deuda", source: "manual", tags: [] }) });
ok(dup.status === 409, "pago duplicado de la misma cuota rechazado (409)");

// 4. Recurrente que vence hoy
await p.click("button:has-text('Agregar deuda o pago recurrente')");
await form.locator("button:has-text('Pago recurrente')").click();
await form.getByLabel("Nombre").fill("Netflix");
await form.getByLabel("Cuota (S/)").fill("45");
await form.getByLabel("Día de pago").fill(String(diaHoy));
await form.getByLabel("Categoría").selectOption("Suscripciones");
await form.locator("button:has-text('Guardar')").click();
await p.locator("li[aria-label='Recurrente Netflix']").waitFor();
ok((await plano(p.locator("section[aria-label='Por pagar']"))).includes("Vence hoy"), "Netflix aparece como 'Vence hoy'");

// 5. Dashboard: próximos compromisos
await p.goto(B + "/dashboard");
const prox = p.locator("section[aria-label='Próximos compromisos']");
const tp = await plano(prox);
ok(tp.includes("Netflix") && (diaHoy === 1 || tp.includes("Préstamo banco")), "dashboard: próximos compromisos con Netflix y la cuota vencida");
ok((await prox.getByRole("button", { name: /Pagar Netflix/ }).count()) === 1, "Netflix nuevo no hereda la fecha 'Desde' del compromiso anterior (una sola cuota)");
await p.screenshot({ path: "e2e/capturas/72-dashboard-compromisos.png", fullPage: true });
await prox.getByRole("button", { name: /Pagar Netflix/ }).click();
await prox.getByRole("button", { name: /Pagar Netflix/ }).waitFor({ state: "detached" });
const mov = await (await fetch(`${U}/rest/v1/fin_transactions?select=type,category,nature&concept=eq.Netflix`, { headers: h })).json();
ok(mov.length === 1 && mov[0].type === "egreso" && mov[0].category === "Suscripciones" && mov[0].nature === "deseo", "pagar recurrente desde el dashboard → egreso con naturaleza de su categoría");

// 6. Eliminar el compromiso conserva los pagos
await p.goto(B + "/pagos");
await p.click("[aria-label='Eliminar Netflix']");
await p.locator("li[aria-label='Recurrente Netflix'] button:has-text('Eliminar'):not([aria-label])").click();
await p.locator("li[aria-label='Recurrente Netflix']").waitFor({ state: "detached" });
const quedan = await (await fetch(`${U}/rest/v1/fin_transactions?select=id&concept=eq.Netflix`, { headers: h })).json();
ok(quedan.length === 1, "compromiso eliminado; su pago sigue en Movimientos");

ok(errs.length === 0, "sin errores en consola" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close();
await reiniciar();
