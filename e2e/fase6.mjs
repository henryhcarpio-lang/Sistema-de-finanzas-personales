import { B, K, U, entrar, lanzar, ok, reiniciar, token } from "./comun.mjs";
await reiniciar();

const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const ayer = (() => { const d = new Date(`${hoy}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
const b = await lanzar();
const p = await b.newPage({ viewport: { width: 375, height: 740 } });
const errs = [];
p.on("console", (x) => x.type() === "error" && errs.push(x.text()));
p.on("pageerror", (e) => errs.push(String(e)));
const plano = (s) => s.replace(/\s/g, " ");
await entrar(p);

// --- Icono / instalación ---
const man = await p.request.get(B + "/manifest.webmanifest");
const mj = await man.json();
ok(man.ok() && mj.display === "standalone" && mj.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable"), "manifiesto: standalone + icono maskable 512");
for (const src of [...mj.icons.map((i) => i.src), "/apple-icon.png"]) {
  const r = await p.request.get(B + src);
  ok(r.ok() && r.headers()["content-type"].startsWith("image/png"), `icono servido como PNG: ${src}`);
}
const head = await p.locator("head").innerHTML();
ok(head.includes('rel="manifest"') && head.includes('rel="apple-touch-icon"'), "<head> enlaza manifiesto y apple-touch-icon");

// --- Fecha en la frase ---
const input = p.getByLabel("Describe tu movimiento");
const frase = async (t) => { await input.fill(t); await p.click("button:has-text('Listo')"); };
const card = p.locator(".card.pop-in").first();
await frase("ayer 18 soles taxi");
await card.waitFor();
ok((await p.getByTestId("fecha-detectada").innerText()).includes("Ayer"), "tarjeta muestra la fecha detectada: Ayer");
await p.screenshot({ path: "e2e/capturas/61-fecha-ayer.png", fullPage: true });
await p.click("button:has-text('Confirmar')");
const estado = p.getByRole("status").filter({ hasText: "Registrado" });
await estado.waitFor();
ok(plano(await estado.innerText()).includes("Ayer"), "aviso de registrado indica 'Ayer'");
const t = await token();
const fila = await (await fetch(`${U}/rest/v1/fin_transactions?select=occurred_on,concept&order=created_at.desc&limit=1`, { headers: { apikey: K, Authorization: `Bearer ${t}` } })).json();
ok(fila[0]?.occurred_on === ayer && fila[0]?.concept === "Taxi", `guardado con fecha de ayer (${ayer})`);
await fetch(`${U}/rest/v1/fin_transactions?id=not.is.null`, { method: "DELETE", headers: { apikey: K, Authorization: `Bearer ${t}` } });

// --- Presupuestos ---
await p.goto(B + "/presupuestos");
await p.getByText("Aún no tienes presupuestos").waitFor();
ok(true, "estado vacío con sugerencia");
await p.selectOption("[aria-label='Categoría del presupuesto']", "Transporte");
await p.fill("[aria-label='Límite mensual']", "100");
await p.click("button:has-text('Agregar presupuesto')");
await p.locator("li[aria-label='Presupuesto de Transporte']").waitFor();
ok(!(await p.locator("[aria-label='Categoría del presupuesto'] option").allInnerTexts()).includes("Transporte"), "Transporte ya no se ofrece para un segundo presupuesto");

await p.goto(B + "/");
const avisoP = p.getByTestId("aviso-presupuesto");
for (const [f, esperado, msg] of [
  ["60 soles taxi", "Te quedan S/ 40.00 de Transporte este mes.", "tras 60: quedan S/ 40"],
  ["30 soles taxi", "Te quedan S/ 10.00 de Transporte este mes (90 % usado).", "tras 90: aviso del 90 %"],
  ["20 soles pasaje", "Superaste el presupuesto de Transporte por S/ 10.00 (110 %).", "tras 110: excedido, sin bloquear"],
]) {
  await frase(f);
  await p.click("button:has-text('Confirmar')");
  await avisoP.filter({ hasText: esperado.slice(0, 18) }).waitFor();
  ok(plano(await avisoP.innerText()).includes(esperado), msg);
}
await p.screenshot({ path: "e2e/capturas/62-aviso-excedido.png", fullPage: true });
await frase("15 soles cine");
await p.click("button:has-text('Confirmar')");
await p.getByRole("status").filter({ hasText: "Cine" }).waitFor();
ok((await avisoP.count()) === 0, "categoría sin presupuesto: sin aviso");

await p.goto(B + "/presupuestos");
const li = p.locator("li[aria-label='Presupuesto de Transporte']");
ok(plano(await li.innerText()).includes("Excedido") && plano(await li.innerText()).includes("Excedido en S/ 10.00"), "sobre Transporte: Excedido en S/ 10.00");
ok((await p.getByTestId("avisos").innerText()).includes("1 presupuesto necesita atención"), "resumen: 1 presupuesto necesita atención");
await p.screenshot({ path: "e2e/capturas/63-presupuestos.png", fullPage: true });

// Editar el límite
await p.click("[aria-label='Editar límite de Transporte']");
await p.fill("[aria-label='Nuevo límite de Transporte']", "500");
await p.click("li[aria-label='Presupuesto de Transporte'] button:has-text('OK')");
await li.getByText("de S/ 500.00").waitFor();
const tli = plano(await li.innerText());
ok(tli.includes("Disponible S/ 390.00") && !tli.includes("Excedido"), "límite editado a 500: disponible S/ 390.00");

// Dashboard
await p.goto(B + "/dashboard?p=mes");
ok((await p.locator("section[aria-label='Presupuestos del mes']").count()) === 1, "dashboard muestra la sección de presupuestos");

// Quitar
await p.goto(B + "/presupuestos");
await p.click("[aria-label='Quitar presupuesto de Transporte']");
await p.click("li[aria-label='Presupuesto de Transporte'] button:has-text('Quitar'):not([aria-label])");
await p.getByText("Aún no tienes presupuestos").waitFor();
ok(true, "presupuesto quitado (con confirmación)");

ok(errs.length === 0, "sin errores en consola" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close();
await reiniciar();
