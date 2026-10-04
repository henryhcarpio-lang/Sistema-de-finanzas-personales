import { describe, expect, it } from "vitest";
import { parseMovimiento } from "./parser";
import { elegirCandidata, transcripciones } from "./transcripcion";

describe("transcripciones", () => {
  it("une los tramos de una frase dicha con pausa", () => {
    expect(transcripciones([["dieciocho soles"], ["taxi"]])).toEqual(["dieciocho soles taxi"]);
  });
  it("no duplica resultados acumulativos de Safari", () => {
    expect(transcripciones([["18 soles"], ["18 soles taxi"]])).toEqual(["18 soles taxi"]);
    expect(transcripciones([["taxi"], ["taxi"]])).toEqual(["taxi"]);
  });
  it("genera variantes con las alternativas del último tramo", () => {
    expect(transcripciones([["ayer"], ["un sol veinte pasaje", "un sol 20 pasaje", "un solo veinte pasaje"]]))
      .toEqual(["ayer un sol veinte pasaje", "ayer un sol 20 pasaje", "ayer un solo veinte pasaje"]);
  });
  it("ignora vacíos", () => {
    expect(transcripciones([[""], ["  "]])).toEqual([]);
  });
});

describe("elegirCandidata", () => {
  const T = "2026-10-04";
  const interpretar = (s: string) => parseMovimiento(s, T);
  it("si la 1.ª no tiene monto, usa la siguiente que sí", () => {
    const r = elegirCandidata(["dieciocho taxis", "dieciocho soles taxi"], interpretar);
    expect(r.texto).toBe("dieciocho soles taxi");
    expect(r.resultado?.amount).toBe(18);
  });
  it("entre las que tienen monto, la mejor clasificada", () => {
    const r = elegirCandidata(["5 soles pam", "5 soles pan"], interpretar);
    expect(r.resultado).toMatchObject({ amount: 5, category: "Alimentación" });
  });
  it("ninguna con monto: devuelve la 1.ª para corregirla a mano", () => {
    expect(elegirCandidata(["compré pan", "compre pan"], interpretar)).toEqual({ texto: "compré pan", resultado: null });
  });
});
