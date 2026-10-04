import type { Naturaleza } from "./types";

/**
 * Diccionario de conceptos frecuentes en Perú → categoría y naturaleza.
 * La naturaleza va por concepto, no por categoría: un "menú" es necesidad,
 * un "pollo a la brasa" o un "delivery" son deseo, aunque ambos sean comida.
 */
type Entrada = [claves: string, categoria: string, naturaleza: Naturaleza, etiqueta?: string];

const N = "necesidad" as const;
const D = "deseo" as const;
const T = "Transporte", CF = "Almuerzo / comida fuera", AL = "Alimentación", SU = "Supermercado",
  VI = "Vivienda", SE = "Servicios", SA = "Salud", ED = "Educación", EN = "Entretenimiento",
  CO = "Compras", SS = "Suscripciones", TR = "Trabajo", OT = "Otros";

const ENTRADAS: Entrada[] = [
  // Transporte
  ["taxi", T, N, "Taxi"], ["uber|cabify|indrive|didi|beat", T, N, "Taxi"],
  ["pasaje|bus|combi|micro|custer|metro de lima|metropolitano|corredor|tren|colectivo|mototaxi|moto taxi", T, N],
  ["movilidad|transporte|peaje|estacionamiento|parqueo|cochera", T, N],
  ["gasolina|combustible|grifo|petroleo|diesel|gnv|glp", T, N],
  ["mecanico|llanta|soat|revision tecnica|lavado de carro", T, N],
  ["pasaje de avion|vuelo|boleto de avion|pasaje interprovincial", T, D],
  // Comida fuera: necesidad (menú del día) vs deseo (antojos, delivery, salidas)
  ["almuerzo|menu|menu del dia|desayuno|cena|lonche|comida|comida del trabajo|tupper", CF, N],
  ["pollo a la brasa|broaster|pizza|hamburguesa|chifa|ceviche|cevicheria|sushi|anticucho|salchipapa|tacos|parrilla|parrillada|polleria|restaurante|buffet", CF, D],
  ["delivery|rappi|pedidosya|pedidos ya|didi food", CF, D],
  ["kfc|mcdonalds|mc donalds|burger king|bembos|papa johns|pizza hut|dominos|norkys|roky|rokys|popeyes|chilis", CF, D],
  ["cafe|cafecito|starbucks|tambo cafe|capuchino|frappe|juane", CF, D],
  ["postre|torta|pastel|helado|heladeria|churros|crepe|donas|donuts", CF, D],
  // Alimentación en casa: básicos (necesidad) vs antojos (deseo)
  ["pan|panaderia|leche|huevo|arroz|azucar|aceite|fideos|menestra|lenteja|frejol|papa|camote|yuca|pollo|carne|pescado|verdura|fruta|platano|manzana|tomate|cebolla|limon|queso|mantequilla|yogurt|avena|atun|sal|agua de mesa|bidon|bidon de agua|garrafon|abarrotes|bodega|cereal", AL, N],
  ["gaseosa|coca cola|inca kola|golosina|caramelo|chicle|chocolate|galleta|snack|piqueo|papitas|chizito|doritos|cuates|sublime|princesa|helado de bodega|chupetin|marciano|keke|alfajor|turron|energizante|red bull|volt", AL, D],
  ["cerveza|chela|trago|ron|pisco|vino|whisky|vodka|cocktail|coctel|six pack", EN, D],
  ["cigarro|cigarrillo|tabaco|vape", EN, D],
  // Supermercado / mercado
  ["supermercado|plaza vea|wong|tottus|metro|vivanda|makro|mass|tambo|oxxo|mercado|minimarket|compras del mes|canasta", SU, N],
  ["detergente|jabon|shampoo|papel higienico|lejia|pasta dental|cepillo|desodorante|panales|articulos de limpieza|limpieza", SU, N],
  // Vivienda
  ["alquiler|renta|mantenimiento|arbitrios|predial|hipoteca|condominio|vigilancia", VI, N],
  ["mueble|decoracion|cortina|sofa|cojin", VI, D],
  ["gasfitero|electricista|reparacion|ferreteria|foco", VI, N],
  // Servicios
  ["luz|recibo de luz|enel|luz del sur|agua|recibo de agua|sedapal|gas|gas natural|balon de gas|internet|wifi|cable|telefono|celular|recarga|plan movil|movistar|claro|entel|bitel|recibo", SE, N],
  // Salud
  ["medicina|medicamento|farmacia|botica|inkafarma|mifarma|pastilla|jarabe|vitamina|doctor|medico|consulta|clinica|hospital|essalud|analisis|laboratorio|dentista|odontologo|lentes|oculista|psicologo|terapia|seguro de salud|eps", SA, N],
  ["spa|masaje|manicure|pedicure|unas acrilicas", SA, D],
  ["peluqueria|corte de pelo|barberia|barbero", SA, N],
  // Educación
  ["colegio|pension|matricula|universidad|instituto|curso|clase|taller|diplomado|maestria|utiles|utiles escolares|cuaderno|libro|fotocopia|copias|impresion|uniforme", ED, N],
  ["udemy|platzi|coursera|libro de lectura|novela", ED, D],
  // Entretenimiento
  ["cine|cineplanet|cinemark|pelicula|teatro|concierto|entrada|fiesta|discoteca|bar|karaoke|bowling|juego|videojuego|playstation|xbox|steam|salida|paseo|viaje|hotel|playa|museo|parque de diversiones", EN, D],
  ["regalo|cumpleanos|detalle|flores", EN, D],
  // Compras
  ["ropa|polo|pantalon|jean|casaca|vestido|zapatilla|zapato|sandalia|cartera|mochila|accesorio|reloj|perfume|maquillaje|joya|lentes de sol", CO, D],
  ["celular nuevo|laptop|audifono|audifonos|tablet|televisor|tv|parlante|consola|tecnologia|amazon|aliexpress|shein|temu|mercado libre|falabella|ripley|oechsle|saga", CO, D],
  ["mascota|veterinario|veterinaria|comida de perro|comida de gato|croquetas|arena de gato", OT, N],
  // Suscripciones
  ["netflix|spotify|youtube premium|disney|hbo|hbo max|prime video|amazon prime|apple music|icloud|google one|chatgpt|crunchyroll|paramount|star plus|xbox game pass|playstation plus", SS, D],
  ["gimnasio|gym|smart fit|bodytech|crossfit|yoga", SS, D],
  // Trabajo
  ["oficina|coworking|hosting|dominio|herramienta|material de trabajo|impresora|tinta", TR, N],
  // Otros
  ["propina|limosna|donacion|ofrenda|diezmo", OT, D],
  ["notaria|tramite|multa|papeleta|reniec|sunat|impuesto", OT, N],
];

const sinTildes = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Forma base de una palabra: "galletas" → "galleta", "pasajes" → "pasaje", "cafés" → "cafe". */
function singular(w: string): string {
  // "galletas" → "galleta" (abajo); "pasajes" → "pasaj" no sirve, por eso clasificar()
  // prueba también la forma sin "s" ("pasaje"). Aquí: "papeles" → "papel".
  if (w.length > 4 && /[^aeiou]es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

interface Clave { palabras: string[]; categoria: string; naturaleza: Naturaleza; etiqueta?: string }
const CLAVES: Clave[] = ENTRADAS.flatMap(([claves, categoria, naturaleza, etiqueta]) =>
  claves.split("|").map((c) => ({ palabras: c.split(" "), categoria, naturaleza, etiqueta })));

export interface Clasificacion {
  categoria: string;
  naturaleza: Naturaleza;
  etiqueta: string;
}

/**
 * Busca el concepto más específico (la clave con más palabras; a igualdad, la
 * más larga) dentro del texto. Tolera tildes y plurales.
 */
export function clasificar(texto: string): Clasificacion | null {
  const tokens = sinTildes(texto).split(/[^a-z0-9ñ]+/).filter(Boolean);
  // Cada token admite su forma original, sin "s" y sin "es".
  const formas = tokens.map((t) => new Set([t, singular(t), t.endsWith("s") ? t.slice(0, -1) : t]));
  let mejor: Clave | null = null;
  for (const c of CLAVES) {
    const n = c.palabras.length;
    for (let i = 0; i + n <= tokens.length; i++) {
      let ok = true;
      for (let k = 0; k < n && ok; k++) ok = formas[i + k].has(c.palabras[k]);
      if (!ok) continue;
      const largo = c.palabras.join(" ").length;
      if (!mejor || n > mejor.palabras.length || (n === mejor.palabras.length && largo > mejor.palabras.join(" ").length)) mejor = c;
      break;
    }
  }
  if (!mejor) return null;
  const texto0 = mejor.palabras.join(" ");
  return {
    categoria: mejor.categoria,
    naturaleza: mejor.naturaleza,
    etiqueta: mejor.etiqueta ?? texto0.charAt(0).toUpperCase() + texto0.slice(1),
  };
}
