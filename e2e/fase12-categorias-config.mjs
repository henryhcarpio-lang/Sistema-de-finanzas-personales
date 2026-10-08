import { B, K, U, entrar, lanzar, ok, reiniciar, token } from "./comun.mjs";
await reiniciar();

const b = await lanzar();
const ctx = await b.newContext({ viewport: { width: 375, height: 740 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await entrar(p);

// 1. Categorías agrupadas con icono
await p.goto(B + "/categorias");
for (const g of ["Comida y bebida", "Estilo de vida", "Familia", "Hogar y servicios", "Transporte", "Finanzas", "Otros"]) {
  ok(await p.getByRole("region", { name: g }).count() === 1, `grupo «${g}»`);
}
ok(await p.getByRole("region", { name: "Transporte" }).getByRole("button", { name: "Editar categoría Gasolina" }).count() === 1, "Gasolina dentro de Transporte");
ok(await p.locator("main li svg").count() >= 22, "cada categoría con icono");
await p.screenshot({ path: "e2e/capturas/121-categorias.png", fullPage: true });

// 2. Clasificación nueva y renombrar con movimientos existentes
await p.goto(B + "/");
await p.fill("input[placeholder*='18 soles taxi']", "50 soles gasolina");
await p.keyboard.press("Enter");
ok((await p.locator("section").filter({ hasText: "Confirmar" }).first().innerText()).includes("Gasolina"), "«gasolina» → categoría Gasolina");
await p.click("button:has-text('Confirmar')");
await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();

await p.goto(B + "/categorias");
ok((await p.getByRole("button", { name: "Editar categoría Gasolina" }).innerText()).includes("(1)"), "contador de movimientos del mes");
await p.getByRole("button", { name: "Editar categoría Gasolina" }).click();
const ed = p.locator("form[aria-label='Editar Gasolina']");
await ed.getByLabel("Nombre").fill("Combustible");
await ed.getByRole("button", { name: "Color #dc2626" }).click();
await ed.locator("button:has-text('Guardar')").click();
await p.getByRole("button", { name: "Editar categoría Combustible" }).waitFor();
const t = await token();
const h = { apikey: K, Authorization: `Bearer ${t}` };
const movs = await (await fetch(`${U}/rest/v1/fin_transactions?select=category`, { headers: h })).json();
ok(movs.length === 1 && movs[0].category === "Combustible", "renombrar actualiza el movimiento existente");
const cat = await (await fetch(`${U}/rest/v1/fin_categories?select=color&name=eq.Combustible`, { headers: h })).json();
ok(cat[0]?.color === "#dc2626", "color guardado");

// 3. Configuración: nombre, tema, texto, resumen, pagos
await p.goto(B + "/");
await p.getByRole("link", { name: "Configuración" }).click();
await p.waitForURL(/\/configuracion/);
ok(true, "engranaje abre Configuración");
await p.getByLabel("Tu nombre").fill("Henry");
await p.locator("form:has([aria-label='Tu nombre']) button").click();
await p.getByTestId("estado-ajustes").filter({ hasText: "Guardado" }).waitFor();
await p.getByRole("radio", { name: "Oscuro" }).click();
await p.getByRole("radio", { name: "Grande", exact: true }).click();
await p.getByRole("switch", { name: "Tu resumen inteligente" }).click();
await p.getByRole("radio", { name: "14 días" }).click();
await p.waitForTimeout(1200);
await p.reload();
const html = await p.evaluate(() => ({ tema: document.documentElement.dataset.tema, texto: document.documentElement.dataset.texto, fs: getComputedStyle(document.documentElement).fontSize, bg: getComputedStyle(document.body).backgroundColor }));
ok(html.tema === "oscuro" && html.texto === "grande", `tema y texto persisten al recargar (${JSON.stringify(html)})`);
ok(html.fs === "18px", "texto grande = 18 px base");
ok(html.bg === "rgb(11, 15, 20)", "tema oscuro aplicado");
ok(await p.getByRole("switch", { name: "Tu resumen inteligente" }).getAttribute("aria-checked") === "false", "interruptor del resumen persiste");
await p.screenshot({ path: "e2e/capturas/122-configuracion.png", fullPage: true });

await p.goto(B + "/dashboard");
ok((await p.getByTestId("saludo").innerText()).includes("Henry"), "saludo con el nombre");
ok(await p.getByText("Tu resumen inteligente").count() === 0, "resumen inteligente oculto");

// 4. Sin desbordes con texto grande
for (const r of ["/", "/dashboard", "/configuracion", "/categorias"]) {
  await p.goto(B + r);
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(w <= 375, `sin scroll horizontal con texto grande en ${r} (${w})`);
}

// 5. Exportar CSV
await p.goto(B + "/configuracion");
const [dl] = await Promise.all([p.waitForEvent("download"), p.getByRole("link", { name: /Exportar movimientos/ }).click()]);
const csv = (await (await import("node:fs/promises")).readFile(await dl.path(), "utf8"));
ok(csv.includes("Fecha") && csv.includes("Combustible") && csv.includes("50"), "CSV con encabezados y el movimiento");

// 6. Borrar datos exige escribir BORRAR
await p.getByRole("button", { name: "Borrar todos mis datos" }).click();
const borrar = p.locator("form[aria-label='Borrar todos mis datos']");
await borrar.getByLabel("Escribe BORRAR para confirmar").fill("borrar");
await borrar.locator("button:has-text('Borrar todo')").click();
await borrar.getByRole("alert").waitFor();
const siguen = await (await fetch(`${U}/rest/v1/fin_transactions?select=id`, { headers: h })).json();
ok(siguen.length === 1, "sin la palabra exacta no se borra nada");
await borrar.locator("button:has-text('Cancelar')").click();

// Restaurar apariencia para las demás suites
await p.getByRole("radio", { name: "Automático" }).click();
await p.getByRole("radio", { name: "Normal" }).click();
await p.waitForTimeout(1000);

ok(errs.length === 0, `sin errores de página ${errs.join(" | ")}`);
await b.close();
