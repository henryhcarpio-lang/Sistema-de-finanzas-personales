import { B, K, U, entrar, lanzar, ok, reiniciar, token } from "./comun.mjs";
await reiniciar();

const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const dia = (n) => { const d = new Date(`${hoy}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const m = (o) => ({ currency: "PEN", source: "texto", nature: "necesidad", tags: [], note: null, type: "egreso", category: "Transporte", ...o });
const datos = [
  m({ occurred_on: hoy, amount: 5, concept: "Pan", category: "Supermercado" }),
  m({ occurred_on: dia(-1), amount: 18, concept: "Taxi" }),
  m({ occurred_on: dia(-1), amount: 1.2, concept: "Pasaje" }),
  m({ occurred_on: dia(-1), amount: 35, concept: "Almuerzo", category: "Almuerzo / comida fuera" }),
  m({ occurred_on: dia(-2), amount: 7, concept: "Combi" }),
  m({ occurred_on: dia(-5), amount: 40, concept: "Farmacia", category: "Salud" }),
];
const t = await token();
const r = await fetch(`${U}/rest/v1/fin_transactions`, { method: "POST", headers: { apikey: K, Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify(datos) });
ok(r.status === 201, "datos sembrados (hoy, ayer, anteayer, hace 5 días)");

const b = await lanzar();
const p = await b.newPage({ viewport: { width: 375, height: 740 } });
const errs = [];
p.on("console", (x) => x.type() === "error" && errs.push(x.text()));
p.on("pageerror", (e) => errs.push(String(e)));
const frase = async () => (await p.getByTestId("frase-resumen").innerText()).replace(/\s/g, " ");
const conceptos = async () => (await p.locator("main ul li a p.truncate.text-sm").allInnerTexts());
await entrar(p);

// 1. Chip Ayer en Movimientos
await p.goto(B + "/movimientos");
await p.getByRole("link", { name: "Ayer", exact: true }).click();
await p.waitForURL(/p=ayer/);
ok((await frase()).startsWith("Gastaste S/ 54.20") && (await frase()).includes("ayer"), "Ayer → Gastaste S/ 54.20 ayer");
const c1 = await conceptos();
ok(c1.length === 3 && c1.includes("Taxi") && !c1.includes("Pan"), "Ayer: solo los 3 movimientos de ayer");
ok((await p.getByTestId("dia-elegido").innerText()).startsWith("Ayer ·"), "muestra la fecha: 'Ayer · …'");
await p.screenshot({ path: "e2e/capturas/81-ayer.png", fullPage: true });

// 2. Navegar con flechas
await p.getByRole("link", { name: "Día anterior" }).click();
await p.waitForURL(new RegExp(`p=dia&d=${dia(-2)}`));
ok((await frase()).startsWith("Gastaste S/ 7.00") && (await conceptos()).join() === "Combi", "‹ anteayer: solo Combi S/ 7.00");
await p.getByRole("link", { name: "Día siguiente" }).click();
await p.waitForURL(/p=ayer/);
ok(true, "› vuelve a Ayer");
await p.getByRole("link", { name: "Día siguiente" }).click();
await p.waitForURL(/p=hoy/);
ok((await p.locator("[aria-label='Día siguiente'][aria-disabled='true']").count()) === 1, "en Hoy, 'día siguiente' está deshabilitado");

// 3. Selector de fecha
await p.getByLabel("Elegir día").fill(dia(-5));
await p.click("[data-testid=navegador-dia] button:has-text('Ver')");
await p.waitForURL(new RegExp(`d=${dia(-5)}`));
ok((await conceptos()).join() === "Farmacia" && (await frase()).startsWith("Gastaste S/ 40.00"), "elegir fecha (hace 5 días) → Farmacia S/ 40.00");
ok((await p.getByRole("link", { name: "Día", exact: true }).getAttribute("aria-current")) === "true", "chip 'Día' marcado");

// 4. Filtro de categoría se mantiene al cambiar de día
await p.goto(B + "/movimientos?p=ayer&cat=Transporte");
ok((await frase()).startsWith("Gastaste S/ 19.20 en Transporte ayer"), "Ayer + Transporte → S/ 19.20");
await p.getByRole("link", { name: "Día anterior" }).click();
await p.waitForURL(new RegExp(`p=dia&d=${dia(-2)}&cat=Transporte|cat=Transporte.*d=${dia(-2)}`));
ok((await frase()).includes("en Transporte el ") && (await frase()).startsWith("Gastaste S/ 7.00"), "al ir al día anterior se conserva el filtro Transporte");

// 5. Dashboard con Ayer
await p.goto(B + "/dashboard");
await p.getByRole("link", { name: "Ayer", exact: true }).click();
await p.waitForURL(/dashboard\?p=ayer/);
const kpis = (await p.locator("main").innerText()).replace(/\s+/g, " ");
ok(kpis.includes("Gastos S/ 54.20"), "Dashboard Ayer: gastos S/ 54.20");
ok((await p.locator("h2:has-text('Gasto por día')").count()) === 0, "Dashboard de un día: sin gráfico de una sola barra");
await p.screenshot({ path: "e2e/capturas/82-dashboard-ayer.png", fullPage: true });

// 6. Sin scroll horizontal de la página
const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
ok(ancho <= 375, `sin scroll horizontal a 375 px (ancho ${ancho})`);

ok(errs.length === 0, "sin errores en consola" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close();
await reiniciar();
