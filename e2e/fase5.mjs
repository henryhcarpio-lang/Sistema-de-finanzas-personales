import { B, K, U, entrar, lanzar, ok, reiniciar, token } from "./comun.mjs";
await reiniciar();

const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const dia = (n) => { const d = new Date(`${hoy}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mes = hoy.slice(0, 7);
const mesAnt = dia(-Number(hoy.slice(8, 10))).slice(0, 7);
const m = (o) => ({ currency: "PEN", source: "texto", nature: "necesidad", tags: [], note: null, type: "egreso", ...o });
const datos = [
  m({ occurred_on: `${mes}-01`, amount: 60, category: "Transporte", concept: "Taxi" }),
  m({ occurred_on: `${mes}-02`, amount: 40, nature: "deseo", category: "Entretenimiento", concept: "Cine" }),
  m({ occurred_on: `${mes}-02`, amount: 100, type: "deuda", nature: "deuda", category: "Deudas", concept: "Cuota" }),
  m({ occurred_on: `${mes}-01`, amount: 3000, type: "ingreso", nature: null, category: "Trabajo", concept: "Sueldo" }),
  m({ occurred_on: `${mesAnt}-10`, amount: 50, category: "Transporte", concept: "Taxi" }),
];
const t = await token();
const r = await fetch(`${U}/rest/v1/fin_transactions`, { method: "POST", headers: { apikey: K, Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify(datos) });
ok(r.status === 201, "datos sembrados");

const b = await lanzar();
const p = await b.newPage({ viewport: { width: 375, height: 740 } });
const errs = [];
p.on("console", (x) => x.type() === "error" && errs.push(x.text()));
p.on("pageerror", (e) => errs.push(String(e)));
const txt = async (sel) => (await p.locator(sel).innerText()).replace(/\s/g, " ");
await entrar(p);
await p.goto(B + "/dashboard?p=mes");

// Gráfico diario
const barras = p.locator("svg[role=img] path");
ok((await barras.count()) === 2, "2 barras (días con gasto) en el gráfico del mes");
const columnas = p.locator("svg[role=img] rect[role=button]");
const diasMes = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
ok((await columnas.count()) === diasMes, `una columna por día del mes (${diasMes})`);
await columnas.nth(1).hover();
const tip = p.locator("[role=status]").filter({ hasText: "S/" });
await tip.waitFor();
ok((await tip.innerText()).replace(/\s/g, " ").includes("S/ 140.00"), "tooltip al pasar: día 2 → S/ 140.00");
await columnas.nth(0).focus();
ok((await tip.innerText()).replace(/\s/g, " ").includes("S/ 60.00"), "tooltip con teclado (foco): día 1 → S/ 60.00");
await p.mouse.move(5, 5);
await p.click("summary:has-text('Ver como tabla')");
ok((await p.locator("table tbody tr").count()) === 2, "vista de tabla con los días con gasto");
await p.screenshot({ path: "e2e/capturas/51-dashboard-mes.png", fullPage: true });

// Naturaleza
const nat = await txt("section:has(h2:has-text('Necesidades, deseos')) ul");
ok(nat.includes("S/ 60.00") && nat.includes("30 %") && nat.includes("S/ 40.00") && nat.includes("20 %") && nat.includes("S/ 100.00") && nat.includes("50 %"), "necesidades 30 %, deseos 20 %, deudas 50 %");

// Comparación por categoría
const cats = await txt("section:has(h2:has-text('En qué estoy gastando')) ul");
ok(cats.includes("▲ 20 %") && cats.includes("vs. S/ 50.00"), "Transporte ▲ 20 % vs. S/ 50.00");
ok(cats.includes("Nuevo en este periodo"), "categorías sin gasto previo: 'Nuevo en este periodo'");
ok((await txt("[data-testid=comparacion]")).includes("▲ 300 % más"), "comparación global: ▲ 300 % más que el periodo anterior");

// Proyección: solo desde el día 3 del mes
const diaHoy = Number(hoy.slice(8, 10));
if (diaHoy >= 3) {
  const esperado = Math.round((200 / diaHoy) * diasMes * 100) / 100;
  const pr = await txt("[data-testid=proyeccion]");
  ok(pr.includes(esperado.toLocaleString("en-US", { minimumFractionDigits: 2 })), `proyección al cierre: S/ ${esperado}`);
} else {
  ok((await p.locator("[data-testid=proyeccion]").count()) === 0, "sin proyección antes del día 3");
}

// Año: barras por mes
await p.goto(B + "/dashboard?p=anio");
ok((await p.locator("svg[role=img] rect[role=button]").count()) === 12, "periodo Año: 12 columnas (una por mes)");
ok((await p.locator("h2:has-text('Gasto por mes')").count()) === 1, "título 'Gasto por mes'");

// Periodo vacío
await p.goto(B + "/dashboard?p=rango&from=2020-01-01&to=2020-01-31");
ok((await p.getByText("Sin gastos en este periodo.").count()) >= 1, "periodo sin datos: estado vacío, sin gráfico roto");

ok(errs.length === 0, "sin errores en consola" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close();
await reiniciar();
