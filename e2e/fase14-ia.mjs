// Interpretación con IA (Gemini) como respaldo de las reglas. Requiere el servidor de la app
// arrancado con GEMINI_API_KEY=prueba y GEMINI_API_URL=http://localhost:4999 (lo hace run-ia.sh).
import { B, K, U, entrar, lanzar, ok, reiniciar, token } from "./comun.mjs";
import { iniciarGeminiFalso, llamadas } from "./gemini-falso.mjs";
await reiniciar();

const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const gemini = await iniciarGeminiFalso(4999, hoy);
const b = await lanzar();
const p = await b.newPage({ viewport: { width: 375, height: 740 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await entrar(p);
const campo = p.getByLabel("Describe tu movimiento");
const listo = p.getByRole("button", { name: "Listo" });
// Espera a que termine el guardado anterior (el botón se habilita) antes de enviar.
const escribir = async (t) => { await campo.fill(t); await p.waitForFunction(() => !document.querySelector("form button.btn-primary")?.disabled); await listo.click(); };
const tarjeta = p.locator(".card.pop-in").first();
const plano = async (l) => (await l.innerText()).replace(/\s+/g, " ");

// 1. Lo que las reglas entienden bien NO consulta la IA (rápido y sin gastar cuota)
await escribir("18 soles taxi");
await tarjeta.waitFor();
ok(llamadas.length === 0, "frase clara: solo reglas, sin llamar a la IA");
await p.click("button:has-text('Editar')"); await p.click("button:has-text('Cancelar')");

// 2. Frase libre: la IA la entiende
await escribir("Le pasé cincuenta a mi hermana por su cumple");
await tarjeta.waitFor({ timeout: 15000 });
const t2 = await plano(tarjeta);
ok(t2.includes("S/ 50.00") && t2.includes("Regalo a mi hermana") && t2.includes("Regalos"), `IA: «le pasé cincuenta…» → S/ 50 · Regalos (${t2.slice(0, 80)})`);
const ll = llamadas.at(-1);
ok(ll.clave === "prueba" && ll.schema && ll.url.includes(":generateContent"), "llamada con clave en cabecera y respuesta JSON con esquema");
ok(ll.sistema.includes(`Hoy es ${hoy}`) && ll.sistema.includes("- Regalos"), "el prompt incluye la fecha y las categorías del usuario");
await p.click("button:has-text('Confirmar')");
await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();

// 3. Varios gastos en lenguaje libre
await escribir("Almuerzo con clientes cuarenta lucas y el uber de vuelta quince");
const varios = p.locator("[aria-label='Varios movimientos']");
await varios.waitFor({ timeout: 15000 });
const tv = await plano(varios);
ok(tv.includes("S/ 40.00") && tv.includes("Trabajo") && tv.includes("S/ 15.00") && tv.includes("Transporte"), "IA separa 2 gastos con categorías distintas");
await varios.getByRole("button", { name: "Confirmar 2" }).click();
await p.getByRole("status").filter({ hasText: "Registrados 2" }).waitFor();

// 4. Si la IA falla, siguen las reglas sin error visible
await escribir("falla 7 soles");
await tarjeta.waitFor({ timeout: 15000 });
ok((await plano(tarjeta)).includes("S/ 7.00"), "IA con error → respaldo de las reglas");
await p.click("button:has-text('Editar')"); await p.click("button:has-text('Cancelar')");

// 5. Desactivar en Configuración
await p.goto(B + "/configuracion");
const sw = p.getByRole("switch", { name: "Interpretar con IA" });
await sw.click();
await p.getByTestId("estado-ajustes").filter({ hasText: "Guardado" }).waitFor();
await p.goto(B + "/");
const antes = llamadas.length;
await escribir("Le pasé cincuenta a mi hermana por su cumple");
await p.waitForTimeout(1500);
ok(llamadas.length === antes, "con la IA desactivada no se consulta");

const t = await token();
const filas = await (await fetch(`${U}/rest/v1/fin_transactions?select=amount,category`, { headers: { apikey: K, Authorization: `Bearer ${t}` } })).json();
ok(filas.length === 3 && filas.some((f) => f.category === "Regalos") && filas.some((f) => f.category === "Trabajo"), "3 movimientos guardados con la clasificación de la IA");
ok(errs.length === 0, `sin errores de página ${errs.join(" | ")}`);
await b.close();
gemini.close();
await reiniciar();
