// Utilidades compartidas por las pruebas end-to-end.
// Requiere: la app corriendo (BASE_URL) y una cuenta de prueba confirmada en Supabase.
import { chromium } from "playwright-core";

export const B = process.env.BASE_URL ?? "http://localhost:3000";
export const EMAIL = process.env.E2E_EMAIL;
export const PASSWORD = process.env.E2E_PASSWORD;
export const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!EMAIL || !PASSWORD || !U || !K) {
  console.error("Faltan E2E_EMAIL, E2E_PASSWORD, NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(2);
}

export const lanzar = () =>
  chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

export const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

export async function token() {
  const r = await fetch(`${U}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: K, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  return (await r.json()).access_token;
}

/** Deja la cuenta de prueba vacía (RLS limita el borrado a sus propias filas). */
export async function reiniciar() {
  const t = await token();
  for (const tabla of ["fin_transactions", "fin_preferences", "fin_categories"]) {
    await fetch(`${U}/rest/v1/${tabla}?id=not.is.null`, { method: "DELETE", headers: { apikey: K, Authorization: `Bearer ${t}` } });
  }
}

export async function entrar(p) {
  await p.goto(B + "/login");
  await p.fill("#email", EMAIL);
  await p.fill("#password", PASSWORD);
  await p.click("button:has-text('Entrar')");
  await p.waitForURL(B + "/");
}
