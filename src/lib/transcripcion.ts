/** Un resultado del reconocedor: sus alternativas, de la más a la menos probable. */
export type ResultadoTexto = string[];

const limpio = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Combina los resultados del reconocimiento continuo en frases candidatas.
 *
 * - Safari (iOS) a veces entrega resultados acumulativos: el 2.º ya contiene
 *   al 1.º ("18 soles", "18 soles taxi"). En ese caso se descarta el previo
 *   para no duplicar.
 * - La 1.ª candidata usa la mejor alternativa de cada tramo; luego se agregan
 *   variantes cambiando el último tramo por sus alternativas, que es donde
 *   suelen estar el monto y el concepto.
 */
export function transcripciones(resultados: ResultadoTexto[]): string[] {
  const tramos = resultados.map((alts) => alts.map(limpio).filter(Boolean)).filter((alts) => alts.length > 0);
  // Quitar tramos que el siguiente ya incluye (acumulativos de Safari) o repetidos.
  const utiles = tramos.filter((alts, i) => {
    const sig = tramos[i + 1]?.[0]?.toLowerCase();
    const actual = alts[0].toLowerCase();
    return !(sig && (sig.startsWith(actual) || sig === actual));
  });
  if (!utiles.length) return [];
  const prefijo = utiles.slice(0, -1).map((a) => a[0]).join(" ");
  const ultimo = utiles[utiles.length - 1];
  const candidatas = ultimo.map((alt) => limpio(`${prefijo} ${alt}`));
  return [...new Set(candidatas)];
}

/**
 * Elige la candidata que mejor sirve como movimiento: la primera con monto;
 * entre las que tienen monto, la de mayor confianza de clasificación.
 */
export function elegirCandidata<T extends { confidence: number }>(
  candidatas: string[],
  interpretar: (s: string) => T | null,
): { texto: string; resultado: T | null } {
  let mejor: { texto: string; resultado: T } | null = null;
  for (const texto of candidatas) {
    const r = interpretar(texto);
    if (r && (!mejor || r.confidence > mejor.resultado.confidence)) mejor = { texto, resultado: r };
  }
  return mejor ?? { texto: candidatas[0] ?? "", resultado: null };
}
