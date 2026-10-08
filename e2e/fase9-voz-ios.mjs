// Reconocimiento de voz al estilo Safari (iPhone): modo continuo sin fin propio,
// pausas entre tramos, resultados acumulativos, varias alternativas y arranques fallidos.
import { B, K, U, entrar, lanzar, ok, reiniciar, token } from "./comun.mjs";
await reiniciar();

const fake = () => {
  // window.__guion: lista de pasos { ms, resultados: [[alt1, alt2…], …] } o { ms, fin: true }
  window.__intentos = 0;
  class SafariRec {
    start() {
      window.__intentos++;
      const guion = window.__guiones.shift() ?? [];
      // Modelo iPhone del usuario: solo el primer start() de cada carga de página devuelve texto.
      window.__starts = (window.__starts ?? 0) + 1;
      if (localStorage.getItem("fake-solo-primero") === "1" && window.__starts > 1) {
        window.__guiones.unshift(guion); setTimeout(() => this.onaudiostart?.(), 20); return;
      }
      // Modelo iOS (observado en un iPhone real): solo el primer reconocedor devuelve texto;
      // los creados después abren el micrófono (audiostart) pero nunca entregan resultados.
      if (window.__modoIOS) {
        window.__primera ??= this;
        if (this !== window.__primera) { window.__sinAudio = (window.__sinAudio ?? 0) + 1; setTimeout(() => this.onaudiostart?.(), 20); return; }
      }
      // Fallo de algunos iPhone: en modo continuo abre el micrófono pero nunca devuelve texto.
      if (window.__soloSimple && this.continuous) { setTimeout(() => this.onaudiostart?.(), 20); window.__guiones.unshift(guion); return; }
      this._colgado = guion.some((p) => p.colgado);
      this._ts = guion.map((paso) => setTimeout(() => {
        if (paso.fin) { this.onend?.(); return; }
        if (paso.colgado) return;
        const results = paso.resultados.map((alts, i) => {
          const r = { isFinal: i < paso.resultados.length - 1 || !!paso.final, length: alts.length };
          alts.forEach((t, j) => { r[j] = { transcript: t }; });
          return r;
        });
        this.onresult?.({ resultIndex: 0, results });
      }, paso.ms));
    }
    stop() { this._ts?.forEach(clearTimeout); if (!this._colgado) setTimeout(() => this.onend?.(), 10); }
    abort() { window.__abortos = (window.__abortos ?? 0) + 1; this._ts?.forEach(clearTimeout); this.onerror?.({ error: "aborted" }); this.onend?.(); }
  }
  window.SpeechRecognition = SafariRec;
  window.webkitSpeechRecognition = SafariRec;
};

const b = await lanzar();
const ctx = await b.newContext({ viewport: { width: 375, height: 740 } });
await ctx.addInitScript(fake);
const p = await ctx.newPage();
const errs = [];
p.on("console", (x) => x.type() === "error" && errs.push(x.text()));
p.on("pageerror", (e) => errs.push(String(e)));
await entrar(p);
const mic = p.getByRole("button", { name: "Registrar por voz" });
await mic.waitFor();
const card = p.locator(".card.pop-in").first();
const tarjeta = async () => (await card.innerText()).replace(/\s+/g, " ");
const dictar = async (guiones) => {
  await p.evaluate((g) => { window.__guiones = g; }, guiones);
  await mic.click();
};

// 1. Frase con pausa: "dieciocho soles" … (pausa 1 s) … "taxi". Antes cortaba en la pausa.
await dictar([[
  { ms: 200, resultados: [["dieciocho soles"]] },
  { ms: 1200, resultados: [["dieciocho soles"], ["taxi"]], final: true },
]]);
await card.waitFor({ timeout: 8000 });
ok((await tarjeta()).includes("S/ 18.00") && (await tarjeta()).includes("Taxi"), "frase con pausa llega completa: S/ 18.00 · Taxi");
await p.click("button:has-text('Editar')"); await p.click("button:has-text('Cancelar')");

// 2. Resultados acumulativos de Safari: no se duplica el monto
await dictar([[
  { ms: 200, resultados: [["un sol veinte"]] },
  { ms: 600, resultados: [["un sol veinte"], ["un sol veinte pasaje"]], final: true },
]]);
await card.waitFor({ timeout: 8000 });
ok((await tarjeta()).includes("S/ 1.20") && (await tarjeta()).includes("Pasaje"), "acumulativos sin duplicar: S/ 1.20 · Pasaje");
await p.click("button:has-text('Editar')"); await p.click("button:has-text('Cancelar')");

// 3. Alternativas: la 1.ª sin monto, la 2.ª con monto → usa la 2.ª
await dictar([[
  { ms: 300, resultados: [["treinta y cinco solas almuerzo", "35 soles almuerzo", "treinta cinco almuerzo"]], final: true },
]]);
await card.waitFor({ timeout: 8000 });
ok((await tarjeta()).includes("S/ 35.00") && (await tarjeta()).includes("Almuerzo"), "elige la alternativa con monto: S/ 35.00 · Almuerzo");
await p.click("button:has-text('Confirmar')");
await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();

// 4. Arranque fallido de iOS (termina al instante sin audio) → reintento silencioso
await dictar([
  [{ ms: 50, fin: true }],
  [{ ms: 300, resultados: [["45 soles pollo a la brasa"]], final: true }],
]);
await card.waitFor({ timeout: 8000 });
ok((await tarjeta()).includes("S/ 45.00") && /deseo/i.test(await tarjeta()), "reintenta solo tras un arranque fallido: S/ 45.00 · deseo");
ok((await p.evaluate(() => window.__intentos)) >= 2, "hubo un segundo intento automático");
await p.click("button:has-text('Editar')"); await p.click("button:has-text('Cancelar')");

// 5. Dos fallos seguidos → mensaje con la alternativa del teclado
await dictar([[{ ms: 50, fin: true }], [{ ms: 50, fin: true }]]);
await p.getByText("micrófono del teclado").waitFor({ timeout: 8000 });
ok(true, "si falla dos veces, sugiere el dictado del teclado");

// 6. Varios dictados seguidos con registro en medio (el fallo reportado en iPhone)
await p.evaluate(() => { window.__modoIOS = true; window.__primera = undefined; window.__sinAudio = 0; });
for (const [frase, monto] of [["12 soles taxi", "12.00"], ["8 soles pan", "8.00"], ["20 soles gasolina", "20.00"]]) {
  await dictar([[{ ms: 300, resultados: [[frase]], final: true }]]);
  await card.waitFor({ timeout: 8000 });
  ok((await tarjeta()).includes(`S/ ${monto}`), `dictado seguido: ${frase}`);
  await p.click("button:has-text('Confirmar')");
  await p.getByRole("status").filter({ hasText: `Registrado` }).filter({ hasText: monto }).waitFor();
}
ok((await p.evaluate(() => window.__sinAudio)) === 0, "se reutiliza el mismo reconocedor: el 2.º y 3.º dictado también devuelven texto");
ok((await p.evaluate(() => document.activeElement?.tagName)) !== "INPUT", "tras dictar, el foco no va al campo de texto");

// 7. iOS no avisa el fin tras stop(): el seguro cierra igual y el siguiente toque funciona
await dictar([[{ ms: 300, resultados: [["5 soles agua"]] }, { ms: 400, colgado: true }]]);
await card.waitFor({ timeout: 8000 });
ok((await tarjeta()).includes("S/ 5.00"), "sin onend: se procesa igual (watchdog)");
await p.click("button:has-text('Editar')"); await p.click("button:has-text('Cancelar')");
await dictar([[{ ms: 300, resultados: [["9 soles menú"]], final: true }]]);
await card.waitFor({ timeout: 8000 });
ok((await tarjeta()).includes("S/ 9.00"), "y el siguiente dictado funciona");
await p.click("button:has-text('Editar')"); await p.click("button:has-text('Cancelar')");

// 8. No llega audio → mensaje claro y botón Reintentar
await dictar([[]]);
await p.getByText("El micrófono no respondió").waitFor({ timeout: 10000 });
ok(true, "sin audio: «El micrófono no respondió»");
await p.evaluate(() => { window.__guiones = [[{ ms: 300, resultados: [["15 soles almuerzo"]], final: true }]]; });
await p.getByRole("button", { name: "Reintentar" }).click();
await card.waitFor({ timeout: 8000 });
ok((await tarjeta()).includes("S/ 15.00"), "Reintentar vuelve a escuchar");
await p.click("button:has-text('Editar')"); await p.click("button:has-text('Cancelar')");

// 10. Micrófono abierto pero sin texto en modo continuo → mensaje y Reintentar usa el modo simple
await p.evaluate(() => { localStorage.setItem("voz-modo", "continuo"); window.__soloSimple = true; window.__modoIOS = false; });
await dictar([[{ ms: 300, resultados: [["7 soles pan"]], final: true }]]);
await p.getByText("no llegó texto").waitFor({ timeout: 10000 });
ok(true, "audio sin texto: avisa y sugiere revisar el Dictado");
ok((await p.evaluate(() => localStorage.getItem("voz-modo"))) === "simple", "el próximo intento usará el modo simple");
await p.getByRole("button", { name: "Reintentar" }).click();
await card.waitFor({ timeout: 8000 });
ok((await tarjeta()).includes("S/ 7.00"), "Reintentar en modo simple funciona");
await p.click("button:has-text('Editar')"); await p.click("button:has-text('Cancelar')");
await p.evaluate(() => { window.__soloSimple = false; localStorage.removeItem("voz-recargar"); });

// 11. Varios gastos en una frase dictada
await dictar([[{ ms: 300, resultados: [["Un sol taxi dos soles pasaje"]], final: true }]]);
const varios = p.locator("[aria-label='Varios movimientos']");
await varios.waitFor({ timeout: 8000 });
const tv = (await varios.innerText()).replace(/\s+/g, " ");
ok(tv.includes("Entendí 2 movimientos") && tv.includes("S/ 1.00") && tv.includes("S/ 2.00") && tv.includes("Total S/ 3.00"), "«un sol taxi dos soles pasaje» → 2 movimientos");
await varios.getByRole("button", { name: "Confirmar 2" }).click();
await p.getByRole("status").filter({ hasText: "Registrados 2 movimientos" }).waitFor();
ok(true, "confirmar registra los dos");

// 12. iPhone donde solo el 1.er dictado de cada carga funciona → recarga automática tras dictar
await p.evaluate(() => { localStorage.setItem("fake-solo-primero", "1"); localStorage.removeItem("voz-recargar"); });
await p.reload();
await mic.waitFor();
await dictar([[{ ms: 300, resultados: [["4 soles pan"]], final: true }]]);
await card.waitFor({ timeout: 8000 });
await p.click("button:has-text('Confirmar')");
await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();
await dictar([[{ ms: 300, resultados: [["6 soles leche"]], final: true }]]);
await p.getByText("no llegó texto").waitFor({ timeout: 10000 });
ok((await p.evaluate(() => localStorage.getItem("voz-recargar"))) === "1", "detecta el fallo del 2.º dictado y activa la recarga");

// 12b. Mientras tanto, «Dictar con el teclado» interpreta solo
await p.getByRole("button", { name: "Dictar con el teclado" }).click();
ok(await p.evaluate(() => document.activeElement?.getAttribute("aria-label")) === "Describe tu movimiento", "abre el campo para el micrófono del teclado");
await p.fill("[aria-label='Describe tu movimiento']", "6 soles leche");
await card.waitFor({ timeout: 6000 });
ok((await tarjeta()).includes("S/ 6.00"), "el dictado del teclado se interpreta sin tocar Listo");
await p.click("button:has-text('Confirmar')");
await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();

// 12c. Con la recarga activa: dictar → confirmar → la página se recarga → el siguiente dictado funciona
await dictar([[{ ms: 300, resultados: [["2 soles caramelo"]], final: true }]]).catch(() => {});
await p.reload(); // el usuario vuelve a entrar: primer dictado de la carga
await mic.waitFor();
await dictar([[{ ms: 300, resultados: [["3 soles agua"]], final: true }]]);
await card.waitFor({ timeout: 8000 });
await Promise.all([p.waitForEvent("framenavigated"), p.click("button:has-text('Confirmar')")]);
await p.getByRole("status").filter({ hasText: "Registrado: Agua" }).waitFor({ timeout: 10000 });
ok(true, "tras dictar se recarga sola y muestra el aviso");
await dictar([[{ ms: 300, resultados: [["5 soles fruta"]], final: true }]]);
await card.waitFor({ timeout: 8000 });
ok((await tarjeta()).includes("S/ 5.00"), "el siguiente dictado funciona (vuelve a ser el primero)");
await p.click("button:has-text('Editar')"); await p.click("button:has-text('Cancelar')");
await p.evaluate(() => { localStorage.removeItem("fake-solo-primero"); localStorage.removeItem("voz-recargar"); });

// 9. Diagnóstico con ?voz=debug
await p.goto(B + "/?voz=debug");
await p.evaluate(() => { window.__guiones = [[{ ms: 200, resultados: [["3 soles pan"]], final: true }]]; });
await p.getByRole("button", { name: "Registrar por voz" }).click();
await card.waitFor({ timeout: 8000 });
const diag = await p.getByTestId("voz-diagnostico").innerText();
ok(diag.includes("start()") && diag.includes("result") && diag.includes("stop"), "panel de diagnóstico con los eventos");

const t = await token();
const fila = await (await fetch(`${U}/rest/v1/fin_transactions?select=amount,source,category,nature`, { headers: { apikey: K, Authorization: `Bearer ${t}` } })).json();
ok(fila.length === 9 && fila.every((f) => f.source === "voz"), `9 movimientos guardados con fuente 'voz' (${fila.length})`);
ok(errs.length === 0, "sin errores en consola" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close();
await reiniciar();
