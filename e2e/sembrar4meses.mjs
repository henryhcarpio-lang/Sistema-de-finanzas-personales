// Historial de 4 meses para probar el resumen inteligente.
import { K, U, token } from "./comun.mjs";

export const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
export async function sembrar4Meses() {
  const [y, m] = hoy.split("-").map(Number);
  const mes = (k) => { let mm = m - k, yy = y; while (mm < 1) { mm += 12; yy--; } return `${yy}-${String(mm).padStart(2, "0")}`; };
  const f = (o) => ({ currency: "PEN", source: "texto", nature: "necesidad", tags: [], note: null, type: "egreso", ...o });
  const datos = [];
  for (const k of [1, 2, 3]) {
    for (const d of ["01", "02"]) datos.push(f({ occurred_on: `${mes(k)}-${d}`, amount: 25, category: "Transporte", concept: "Taxi" }));
    for (const d of ["01", "02", "03", "15"]) datos.push(f({ occurred_on: `${mes(k)}-${d}`, amount: 40, category: "Salud", concept: "Farmacia" }));
    datos.push(f({ occurred_on: `${mes(k)}-01`, amount: 3000, category: "Trabajo", concept: "Sueldo", type: "ingreso", nature: null }));
    datos.push(f({ occurred_on: `${mes(k)}-02`, amount: 60, category: "Almuerzo / comida fuera", concept: "Pizza", nature: "deseo" }));
  }
  // Mes actual (días 1 y 2 para que valga cualquier fecha): un atípico en Salud y Transporte en aumento
  datos.push(f({ occurred_on: `${mes(0)}-01`, amount: 3000, category: "Trabajo", concept: "Sueldo", type: "ingreso", nature: null }));
  datos.push(f({ occurred_on: `${mes(0)}-01`, amount: 220, category: "Salud", concept: "Dentista" }));
  // Transporte crece con viajes normales (S/ 30, no atípicos): 4 viajes vs 2 a la misma fecha.
  for (const d of ["01", "01", "02", "02"]) datos.push(f({ occurred_on: `${mes(0)}-${d}`, amount: 30, category: "Transporte", concept: "Taxi" }));
  const t = await token();
  const r = await fetch(`${U}/rest/v1/fin_transactions`, { method: "POST", headers: { apikey: K, Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify(datos) });
  if (r.status !== 201) throw new Error(`No se pudo sembrar: ${r.status} ${await r.text()}`);
}
