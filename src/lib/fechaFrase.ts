import { addDays } from "./dates";

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre"];
const NUM_DIAS: Record<string, number> = { un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7 };

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const L = "(?<![\\p{L}\\d])"; // inicio de palabra (Unicode)
const R = "(?![\\p{L}])"; // fin de palabra

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const valida = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

interface Patron {
  re: RegExp;
  fecha: (m: RegExpExecArray, today: string) => string | null;
}

// Se aplican sobre el texto sin tildes, que en NFC tiene la misma longitud que el original:
// así las posiciones del match sirven para recortar la frase original.
const PATRONES: Patron[] = [
  { re: new RegExp(`${L}(anteayer|antes de ayer)${R}`, "iu"), fecha: (_, t) => addDays(t, -2) },
  { re: new RegExp(`${L}ayer${R}`, "iu"), fecha: (_, t) => addDays(t, -1) },
  { re: new RegExp(`${L}hoy${R}`, "iu"), fecha: (_, t) => t },
  {
    re: new RegExp(`${L}hace (\\d{1,2}|un|uno|dos|tres|cuatro|cinco|seis|siete) dias?${R}`, "iu"),
    fecha: (m, t) => {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM_DIAS[m[1].toLowerCase()];
      return n >= 1 && n <= 60 ? addDays(t, -n) : null;
    },
  },
  {
    // "el 3 de octubre", "3 de octubre de 2026"
    re: new RegExp(`${L}(?:el )?(\\d{1,2}) de (${MESES.join("|")})(?: de (\\d{4}))?${R}`, "iu"),
    fecha: (m, t) => {
      const d = Number(m[1]);
      const mes = MESES.indexOf(m[2].toLowerCase()) + 1;
      let y = m[3] ? Number(m[3]) : Number(t.slice(0, 4));
      if (!m[3] && iso(y, mes, d) > t) y--; // sin año: la ocurrencia pasada más reciente
      return valida(y, mes, d) && iso(y, mes, d) <= t ? iso(y, mes, d) : null;
    },
  },
  {
    // "el día 3": este mes, o el anterior si aún no llega
    re: new RegExp(`${L}el dia (\\d{1,2})${R}`, "iu"),
    fecha: (m, t) => {
      const d = Number(m[1]);
      let y = Number(t.slice(0, 4));
      let mes = Number(t.slice(5, 7));
      if (iso(y, mes, d) > t) { mes--; if (mes === 0) { mes = 12; y--; } }
      return valida(y, mes, d) ? iso(y, mes, d) : null;
    },
  },
  {
    // "el lunes", "el sábado pasado", "este martes"
    re: new RegExp(`${L}(?:el |este )?(${DIAS_SEMANA.join("|")})(?: pasado)?${R}`, "iu"),
    fecha: (m, t) => {
      const objetivo = DIAS_SEMANA.indexOf(m[1].toLowerCase());
      const actual = new Date(`${t}T00:00:00Z`).getUTCDay();
      let atras = (actual - objetivo + 7) % 7;
      if (atras === 0 && /pasado/i.test(m[0])) atras = 7; // "el lunes pasado" dicho un lunes
      return addDays(t, -atras);
    },
  },
];

/**
 * Busca una fecha relativa o explícita en la frase ("ayer", "el lunes",
 * "el 3 de octubre", "hace 2 días"). Nunca devuelve fechas futuras.
 * Devuelve la fecha y la frase sin esa expresión.
 */
export function extraerFecha(texto: string, today: string): { fecha: string; resto: string } | null {
  const original = texto.normalize("NFC");
  const plano = sinTildes(original);
  if (plano.length !== original.length) return null; // caracteres compuestos raros: mejor no adivinar
  for (const p of PATRONES) {
    const m = p.re.exec(plano);
    if (!m) continue;
    const fecha = p.fecha(m, today);
    if (!fecha) continue;
    const resto = (original.slice(0, m.index) + " " + original.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
    return { fecha, resto };
  }
  return null;
}
