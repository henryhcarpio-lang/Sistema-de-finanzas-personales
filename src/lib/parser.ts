import { todayLima } from "./dates";
import { extraerFecha } from "./fechaFrase";
import { extraerMonto } from "./montos";
import type { Draft, Naturaleza, Preferencia, Tipo } from "./types";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Clave con la que se guarda una preferencia aprendida ("Pasaje" → "pasaje"). */
export const claveConcepto = (concept: string) =>
  norm(concept).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

/** Preferencia cuya clave aparece como palabras completas en el texto; gana la más larga. */
function buscarPreferencia(texto: string, prefs: Preferencia[]): Preferencia | undefined {
  const t = ` ${claveConcepto(texto)} `;
  return prefs
    .filter((p) => p.keyword && t.includes(` ${p.keyword} `))
    .sort((a, b) => b.keyword.length - a.keyword.length || b.hits - a.hits)[0];
}

interface Regla {
  words: string[];
  category: string;
  nature: Naturaleza;
  tag?: string;
}

const REGLAS: Regla[] = [
  { words: ["taxi", "uber", "cabify", "indrive"], category: "Transporte", nature: "necesidad", tag: "Taxi" },
  { words: ["pasaje", "bus", "combi", "metro", "gasolina", "peaje", "movilidad", "colectivo"], category: "Transporte", nature: "necesidad" },
  { words: ["almuerzo", "menu", "desayuno", "cena", "comida", "restaurante", "cafe", "pollo", "pizza", "chifa"], category: "Almuerzo / comida fuera", nature: "necesidad" },
  { words: ["supermercado", "plaza vea", "wong", "metro", "tottus", "mercado", "verduras", "frutas"], category: "Supermercado", nature: "necesidad" },
  { words: ["alquiler", "renta", "hipoteca", "mantenimiento"], category: "Vivienda", nature: "necesidad" },
  { words: ["luz", "agua", "internet", "gas", "celular", "telefono", "recibo"], category: "Servicios", nature: "necesidad" },
  { words: ["medicina", "farmacia", "doctor", "consulta", "clinica", "dentista", "pastillas"], category: "Salud", nature: "necesidad" },
  { words: ["curso", "libro", "universidad", "colegio", "pension", "matricula", "clase"], category: "Educación", nature: "necesidad" },
  { words: ["cine", "juego", "videojuego", "concierto", "fiesta", "bar", "trago", "salida", "paseo"], category: "Entretenimiento", nature: "deseo" },
  { words: ["ropa", "zapatillas", "zapatos", "polo", "regalo", "compra", "amazon", "tecnologia"], category: "Compras", nature: "deseo" },
  { words: ["netflix", "spotify", "suscripcion", "youtube", "disney", "hbo", "gimnasio", "gym", "prime"], category: "Suscripciones", nature: "deseo" },
  { words: ["oficina", "herramientas", "coworking", "hosting", "dominio"], category: "Trabajo", nature: "necesidad" },
];

const INGRESO = /\b(deposit|me pagaron|cobre|cobro|sueldo|salario|ingreso|recibi|me transfirieron|me abonaron|honorarios|freelance)/;
const AHORRO = /\b(separe|ahorre|ahorro|aparte|guarde|fondo de emergencia)/;
const DEUDA = /\b(prestamo|cuota|tarjeta de credito|deuda|credito|financiamiento)/;
const BANCO = /\b(banco|bcp|bbva|interbank|scotiabank|yape|plin)\b/;
const PAGUE = /\b(pague|pago|abone|cancele)\b/;

function limpiarConcepto(resto: string): string {
  const s = resto
    .replace(/(?<!\p{L})(gast[eé]|pagu[eé]|compr[eé]|de|del|en|por|soles?|sol|me|el|la|los|las|un|una|unos|unas|para|con|fue|fueron|a)(?!\p{L})/giu, " ")
    .replace(/s\/\.?/gi, " ")
    .replace(/[.,;:¡!¿?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const out = s || resto.replace(/[.,;:¡!¿?]/g, " ").replace(/\s+/g, " ").trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : "Movimiento";
}

/**
 * Interpreta lenguaje natural ("Un sol pasaje", "Gasté 18 en taxi").
 * Devuelve null si no se detecta un monto.
 */
export function parseMovimiento(
  texto: string,
  today = todayLima(),
  prefs: Preferencia[] = [],
): Draft | null {
  const input = texto.trim();
  if (!input) return null;
  // La fecha va primero: en "el 3 de octubre 50 soles" el 3 no es el monto.
  const conFecha = extraerFecha(input, today);
  const monto = extraerMonto(conFecha?.resto ?? input);
  if (!monto) return null;

  const n = norm(monto.resto);
  const concept = limpiarConcepto(monto.resto);
  const base = { amount: monto.amount, currency: "PEN" as const, concept, occurred_on: conFecha?.fecha ?? today };

  let type: Tipo = "egreso";
  let nature: Naturaleza | null = null;
  let category = "Otros";
  let tags: string[] = [];
  let confidence = 0.4;
  let needsType = false;

  const pref = buscarPreferencia(monto.resto, prefs);
  if (pref) {
    // Lo que el usuario ya corrigió tiene prioridad sobre las reglas genéricas.
    return { ...base, type: pref.type, nature: pref.type === "ingreso" ? null : pref.nature,
      category: pref.category, tags: [], confidence: 0.95, needsType: false };
  }

  if (AHORRO.test(n)) {
    type = "ahorro"; nature = "ahorro"; category = "Ahorro"; confidence = 0.9;
  } else if (INGRESO.test(n)) {
    type = "ingreso"; nature = null; category = /sueldo|salario|honorarios|freelance/.test(n) ? "Trabajo" : "Otros";
    confidence = 0.9;
  } else if (DEUDA.test(n) || (BANCO.test(n) && PAGUE.test(n))) {
    type = "deuda"; nature = "deuda"; category = "Deudas"; confidence = 0.85;
  } else if (BANCO.test(n)) {
    // "Banco 500": no asumir si es ingreso, pago de tarjeta o cuota.
    needsType = true; confidence = 0.2; category = "Otros";
  } else {
    const palabras = new Set(n.split(/[^a-z0-9/]+/));
    const regla = REGLAS.find((r) =>
      r.words.some((w) => (w.includes(" ") ? n.includes(w) : palabras.has(w))),
    );
    if (regla) {
      category = regla.category; nature = regla.nature; confidence = 0.85;
      const hit = regla.words.find((w) => (w.includes(" ") ? n.includes(w) : palabras.has(w)));
      tags = regla.tag ? [regla.tag] : hit ? [hit.charAt(0).toUpperCase() + hit.slice(1)] : [];
    } else {
      nature = "necesidad"; // valor inicial editable; confianza baja
    }
  }

  return { ...base, type, nature, category, tags, confidence, needsType };
}
