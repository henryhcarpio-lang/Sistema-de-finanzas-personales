/**
 * Lectura de montos en soles tal como se escriben o se dictan:
 * "18.50", "S/ 3,50", "un sol veinte", "dos cuarenta", "3 con 50",
 * "60 céntimos", "medio sol", "un sol y medio", "dos mil quinientos soles".
 */

const sinTildes = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type Clase = "uni" | "teen" | "dec" | "cien";

const PALABRAS: Record<string, [number, Clase]> = {
  un: [1, "uni"], uno: [1, "uni"], una: [1, "uni"], dos: [2, "uni"], tres: [3, "uni"], cuatro: [4, "uni"],
  cinco: [5, "uni"], seis: [6, "uni"], siete: [7, "uni"], ocho: [8, "uni"], nueve: [9, "uni"],
  diez: [10, "teen"], once: [11, "teen"], doce: [12, "teen"], trece: [13, "teen"], catorce: [14, "teen"],
  quince: [15, "teen"], dieciseis: [16, "teen"], diecisiete: [17, "teen"], dieciocho: [18, "teen"],
  diecinueve: [19, "teen"], veinte: [20, "teen"], veintiun: [21, "teen"], veintiuno: [21, "teen"],
  veintiuna: [21, "teen"], veintidos: [22, "teen"], veintitres: [23, "teen"], veinticuatro: [24, "teen"],
  veinticinco: [25, "teen"], veintiseis: [26, "teen"], veintisiete: [27, "teen"], veintiocho: [28, "teen"],
  veintinueve: [29, "teen"],
  treinta: [30, "dec"], cuarenta: [40, "dec"], cincuenta: [50, "dec"], sesenta: [60, "dec"],
  setenta: [70, "dec"], ochenta: [80, "dec"], noventa: [90, "dec"],
  cien: [100, "cien"], ciento: [100, "cien"], doscientos: [200, "cien"], doscientas: [200, "cien"],
  trescientos: [300, "cien"], trescientas: [300, "cien"], cuatrocientos: [400, "cien"],
  cuatrocientas: [400, "cien"], quinientos: [500, "cien"], quinientas: [500, "cien"],
  seiscientos: [600, "cien"], seiscientas: [600, "cien"], setecientos: [700, "cien"],
  setecientas: [700, "cien"], ochocientos: [800, "cien"], ochocientas: [800, "cien"],
  novecientos: [900, "cien"], novecientas: [900, "cien"],
};

const DIGITOS = /^(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)$/;

/** "2,500" → 2500 · "2.500,50" → 2500.5 · "18,5" → 18.5 */
function montoDigitos(raw: string): number {
  const lastSep = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
  const decimals = lastSep >= 0 ? raw.length - lastSep - 1 : 0;
  if (lastSep >= 0 && decimals === 3) return Number(raw.replace(/[.,]/g, ""));
  if (lastSep >= 0) return Number(raw.slice(0, lastSep).replace(/[.,]/g, "") + "." + raw.slice(lastSep + 1));
  return Number(raw);
}

interface Numero {
  valor: number;
  fin: number; // índice del primer token no consumido
  digitos: string | null; // texto original si eran dígitos
}

/**
 * Lee un número (dígitos o palabras) desde el token i. Las palabras se componen
 * solo en el orden natural del español: "ciento veinte", "treinta y cinco",
 * "dos mil quinientos". Por eso en "dos cuarenta" se leen dos números: 2 y 40.
 */
function leerNumero(t: string[], i: number): Numero | null {
  const m = DIGITOS.exec(t[i] ?? "");
  if (m) return { valor: montoDigitos(m[1]), fin: i + 1, digitos: m[1] };
  let total = 0;
  let actual = 0;
  let ultima: Clase | "y" | "mil" | null = null;
  let j = i;
  for (; j < t.length; j++) {
    const w = t[j];
    if (w === "mil" && ultima !== "mil" && ultima !== "y") {
      total += (actual || 1) * 1000;
      actual = 0;
      ultima = "mil";
      continue;
    }
    if (w === "y") {
      if (ultima === "dec" && PALABRAS[t[j + 1]]?.[1] === "uni") { ultima = "y"; continue; }
      break;
    }
    const p = PALABRAS[w];
    if (!p) break;
    const [v, clase] = p;
    const puede =
      clase === "cien" ? ultima === null || ultima === "mil"
      : clase === "dec" || clase === "teen" ? ultima === null || ultima === "mil" || ultima === "cien"
      : ultima === null || ultima === "mil" || ultima === "cien" || ultima === "y";
    if (!puede) break;
    actual += v;
    ultima = clase;
  }
  if (j === i) return null;
  return { valor: total + actual, fin: j, digitos: null };
}

const esSol = (w: string | undefined) => w === "sol" || w === "soles";
const esCentimo = (w: string | undefined) => w === "centimo" || w === "centimos" || w === "centavo" || w === "centavos";

/** Céntimos tras el entero: "veinte", "con 50", "con cincuenta céntimos", "y medio". */
function leerCentimos(t: string[], i: number, trasSoles: boolean): { cent: number; fin: number } | null {
  if (t[i] === "y" && t[i + 1] === "medio") return { cent: 0.5, fin: i + 2 };
  let j = i;
  const conectado = t[j] === "con";
  if (conectado) j++;
  if (!conectado && !trasSoles) {
    // Sin "soles" ni "con", solo se acepta "dos cuarenta": decenas o 10–29 en palabras.
    const n = leerNumero(t, j);
    if (!n || n.digitos !== null || n.valor < 10 || n.valor > 99) return null;
    if (esSol(t[n.fin])) return null; // "dos veinte soles" no es 2.20
    return { cent: n.valor / 100, fin: n.fin + (esCentimo(t[n.fin]) ? 1 : 0) };
  }
  const n = leerNumero(t, j);
  if (!n || n.valor >= 100 || !Number.isInteger(n.valor)) return null;
  if (esSol(t[n.fin])) return null; // "un sol veinte soles…" → no son céntimos
  // "con 5" dictado suele ser "con cincuenta"; "con 05" son 5 céntimos.
  const cent = n.digitos !== null && n.digitos.length === 1 ? n.valor * 10 : n.valor;
  return { cent: cent / 100, fin: n.fin + (esCentimo(t[n.fin]) ? 1 : 0) };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Busca el monto en la frase y devuelve el resto (para el concepto). */
export function extraerMonto(texto: string): { amount: number; resto: string } | null {
  // Tokens originales (para reconstruir el concepto) y normalizados (para leer).
  const original = texto.replace(/s\/\.?\s*/gi, " S/ ").split(/\s+/).filter(Boolean);
  const t = original.map((w) => {
    const n = sinTildes(w);
    return DIGITOS.test(n.replace(/[.,;:!?]+$/, "")) ? n.replace(/[.,;:!?]+$/, "") : n.replace(/[^a-z0-9ñ/]/g, "");
  });

  const resultado = (desde: number, hasta: number, amount: number) => {
    if (!(amount > 0)) return null;
    const resto = [...original.slice(0, desde), ...original.slice(hasta)].filter((w) => !/^s\/\.?$/i.test(w)).join(" ");
    return { amount: r2(amount), resto };
  };

  // 1) Preferencia por cifras escritas con dígitos (las más precisas).
  // 2) Si no hay, números en palabras con contexto de dinero.
  for (const soloDigitos of [true, false]) {
    for (let i = 0; i < t.length; i++) {
      if (t[i] === "medio" && esSol(t[i + 1])) return resultado(i, i + 2, 0.5);
      const n = leerNumero(t, i);
      if (!n || (soloDigitos && n.digitos === null) || (!soloDigitos && n.digitos !== null)) continue;
      // En "un sol con 5" el 5 son los céntimos del "un sol" en palabras, no el monto.
      if (soloDigitos && t[i - 1] === "con" && (esSol(t[i - 2]) || (t[i - 2] ?? "") in PALABRAS)) continue;
      let fin = n.fin;
      // "60 céntimos"
      if (esCentimo(t[fin]) && n.valor < 100 && Number.isInteger(n.valor)) return resultado(i, fin + 1, n.valor / 100);
      let amount = n.valor;
      let conContexto = n.digitos !== null; // los dígitos sueltos ya son un monto ("18 taxi")
      if (esSol(t[fin])) { fin++; conContexto = true; }
      if (Number.isInteger(amount)) {
        const c = leerCentimos(t, fin, esSol(t[fin - 1]));
        if (c) { amount += c.cent; fin = c.fin; conContexto = true; }
      }
      if (!conContexto) continue; // "dos pasajes" no es un monto
      return resultado(i, fin, amount);
    }
  }
  return null;
}
