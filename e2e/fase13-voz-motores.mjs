// Voz sin conexión (Whisper local) y cambio automático de motor.
// Micrófono falso de Chromium con un WAV (0,4 s silencio + 1,2 s "voz" + 3,4 s silencio)
// y worker de Whisper simulado (huggingface.co no es accesible desde el entorno de pruebas).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { B, K, U, entrar, ok, reiniciar, token } from "./comun.mjs";
await reiniciar();

mkdirSync("e2e/capturas", { recursive: true });
const wav = "e2e/capturas/voz-falsa.wav";
if (!existsSync(wav)) {
  execFileSync("ffmpeg", ["-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono:d=0.4",
    "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000:duration=1.2",
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono:d=3.4",
    "-filter_complex", "[1]volume=0.5[v];[0][v][2]concat=n=3:v=0:a=1", "-c:a", "pcm_s16le", wav]);
}

const b = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`, "--autoplay-policy=no-user-gesture-required"],
});

/** Worker simulado: progreso de descarga y transcripciones en orden. */
const workerFalso = (textos, fallaCarga = false) => `
let i = 0; let listo = false;
self.onmessage = async (e) => {
  const m = e.data;
  const cargar = async () => {
    if (listo) return;
    ${fallaCarga ? 'throw new Error("sin internet");' : ""}
    for (const pct of [25, 60, 100]) { self.postMessage({ type: "progreso", pct }); await new Promise((r) => setTimeout(r, 1500)); }
    listo = true;
  };
  try {
    if (m.type === "cargar") { await cargar(); self.postMessage({ type: "listo", ms: 450 }); }
    if (m.type === "transcribir") {
      await cargar();
      const segundos = (m.audio?.length ?? 0) / 16000;
      self.postMessage({ type: "texto", id: m.id, texto: segundos > 0.5 ? ${JSON.stringify(textos)}[i++ % ${textos.length}] : "", ms: 300 });
    }
  } catch (err) { self.postMessage({ type: "error", id: m.id, mensaje: String(err.message) }); }
};`;

/** Registra los streams del micrófono para comprobar que se sueltan. */
const espiarMicrofono = () => {
  window.__streams = [];
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => { const s = await orig(c); window.__streams.push(s); return s; };
};
const sinWebSpeech = () => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; };
/** Web Speech como el de un iPhone afectado: abre el micrófono y nunca devuelve texto. */
const webSpeechMudo = () => {
  class Mudo { start() { setTimeout(() => { this.onstart?.(); this.onaudiostart?.(); }, 30); }
    stop() { setTimeout(() => this.onend?.(), 10); } abort() { this.onend?.(); } }
  window.SpeechRecognition = Mudo; window.webkitSpeechRecognition = Mudo;
};

async function nuevaPagina(scripts, textos, fallaCarga) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 740 }, permissions: ["microphone"] });
  for (const s of scripts) await ctx.addInitScript(s);
  await ctx.route("**/whisper-worker.js", (r) => r.fulfill({ contentType: "text/javascript", body: workerFalso(textos, fallaCarga) }));
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await entrar(p);
  return { ctx, p, errs };
}

const tarjeta = (p) => p.locator(".card.pop-in").first();
const textoTarjeta = async (p) => (await tarjeta(p).innerText()).replace(/\s+/g, " ");

// 1. Navegador sin Web Speech (como Firefox): Whisper local, 3 dictados seguidos
{
  const { ctx, p, errs } = await nuevaPagina([espiarMicrofono, sinWebSpeech], ["18 soles taxi", "8 soles pan", "5 soles agua"]);
  await p.goto(B + "/?voz=debug");
  const mic = p.getByRole("button", { name: "Registrar por voz" });
  await mic.waitFor();
  ok(true, "sin Web Speech el micrófono igual aparece (usa Whisper)");
  for (const [monto, n] of [["18.00", 1], ["8.00", 2], ["5.00", 3]]) {
    await mic.click();
    if (n === 1) {
      await p.getByTestId("voz-preparando").waitFor({ timeout: 10000 });
      ok(true, "primer uso: «Preparando voz sin conexión…» con progreso");
    }
    await tarjeta(p).waitFor({ timeout: 20000 });
    ok((await textoTarjeta(p)).includes(`S/ ${monto}`), `dictado ${n} con Whisper → S/ ${monto}`);
    const libres = await p.evaluate(() => window.__streams.every((s) => s.getTracks().every((t) => t.readyState === "ended")));
    ok(libres, `dictado ${n}: el micrófono quedó liberado`);
    await p.click("button:has-text('Confirmar')");
    await p.getByRole("status").filter({ hasText: monto }).waitFor();
  }
  const diag = await p.getByTestId("voz-diagnostico").innerText();
  ok(diag.includes("motor whisper") && diag.includes("micrófono liberado") && /whisper \d+ ms/.test(diag), "diagnóstico muestra motor, liberación y tiempo de Whisper");

  // Cancelar descarta lo grabado
  await mic.click();
  await p.getByRole("button", { name: "Cancelar" }).click();
  await p.waitForTimeout(2500);
  ok(await tarjeta(p).count() === 0, "Cancelar descarta el audio (no aparece tarjeta)");
  ok(await p.evaluate(() => window.__streams.every((s) => s.getTracks().every((t) => t.readyState === "ended"))), "tras cancelar, micrófono liberado");

  const t = await token();
  const filas = await (await fetch(`${U}/rest/v1/fin_transactions?select=amount,source`, { headers: { apikey: K, Authorization: `Bearer ${t}` } })).json();
  ok(filas.length === 3 && filas.every((f) => f.source === "voz"), "3 movimientos guardados con fuente 'voz'");
  ok(errs.length === 0, `sin errores de página ${errs.join(" | ")}`);
  await ctx.close();
}

// 2. iPhone afectado: Web Speech abre el micrófono sin texto → Reintentar usa Whisper y queda recordado
{
  const { ctx, p, errs } = await nuevaPagina([espiarMicrofono, webSpeechMudo], ["12 soles almuerzo", "3 soles pan"]);
  await p.goto(B + "/");
  await p.evaluate(() => { localStorage.removeItem("voz-navegador-falla"); localStorage.removeItem("voz-recargar"); });
  const mic = p.getByRole("button", { name: "Registrar por voz" });
  await mic.click();
  await p.getByText("usaré la voz sin conexión").waitFor({ timeout: 12000 });
  ok(true, "Web Speech sin texto: avisa que pasará a la voz sin conexión");
  ok(await p.evaluate(() => localStorage.getItem("voz-navegador-falla")) === "1", "el fallo queda recordado en el dispositivo");
  await p.getByRole("button", { name: "Reintentar" }).click();
  await tarjeta(p).waitFor({ timeout: 20000 });
  ok((await textoTarjeta(p)).includes("S/ 12.00"), "Reintentar transcribe con Whisper");
  await p.click("button:has-text('Confirmar')");
  await p.getByRole("status").filter({ hasText: "Registrado" }).waitFor();
  ok((await p.evaluate(() => location.search)) === "" && await mic.isVisible(), "no recarga la página tras dictar con Whisper");
  await mic.click();
  await tarjeta(p).waitFor({ timeout: 20000 });
  ok((await textoTarjeta(p)).includes("S/ 3.00"), "el siguiente dictado va directo a Whisper y funciona");
  ok(errs.length === 0, `sin errores de página ${errs.join(" | ")}`);
  await ctx.close();
}

// 3. Sin internet para descargar el modelo → mensaje claro y alternativa del teclado
{
  const { ctx, p } = await nuevaPagina([sinWebSpeech], ["x"], true);
  await p.goto(B + "/");
  await p.evaluate(() => localStorage.removeItem("whisper-listo"));
  await p.getByRole("button", { name: "Registrar por voz" }).click();
  await p.getByText("Sin internet para preparar la voz").waitFor({ timeout: 15000 });
  ok(await p.getByRole("button", { name: "Dictar con el teclado" }).isVisible(), "fallo de descarga: mensaje y «Dictar con el teclado»");
  await ctx.close();
}

// 4. Configuración: motor de voz y descarga anticipada
{
  const { ctx, p } = await nuevaPagina([], ["x"]);
  await p.goto(B + "/configuracion");
  await p.evaluate(() => localStorage.removeItem("whisper-listo"));
  await p.reload();
  await p.getByLabel("Motor de voz").selectOption("whisper");
  await p.getByTestId("estado-ajustes").filter({ hasText: "Guardado" }).waitFor();
  await p.getByRole("button", { name: /Descargar voz sin conexión/ }).click();
  await p.getByTestId("voz-descargada").waitFor({ timeout: 10000 });
  ok(true, "descarga anticipada del modelo desde Configuración");
  await p.reload();
  ok(await p.getByLabel("Motor de voz").inputValue() === "whisper", "el motor elegido persiste");
  await p.getByLabel("Motor de voz").selectOption("auto");
  await p.getByTestId("estado-ajustes").filter({ hasText: "Guardado" }).waitFor();
  await ctx.close();
}

await b.close();
await reiniciar();
