// Diseño táctil: tamaños mínimos en celular y distribución en computadora.
import { B, entrar, lanzar, ok, reiniciar } from "./comun.mjs";
import { sembrar4Meses } from "./sembrar4meses.mjs";
await reiniciar();
await sembrar4Meses();

const RUTAS = ["/", "/dashboard", "/movimientos", "/movimientos?p=ayer", "/presupuestos", "/pagos", "/categorias"];
const b = await lanzar();

async function revisar(p) {
  return p.evaluate(() => {
    const visibles = (sel) => [...document.querySelectorAll(sel)].filter((e) => {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !e.closest("[aria-hidden=true]") && !e.closest("table");
    });
    const chicos = visibles("a, button, summary, select, input:not([type=hidden]), [role=button]")
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ e, r }) => !(e.tagName === "rect") && (r.height < 44 || r.width < 40))
      .map(({ e, r }) => `${e.tagName.toLowerCase()} "${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 25)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    const letraChica = visibles("a, button, summary, label, select, input:not([type=hidden])")
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 11.9)
      .map((e) => `${e.tagName.toLowerCase()} "${(e.textContent || "").trim().slice(0, 20)}" ${getComputedStyle(e).fontSize}`);
    const inputsZoom = visibles("input:not([type=hidden]), select, textarea").filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length;
    return { chicos, letraChica, inputsZoom, ancho: document.documentElement.scrollWidth };
  });
}

// Celular (iPhone)
const movil = await b.newPage({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true });
await entrar(movil);
for (const ruta of RUTAS) {
  await movil.goto(B + ruta);
  await movil.waitForLoadState("networkidle");
  const r = await revisar(movil);
  ok(r.chicos.length === 0, `${ruta}: todo lo tocable ≥ 44 px` + (r.chicos.length ? " — " + r.chicos.join("; ") : ""));
  ok(r.letraChica.length === 0, `${ruta}: texto de controles ≥ 12 px` + (r.letraChica.length ? " — " + r.letraChica.join("; ") : ""));
  ok(r.inputsZoom === 0, `${ruta}: campos a 16 px (sin zoom de iOS)`);
  ok(r.ancho <= 375, `${ruta}: sin scroll horizontal`);
}
const nav = movil.getByRole("navigation", { name: "Principal" });
const anchos = await nav.locator("a").evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().width)));
ok(anchos.length === 5 && anchos.every((w) => w >= 70), `barra inferior: 5 zonas anchas (${anchos.join(", ")} px)`);
for (const [ruta, nombre] of [["/", "registrar"], ["/dashboard", "dashboard"], ["/movimientos", "movimientos"]]) {
  await movil.goto(B + ruta);
  await movil.screenshot({ path: `e2e/capturas/a1-movil-${nombre}.png`, fullPage: true });
}

// Computadora
const pc = await b.newPage({ viewport: { width: 1280, height: 860 } });
await entrar(pc);
await pc.goto(B + "/dashboard");
ok(await pc.locator("aside").isVisible(), "computadora: barra lateral visible");
ok(!(await pc.locator("nav.fixed").isVisible()), "computadora: sin barra inferior");
const cols = await pc.locator("main > div > div.lg\\:grid > div").evaluateAll((ds) => ds.map((d) => Math.round(d.getBoundingClientRect().left)));
ok(cols.length === 2 && cols[1] > cols[0] + 200, `Dashboard a dos columnas (${cols.join(", ")})`);
await pc.screenshot({ path: "e2e/capturas/a2-pc-dashboard.png", fullPage: true });
await pc.goto(B + "/");
await pc.screenshot({ path: "e2e/capturas/a3-pc-registrar.png", fullPage: true });

await b.close();
await reiniciar();
