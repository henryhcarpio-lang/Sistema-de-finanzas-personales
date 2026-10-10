import { K, U, entrar, lanzar, ok, reiniciar, token } from "./comun.mjs";
await reiniciar();
const b = await lanzar();
let n = 30;

// Reconocedor falso: lo que "dice" el usuario se controla con window.__voz.
const fake = () => {
  window.__voz = { frase: "dieciocho soles taxi", error: null };
  class FakeRec {
    start() {
      const { frase, error } = window.__voz;
      setTimeout(() => {
        if (error) { this.onerror?.({ error }); this.onend?.(); return; }
        const parcial = frase.split(" ").slice(0, 2).join(" ");
        this.onresult?.({ resultIndex: 0, results: [{ isFinal: false, length: 1, 0: { transcript: parcial } }] });
      }, 300);
      if (!error) this._t = setTimeout(() => {
        this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, length: 1, 0: { transcript: frase } }] });
        this.onend?.();
      }, 1500);
    }
    stop() { clearTimeout(this._t); this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, length: 1, 0: { transcript: window.__voz.frase } }] }); this.onend?.(); }
    abort() { clearTimeout(this._t); this.onerror?.({ error: "aborted" }); this.onend?.(); }
  }
  window.webkitSpeechRecognition = FakeRec;
  window.SpeechRecognition = FakeRec;
};

async function nueva(conVoz) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 740 } });
  if (conVoz) await ctx.addInitScript(fake);
  const p = await ctx.newPage();
  p.errs = [];
  p.on("console", (m) => m.type() === "error" && p.errs.push(m.text()));
  p.on("pageerror", (e) => p.errs.push(String(e)));
  await entrar(p);
  return p;
}

const p = await nueva(true);
const shot = (name) => p.screenshot({ path: `e2e/capturas/${++n}-${name}.png`, fullPage: true });
const estado = p.getByTestId("estado-voz");
const mic = p.getByRole("button", { name: "Registrar por voz" });
await mic.waitFor(); ok(await mic.isVisible(), "micrófono visible cuando el navegador soporta voz");
await shot("voz-inicio");

// 1. Flujo completo
await mic.click();
await p.getByText("Escuchando…").waitFor();
ok(await p.getByRole("button", { name: "Terminar de escuchar" }).getAttribute("aria-pressed") === "true", "estado 'escuchando' (aria-pressed)");
await p.getByText("“dieciocho soles”").waitFor();
ok(true, "muestra la transcripción parcial en vivo");
await shot("voz-escuchando");
const card = p.locator(".card.pop-in").first();
await card.waitFor();
const txt = await card.innerText();
ok(/S\/\s?18\.00/.test(txt) && txt.includes("Transporte") && txt.includes("Taxi"), "termina sola → tarjeta S/ 18.00 · Transporte · Taxi");
await shot("voz-confirmar");
await p.click("button:has-text('Confirmar')");
await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();
ok(true, "registrado sin cambiar de pantalla");

// Verificar source = 'voz' en la base de datos
const tok = { access_token: await token() };
const filas = await (await fetch(`${U}/rest/v1/fin_transactions?select=amount,source,concept&order=created_at.desc&limit=1`, { headers: { apikey: K, Authorization: `Bearer ${tok.access_token}` } })).json();
ok(filas[0]?.source === "voz" && Number(filas[0]?.amount) === 18, "guardado con fuente 'voz' en la base de datos");

// 2. Detener con "Terminar" y céntimos
await p.evaluate(() => { window.__voz.frase = "treinta y cinco soles con cincuenta almuerzo"; });
await mic.click();
await p.getByRole("button", { name: "Terminar", exact: true }).click();
await card.waitFor();
ok(/S\/\s?35\.50/.test(await card.innerText()), "botón 'Terminar' → S/ 35.50 almuerzo");
await p.click("button:has-text('Editar')");
await p.click("button:has-text('Cancelar')");

// 3. Cancelar
await mic.click();
await p.getByText("Escuchando…").waitFor();
await p.getByRole("button", { name: "Cancelar" }).click();
await p.waitForTimeout(1800);
ok((await p.locator(".card.pop-in").count()) === 0 && (await estado.innerText()).includes("Toca y dicta"), "'Cancelar' descarta lo escuchado");

// 4. Sin monto → se copia al campo
await p.evaluate(() => { window.__voz.frase = "compré pan"; });
await mic.click();
await p.getByText("Entendí «compré pan»").waitFor();
ok((await p.getByLabel("Describe tu movimiento").inputValue()) === "compré pan", "sin monto: lo entendido queda en el campo para corregir");

// 5. Permiso denegado
await p.evaluate(() => { window.__voz.error = "not-allowed"; });
await mic.click();
await p.getByText("Permite el uso del micrófono").waitFor();
ok(true, "permiso denegado → mensaje claro");
await shot("voz-error");
ok(p.errs.length === 0, "sin errores en consola" + (p.errs.length ? ": " + p.errs.join(" | ") : ""));

// 6. Navegador sin ningún soporte de voz (ni Web Speech ni grabación para Whisper local)
const ctx2 = await b.newContext({ viewport: { width: 375, height: 740 } });
await ctx2.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; delete window.MediaRecorder; });
const q = await ctx2.newPage();
await entrar(q);
await q.getByLabel("Describe tu movimiento").waitFor();
await q.waitForTimeout(500);
ok((await q.getByRole("button", { name: "Registrar por voz" }).count()) === 0, "sin soporte: micrófono oculto");
ok(await q.getByLabel("Describe tu movimiento").isVisible(), "sin soporte: el registro por texto sigue disponible");
await b.close();
