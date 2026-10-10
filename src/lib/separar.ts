import { extraerFecha } from "./fechaFrase";
import { extraerMonto, normalizarDictado } from "./montos";

/**
 * Separa una frase con varios movimientos: "un sol taxi, dos soles pasaje",
 * "18 taxi 20 almuerzo", "ayer 5 soles pan y 3 soles leche".
 * Es conservador: si no está claro, devuelve la frase entera (un movimiento).
 */

const sinTildes = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const NUMERO = new Set(["un", "uno", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete", "dieciocho", "diecinueve", "veinte",
  "veintiun", "veintiuno", "veintidos", "veintitres", "veinticuatro", "veinticinco", "veintiseis", "veintisiete",
  "veintiocho", "veintinueve", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa",
  "cien", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos",
  "ochocientos", "novecientos", "medio", "mil"]);
const esNumero = (w: string) => /^\d/.test(w) || NUMERO.has(sinTildes(w).replace(/[^a-z0-9ñ]/g, ""));
const RELLENO = /(?<!\p{L})(gast[eé]|pagu[eé]|compr[eé]|de|del|en|por|soles?|sol|me|el|la|los|las|un|una|unos|unas|para|con|fue|fueron|a|y|s\/|c[eé]ntimos?|tambi[eé]n|luego|adem[aá]s)(?!\p{L})/giu;

/** Hay un monto y además alguna palabra de concepto. */
function esMovimiento(t: string): boolean {
  const m = extraerMonto(t);
  if (!m) return false;
  return /\p{L}{2,}/u.test(m.resto.replace(RELLENO, " "));
}
const conSoles = (t: string) => /(?<!\p{L})(soles?|c[eé]ntimos?)(?!\p{L})|s\//iu.test(t);

/** Corta por montos sin separadores: "un sol taxi dos soles pasaje". */
function cortarPorMontos(frase: string): string[] {
  const w = frase.split(/\s+/).filter(Boolean);
  const montoPrimero = esNumero(w[0] ?? "");
  for (let k = 1; k < w.length; k++) {
    const a = w.slice(0, k).join(" ");
    const b = w.slice(k).join(" ");
    if (!esMovimiento(a) || !esMovimiento(b)) continue;
    if (montoPrimero) {
      // "monto concepto monto concepto": el segundo trozo empieza con número.
      if (!esNumero(w[k])) continue;
      // "8 soles pan 2 panetones" no son dos gastos: el 2.º monto necesita "soles" salvo que ninguno lo tenga.
      const montoB = w.slice(k).join(" ");
      if (conSoles(a) && !conSoles(montoB.split(/\s+/).slice(0, 3).join(" "))) continue;
    } else {
      // "concepto monto concepto monto": el primer trozo termina en monto con "soles".
      if (!/(?<!\p{L})(soles?|c[eé]ntimos?)$/iu.test(a)) continue;
    }
    return [a, ...cortarPorMontos(b)];
  }
  return [frase];
}

export function separarMovimientos(texto: string, today: string): { frases: string[]; fecha: string | null } {
  const limpio = normalizarDictado(texto);
  // La fecha dicha al inicio ("ayer …") vale para todos.
  const f = extraerFecha(limpio, today);
  const cuerpo = f ? f.resto : limpio;

  // 1) Separadores explícitos; un trozo sin movimiento se une al vecino ("treinta y cinco soles").
  const partes = cuerpo.split(/(\s*[,;\n]\s*|\.\s+|\s+(?:y|e|tambi[eé]n|luego|adem[aá]s|despu[eé]s)\s+)/iu);
  const trozos: string[] = [];
  let actual = "";
  for (let i = 0; i < partes.length; i += 2) {
    const sep = partes[i - 1] ?? "";
    const p = partes[i];
    actual = actual ? actual + sep + p : p;
    const siguiente = partes.slice(i + 2).join("");
    if (esMovimiento(actual) && (!siguiente.trim() || esMovimiento(siguiente) || i + 2 >= partes.length)) {
      trozos.push(actual.trim());
      actual = "";
    }
  }
  if (actual.trim()) {
    if (trozos.length && !esMovimiento(actual)) trozos[trozos.length - 1] += " " + actual.trim();
    else trozos.push(actual.trim());
  }
  // 2) Dentro de cada trozo, cortes por montos sin separador.
  const frases = trozos.flatMap(cortarPorMontos).filter(Boolean);
  if (frases.length <= 1) return { frases: [texto], fecha: null };
  return { frases, fecha: f?.fecha ?? null };
}
