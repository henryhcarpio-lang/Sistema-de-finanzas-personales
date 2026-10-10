import { B, K, U, entrar, lanzar, ok, reiniciar, token } from "./comun.mjs";
await reiniciar();
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const dia = (n) => { const d = new Date(`${hoy}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mesActual = hoy.slice(0, 7);
// Fecha del mes anterior dentro de los últimos 30 días (si hoy es día ≥ 2, día -(día del mes) cae en el mes anterior)
const mesAnterior = dia(-Number(hoy.slice(8, 10)));

const tok = await token();
const m = (o) => ({ currency: "PEN", source: "texto", nature: "necesidad", tags: [], note: null, ...o });
const datos = [
  m({ occurred_on: hoy, amount: 25, type: "egreso", category: "Almuerzo / comida fuera", concept: "Almuerzo", note: "menú con pollo" }),
  m({ occurred_on: hoy, amount: 18, type: "egreso", category: "Transporte", concept: "Taxi", tags: ["Taxi"] }),
  m({ occurred_on: hoy, amount: 2500, type: "ingreso", nature: null, category: "Trabajo", concept: "Sueldo" }),
  m({ occurred_on: `${mesActual}-01`, amount: 35, type: "egreso", category: "Almuerzo / comida fuera", concept: "Almuerzo" }),
  m({ occurred_on: `${mesActual}-01`, amount: 45, type: "egreso", nature: "deseo", category: "Entretenimiento", concept: "Cine", tags: ["Salida"] }),
  m({ occurred_on: mesAnterior, amount: 30, type: "egreso", category: "Almuerzo / comida fuera", concept: "Almuerzo" }),
  m({ occurred_on: mesAnterior, amount: 22, type: "egreso", category: "Transporte", concept: "Taxi", tags: ["Taxi"] }),
];
const ins = await fetch(`${U}/rest/v1/fin_transactions`, { method: "POST", headers: { apikey: K, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(datos) });
ok(ins.status === 201, `datos sembrados (${datos.length})`);

const b = await lanzar();
const p = await b.newPage({ viewport: { width: 375, height: 740 } });
const errs = [];
p.on("console", (x) => x.type() === "error" && errs.push(x.text()));
p.on("pageerror", (e) => errs.push(String(e)));
let n = 40;
const shot = (name) => p.screenshot({ path: `e2e/capturas/${++n}-${name}.png`, fullPage: true });
await entrar(p);
const frase = async () => (await p.getByTestId("frase-resumen").innerText()).replace(/\s/g, " ");

// 1. "¿Cuánto gasté en almuerzos este mes?" desde la interfaz
await p.goto(B + "/movimientos");
await p.selectOption("[aria-label='Categoría']", "Almuerzo / comida fuera");
await p.click("button:has-text('Filtrar')");
await p.waitForURL(/cat=/);
ok((await frase()) === "Gastaste S/ 60.00 en Almuerzo / comida fuera este mes.", "almuerzos este mes → S/ 60.00 — " + await frase());
await shot("almuerzos-mes");

// 2. Últimos 30 días incluye el mes anterior
await p.click("a:has-text('30 días')");
await p.waitForURL(/p=30d/);
ok((await frase()).startsWith("Gastaste S/ 90.00") && (await frase()).includes("últimos 30 días"), "almuerzos últimos 30 días → S/ 90.00");

// 3. Quitar filtro con chip
await p.click("[aria-label='Quitar filtro Almuerzo / comida fuera']");
await p.waitForURL((u) => !u.searchParams.has("cat"));
ok((await frase()).startsWith("Gastaste S/ 175.00"), "chip quitado: todos los gastos 30 días → S/ 175.00 — " + await frase());

// 4. Búsqueda en la nota
await p.goto(B + "/movimientos?q=pollo");
ok((await p.locator("main ul li").count()) === 1 && (await p.locator("main ul li").innerText()).includes("Almuerzo"), "búsqueda 'pollo' encuentra por nota");

// 5. Etiqueta, naturaleza y monto (filtros avanzados)
await p.goto(B + "/movimientos?p=30d");
await p.click("summary");
await p.selectOption("[aria-label='Etiqueta']", "Taxi");
await p.click("button:has-text('Filtrar')");
await p.waitForURL(/tag=Taxi/);
ok((await frase()).startsWith("Gastaste S/ 40.00 en #Taxi"), "etiqueta #Taxi 30 días → S/ 40.00");
await p.goto(B + "/movimientos?p=30d&nat=deseo");
ok((await frase()).startsWith("Gastaste S/ 45.00"), "naturaleza deseo → S/ 45.00");
await p.goto(B + "/movimientos?p=30d&min=20&max=40&tipo=egreso");
ok((await p.locator("main ul li").count()) === 4, "monto entre 20 y 40 → 4 movimientos");
ok(await p.locator("details").getAttribute("open") !== null, "filtros avanzados abiertos cuando hay uno activo");
await shot("filtros-avanzados");

// 6. Agrupación
await p.goto(B + "/movimientos?p=mes&agrupar=categoria");
const titulos = await p.locator("main section h2").allInnerTexts();
ok(titulos[0] === "Trabajo" && titulos.includes("Almuerzo / comida fuera"), "agrupado por categoría, mayor importe primero");
ok((await p.locator("section[aria-label='Almuerzo / comida fuera'] span").first().innerText()).includes("60.00"), "subtotal por categoría: Almuerzo −S/ 60.00");
await shot("agrupado-categoria");
await p.goto(B + "/movimientos?p=30d");
ok((await p.locator("main section h2").first().innerText()) === "Hoy", "agrupado por día: primer grupo 'Hoy'");

// 7. Desde el dashboard
await p.goto(B + "/dashboard?p=mes");
await p.click("[aria-label='Ver movimientos de Entretenimiento']");
await p.waitForURL(/\/movimientos\?p=mes&cat=Entretenimiento/);
ok((await frase()).startsWith("Gastaste S/ 45.00 en Entretenimiento este mes"), "dashboard → categoría abre su historial");

// 8. Entradas raras no rompen la página
const res = await p.goto(B + "/movimientos?min=abc&tipo=x&q=%25%2C%28%29&p=zz");
ok(res.status() === 200 && (await p.locator("h1").innerText()) === "Movimientos", "parámetros inválidos se ignoran");

ok(errs.length === 0, "sin errores en consola" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close();
