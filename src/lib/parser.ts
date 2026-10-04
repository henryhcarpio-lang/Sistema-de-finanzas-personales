import { todayLima } from "./dates";
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

const UNIDADES: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300,
  trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800,
  ochocientas: 800, novecientos: 900, novecientas: 900,
};

/**
 * Convierte una secuencia de palabras ya normalizadas ("dos mil quinientos",
 * "treinta y cinco") en número. Devuelve null si alguna no es numérica.
 */
export function palabrasANumero(palabras: string[]): number | null {
  if (!palabras.length) return null;
  let total = 0;
  let actual = 0;
  for (const w of palabras) {
    if (w === "y") continue;
    if (w === "mil") {
      total += (actual || 1) * 1000;
      actual = 0;
    } else if (w in UNIDADES) actual += UNIDADES[w];
    else return null;
  }
  return total + actual;
}

const esPalabraNumero = (w: string) => w in UNIDADES || w === "mil" || w === "y";

/** Monto en dígitos: 2,500 · 2.500,50 · 18.5 · 18,5 · S/ 18 */
function montoDigitos(raw: string): number {
  const lastSep = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
  const decimals = lastSep >= 0 ? raw.length - lastSep - 1 : 0;
  if (lastSep >= 0 && decimals === 3) return Number(raw.replace(/[.,]/g, ""));
  if (lastSep >= 0) return Number(raw.slice(0, lastSep).replace(/[.,]/g, "") + "." + raw.slice(lastSep + 1));
  return Number(raw);
}

/**
 * Céntimos dictados tras "soles": "con 50", "con cincuenta (céntimos)".
 * `tokens` empieza justo después de "sol/soles". Devuelve [céntimos, tokens consumidos].
 */
function centimos(tokens: string[]): [number, number] {
  if (norm(tokens[0] ?? "") !== "con") return [0, 0];
  const t1 = tokens[1] ?? "";
  if (/^\d{1,2}$/.test(t1)) {
    const extra = /^centimos?$/.test(norm(tokens[2] ?? "")) ? 1 : 0;
    return [Number(t1.length === 1 ? t1 + "0" : t1) / 100, 2 + extra];
  }
  let i = 1;
  while (i < tokens.length && esPalabraNumero(norm(tokens[i]))) i++;
  const n = palabrasANumero(tokens.slice(1, i).map(norm));
  if (n === null || n >= 100 || i === 1) return [0, 0];
  const extra = /^centimos?$/.test(norm(tokens[i] ?? "")) ? 1 : 0;
  return [n / 100, i + extra];
}

/** Extrae el monto y devuelve el texto restante (concepto). */
function extraerMonto(texto: string): { amount: number; resto: string } | null {
  const re = /(?:s\/\.?\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i;
  const m = re.exec(texto);
  if (m) {
    const amount = montoDigitos(m[1]);
    if (amount > 0) {
      const antes = texto.slice(0, m.index);
      const despues = texto.slice(m.index + m[0].length).split(/\s+/).filter(Boolean);
      // "18 soles con 50" (dictado)
      if (Number.isInteger(amount) && /^soles?$|^sol$/i.test(despues[0] ?? "")) {
        const [cent, usados] = centimos(despues.slice(1));
        if (usados) {
          const resto = `${antes} ${despues.slice(1 + usados).join(" ")}`;
          return { amount: Math.round((amount + cent) * 100) / 100, resto };
        }
      }
      return { amount, resto: `${antes} ${despues.join(" ")}` };
    }
  }

  // Números en palabras antes de "sol/soles": "dieciocho soles", "dos mil quinientos soles".
  const tokens = texto.split(/\s+/).filter(Boolean);
  const limpio = tokens.map((t) => norm(t).replace(/[^a-z0-9]/g, ""));
  const iSol = limpio.findIndex((t) => t === "sol" || t === "soles");
  if (iSol > 0) {
    let ini = iSol;
    while (ini > 0 && esPalabraNumero(limpio[ini - 1])) ini--;
    while (ini < iSol && limpio[ini] === "y") ini++;
    const entero = palabrasANumero(limpio.slice(ini, iSol));
    if (entero !== null && entero > 0) {
      const [cent, usados] = centimos(tokens.slice(iSol + 1));
      const resto = [...tokens.slice(0, ini), ...tokens.slice(iSol + 1 + usados)].join(" ");
      return { amount: Math.round((entero + cent) * 100) / 100, resto };
    }
  }
  return null;
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
  const monto = extraerMonto(input);
  if (!monto) return null;

  const n = norm(monto.resto);
  const concept = limpiarConcepto(monto.resto);
  const base = { amount: monto.amount, currency: "PEN" as const, concept, occurred_on: today };

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
