import { B, K, U, entrar, lanzar, ok, reiniciar, token } from "./comun.mjs";
import { sembrar4Meses } from "./sembrar4meses.mjs";
await reiniciar();

const b = await lanzar();
const p = await b.newPage({ viewport: { width: 375, height: 740 } });
const errs = [];
p.on("console", (x) => x.type() === "error" && errs.push(x.text()));
p.on("pageerror", (e) => errs.push(String(e)));
const plano = async (l) => (await l.innerText()).replace(/\s+/g, " ");
await entrar(p);

// Sin historial suficiente
await p.goto(B + "/dashboard");
const sec = p.locator("section[aria-label='Tu resumen inteligente']");
await sec.waitFor();
ok((await p.getByTestId("pocos-datos").count()) === 1, "sin historial: pide seguir registrando, no inventa recomendaciones");

await sembrar4Meses();
await p.reload();
const resumen = await plano(p.getByTestId("resumen-texto"));
ok(resumen.includes("Llevas S/ 340.00 gastados") && resumen.includes("11 %") && resumen.includes("Tu mayor gasto es Salud"), "resumen del mes en palabras — " + resumen);
const hall = await plano(p.getByTestId("hallazgos"));
ok(hall.includes("Pagaste S/ 220.00 en Dentista") && hall.includes("lo usual es S/ 40.00"), "detecta el gasto atípico (Dentista S/ 220 vs S/ 40)");
ok(/Transporte sube \d+ %/.test(hall), "detecta la categoría que crece (Transporte)");
ok(hall.includes("Almuerzo / comida fuera: gastas unos S/ 60.00 al mes"), "sugiere presupuesto para Almuerzo / comida fuera");
await p.screenshot({ path: "e2e/capturas/91-inteligencia.png", fullPage: true });

// Usar la sugerencia crea el presupuesto, y deja de sugerirse
await p.getByRole("button", { name: /Usar presupuesto de S\/\s?60\.00 para Almuerzo/ }).click();
await p.getByRole("button", { name: /para Almuerzo/ }).waitFor({ state: "detached" });
const t = await token();
const b2 = await (await fetch(`${U}/rest/v1/fin_budgets?select=category,monthly_limit`, { headers: { apikey: K, Authorization: `Bearer ${t}` } })).json();
ok(b2.length === 1 && b2[0].category === "Almuerzo / comida fuera" && Number(b2[0].monthly_limit) === 60, "'Usar S/ 60' crea el presupuesto y la sugerencia desaparece");

// El atípico enlaza a su movimiento
await p.getByRole("link", { name: /Pagaste S\/\s?220\.00/ }).click();
await p.waitForURL(/\/movimientos\/[0-9a-f-]{36}/);
ok((await p.inputValue("#f-concept")) === "Dentista", "el atípico abre el movimiento para revisarlo");

ok(errs.length === 0, "sin errores en consola" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close();
await reiniciar();
