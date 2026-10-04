import { B, entrar, lanzar, ok, reiniciar } from "./comun.mjs";
await reiniciar();
const b = await lanzar();
const p = await b.newPage({ viewport: { width: 375, height: 740 } });
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
p.on("pageerror", (e) => errs.push(String(e)));
let n = 0;
const shot = async (name) => p.screenshot({ path: `e2e/capturas/${String(++n).padStart(2, "0")}-${name}.png`, fullPage: true });

await entrar(p);
ok(true, "login y redirección a Registrar");
await shot("registrar-vacio");

const input = p.getByLabel("Describe tu movimiento");
async function frase(t) { await input.fill(t); await p.click("button:has-text('Listo')"); }

await frase("un sol pasaje");
const card = p.locator(".card.pop-in");
await card.waitFor();
const txt = await card.innerText();
ok(/S\/\s?1\.00/.test(txt) && txt.includes("Transporte") && /necesidad/i.test(txt), "tarjeta 'un sol pasaje' → S/ 1.00 · Transporte · necesidad");
await shot("confirmar-pasaje");
await p.click("button:has-text('Confirmar')");
await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();
ok(true, "guardado con feedback");
await shot("registrado-pasaje");

for (const t of ["Gasté 18 soles en taxi", "Me depositaron 2,500 soles"]) {
  await frase(t);
  await p.click("button:has-text('Confirmar')");
  await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();
}
ok(true, "taxi e ingreso registrados");

await frase("Banco 500");
await p.getByText("¿Es un ingreso, un pago de deuda o un gasto?").waitFor();
ok(true, "'Banco 500' pide el tipo");
await shot("banco-ambiguo");
await p.click("button:has-text('deuda')");
await p.click("button:has-text('Guardar')");
await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();
await p.reload();
await shot("ultimos-movimientos");

await p.goto(B + "/dashboard?p=hoy");
let body = await p.locator("main").innerText();
ok(body.includes("2,500.00") || body.includes("2 500.00") || body.includes("2500.00"), "dashboard: ingresos 2,500");
ok(body.includes("519.00"), "dashboard: gastos 519");
await shot("dashboard-hoy");

await p.goto(B + "/movimientos?p=hoy&cat=Transporte");
body = await p.locator("main").innerText();
ok(/Movimientos\s+2\b/.test(body) && body.includes("19.00"), "filtro Transporte: 2 movimientos, S/ 19");
await shot("filtro-transporte");

await p.locator("main ul a", { hasText: "Taxi" }).first().click();
await p.waitForURL(/\/movimientos\/[0-9a-f-]{36}/);
await p.fill("#f-amount", "20");
await p.click("button:has-text('Guardar')");
await p.waitForURL(B + "/movimientos");
await p.goto(B + "/movimientos?p=hoy&cat=Transporte");
body = await p.locator("main").innerText();
ok(body.includes("21.00"), "edición: total Transporte S/ 21");

await p.goto(B + "/movimientos?p=hoy");
await p.locator("main ul a", { hasText: "Banco" }).first().click();
await p.click("text=Eliminar movimiento");
await shot("confirmar-eliminar");
await p.click("button:has-text('Eliminar'):not(:has-text('movimiento'))");
await p.waitForURL(B + "/movimientos");
await p.goto(B + "/movimientos?p=hoy");
body = await p.locator("main").innerText();
ok(!body.includes("Banco") && /Movimientos\s+3\b/.test(body), "eliminación: quedan 3 movimientos");
await shot("movimientos-final");

ok(errs.length === 0, "sin errores en consola" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close();
