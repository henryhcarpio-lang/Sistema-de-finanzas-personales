import { B, entrar, lanzar, ok, reiniciar } from "./comun.mjs";
await reiniciar();
const b = await lanzar();
const p = await b.newPage({ viewport: { width: 375, height: 740 } });
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
p.on("pageerror", (e) => errs.push(String(e)));
let n = 20;
const shot = async (name) => p.screenshot({ path: `e2e/capturas/${++n}-${name}.png`, fullPage: true });

await entrar(p);
const input = p.getByLabel("Describe tu movimiento");
const frase = async (t) => { await input.fill(t); await p.click("button:has-text('Listo')"); };
const card = p.locator(".card.pop-in").first();

// 1. Corregir la clasificación de "pasaje"
await frase("20 soles pasaje");
await card.waitFor();
ok((await card.innerText()).includes("Transporte"), "sin preferencias: pasaje → Transporte");
await p.click("button:has-text('Editar')");
await p.selectOption("#f-cat", "Entretenimiento");
ok((await p.inputValue("#f-nat")) === "deseo", "al elegir Entretenimiento se propone naturaleza 'deseo'");
await p.click("button:has-text('Guardar')");
await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();

// 2. La siguiente entrada usa lo aprendido
await p.reload();
await frase("5 soles pasaje");
await card.waitFor();
const t2 = await card.innerText();
ok(t2.includes("Entretenimiento") && t2.includes("Aprendido de tus correcciones"), "aprendido: pasaje → Entretenimiento");
await shot("aprendido");
await p.click("button:has-text('Confirmar')");
await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();

// 3. Aprender desde la edición: "Banco 500" como deuda
await frase("Banco 500");
await p.click("button:has-text('deuda')");
await p.click("button:has-text('Guardar')");
await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();
await p.reload();
await frase("Banco 300");
await card.waitFor();
ok((await card.innerText()).includes("Deudas"), "'Banco 300' ya no es ambiguo: Deudas");
await p.click("button:has-text('Confirmar')");
await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();

// 4. Categorías
await p.goto(B + "/categorias");
ok((await p.locator("main li").count()) === 15, "15 categorías iniciales");
await p.fill("[aria-label='Nombre de la categoría']", "Mascotas");
await p.selectOption("[aria-label='Naturaleza']", "deseo");
await p.click("button:has-text('Agregar')");
await p.locator("main li", { hasText: "Mascotas" }).waitFor();
ok(true, "categoría 'Mascotas' creada");
await shot("categorias");
await p.goto(B + "/");
await frase("40 soles veterinario");
await p.click("button:has-text('Editar')");
ok((await p.locator("#f-cat option").allInnerTexts()).includes("Mascotas"), "'Mascotas' disponible al registrar");
await p.goto(B + "/categorias");
await p.click("[aria-label='Eliminar Mascotas']");
await p.locator("main li", { hasText: "Mascotas" }).getByRole("button", { name: "Eliminar" }).click();
await p.locator("main li", { hasText: "Mascotas" }).waitFor({ state: "detached" });
ok(true, "categoría 'Mascotas' eliminada");

ok(errs.length === 0, "sin errores en consola" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close();
