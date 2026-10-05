// Reconocimiento de voz al estilo Safari (iPhone): modo continuo sin fin propio,
// pausas entre tramos, resultados acumulativos, varias alternativas y arranques fallidos.
import { K, U, entrar, lanzar, ok, reiniciar, token } from "./comun.mjs";
await reiniciar();

const fake = () => {
  // window.__guion: lista de pasos { ms, resultados: [[alt1, alt2…], …] } o { ms, fin: true }
  window.__intentos = 0;
  class SafariRec {
    start() {
      window.__intentos++;
      const guion = window.__guiones.shift() ?? [];
      this._ts = guion.map((paso) => setTimeout(() => {
        if (paso.fin) { this.onend?.(); return; }
        const results = paso.resultados.map((alts, i) => {
          const r = { isFinal: i < paso.resultados.length - 1 || !!paso.final, length: alts.length };
          alts.forEach((t, j) => { r[j] = { transcript: t }; });
          return r;
        });
        this.onresult?.({ resultIndex: 0, results });
      }, paso.ms));
    }
    stop() { this._ts?.forEach(clearTimeout); setTimeout(() => this.onend?.(), 10); }
    abort() { this._ts?.forEach(clearTimeout); this.onerror?.({ error: "aborted" }); this.onend?.(); }
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

const t = await token();
const fila = await (await fetch(`${U}/rest/v1/fin_transactions?select=amount,source,category,nature`, { headers: { apikey: K, Authorization: `Bearer ${t}` } })).json();
ok(fila.length === 1 && fila[0].source === "voz" && Number(fila[0].amount) === 35, "guardado con fuente 'voz'");
ok(errs.length === 0, "sin errores en consola" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close();
await reiniciar();
