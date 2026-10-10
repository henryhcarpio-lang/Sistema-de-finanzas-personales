import { B, K, U, entrar, lanzar, ok, reiniciar, token } from "./comun.mjs";
await reiniciar();

const b = await lanzar();
const p = await b.newPage({ viewport: { width: 375, height: 740 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
const plano = async (loc) => (await loc.innerText()).replace(/\s/g, " ");
await entrar(p);
await p.goto(B + "/pagos");

// 1. Préstamo de 12 cuotas, sin "cuota actual" (empieza en la 1)
await p.click("button:has-text('Agregar deuda o pago recurrente')");
const form = p.locator("form[aria-label='Nuevo compromiso']");
await form.getByLabel("Nombre").fill("Préstamo auto");
await form.getByLabel("Cuota (S/)").fill("500");
await form.getByLabel("Día de pago").fill("28");
await form.getByLabel("Nº de cuotas (opcional)").fill("12");
await form.getByLabel("Deuda total (opcional)").fill("6000");
await form.locator("button:has-text('Guardar')").click();
const deuda = p.locator("article[aria-label='Deuda Préstamo auto']");
await deuda.waitFor();
ok((await plano(deuda.getByTestId("resumen-deuda"))).includes("0/12 cuotas"), "creado en 0/12 cuotas");

// 2. Editar: voy en la cuota 8 y la cuota sube a 520
await deuda.getByRole("button", { name: "Editar Préstamo auto" }).click();
const ed = p.locator("form[aria-label='Editar Préstamo auto']");
ok(await ed.getByLabel("Nombre").inputValue() === "Préstamo auto", "formulario de edición precargado");
await ed.getByLabel("Voy en la cuota Nº").fill("8");
await ed.getByLabel("Cuota (S/)").fill("520");
await ed.locator("button:has-text('Guardar')").click();
await deuda.getByTestId("resumen-deuda").filter({ hasText: "7/12" }).waitFor();
const res = await plano(deuda.getByTestId("resumen-deuda"));
ok(res.includes("7/12 cuotas") && res.includes("Saldo S/ 2,360.00"), `resumen 7/12 y saldo 6000 − 7×520 (${res})`);
ok((await plano(deuda)).includes("S/ 520.00"), "monto editado visible");
const fila = p.locator("li", { hasText: "Préstamo auto" }).filter({ hasText: "cuota 8/12" });
ok(await fila.count() === 1, "el calendario muestra la cuota 8/12");

const t = await token();
const h = { apikey: K, Authorization: `Bearer ${t}` };
let movs = await (await fetch(`${U}/rest/v1/fin_transactions?select=id`, { headers: h })).json();
ok(movs.length === 0, "las 7 cuotas previas NO crean gastos");

// 3. No permite una cuota actual mayor al total
await deuda.getByRole("button", { name: "Editar Préstamo auto" }).click();
await ed.getByLabel("Voy en la cuota Nº").fill("13");
await ed.locator("button:has-text('Guardar')").click();
ok((await ed.getByRole("alert").innerText()).includes("no puede pasar de 12"), "valida cuota actual ≤ total");
await ed.locator("button:has-text('Cancelar')").click();

// 4. Pagar la cuota 8 y editar ese pago
await p.getByRole("button", { name: /Pagar Préstamo auto/ }).first().click();
await deuda.getByText("Pagos registrados (1)").waitFor();
ok((await plano(deuda.getByTestId("resumen-deuda"))).includes("8/12 cuotas"), "tras pagar: 8/12 cuotas");
await deuda.getByText("Pagos registrados (1)").click();
ok((await plano(deuda)).includes("Cuota 8"), "el pago figura como cuota 8");
await deuda.getByRole("link", { name: /Editar pago/ }).click();
await p.waitForURL(/\/movimientos\/[0-9a-f-]+/);
ok(true, "Editar pago abre el movimiento");
movs = await (await fetch(`${U}/rest/v1/fin_transactions?select=id,amount,recurrent_id`, { headers: h })).json();
ok(movs.length === 1 && Number(movs[0].amount) === 520 && movs[0].recurrent_id, "un solo movimiento real de S/ 520 vinculado");

// 5. Editar un pago recurrente
await p.goto(B + "/pagos");
await p.click("button:has-text('Agregar deuda o pago recurrente')");
await form.locator("button:has-text('Pago recurrente')").click();
await form.getByLabel("Nombre").fill("Internet");
await form.getByLabel("Cuota (S/)").fill("90");
await form.getByLabel("Día de pago").fill("20");
await form.locator("button:has-text('Guardar')").click();
const rec = p.locator("li[aria-label='Recurrente Internet']");
await rec.waitFor();
await rec.getByRole("button", { name: "Editar Internet" }).click();
const er = p.locator("form[aria-label='Editar Internet']");
await er.getByLabel("Nombre").fill("Internet fibra");
await er.getByLabel("Cuota (S/)").fill("110");
await er.locator("button:has-text('Guardar')").click();
const rec2 = p.locator("li[aria-label='Recurrente Internet fibra']");
await rec2.waitFor();
ok((await plano(rec2)).includes("S/ 110.00"), "recurrente editado: nombre y monto");
await p.screenshot({ path: "e2e/capturas/111-editar-pagos.png", fullPage: true });

ok(errs.length === 0, `sin errores de página ${errs.join(" | ")}`);
await b.close();
