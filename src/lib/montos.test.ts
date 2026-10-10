import { describe, expect, it } from "vitest";
import { parseMovimiento } from "./parser";

// Montos pequeños tal como se dicen o escriben en Perú.
const casos: [string, number, string?][] = [
  ["un sol veinte pasaje", 1.2, "Pasaje"],
  ["un sol con veinte pasaje", 1.2, "Pasaje"],
  ["un sol cincuenta pan", 1.5, "Pan"],
  ["2.40 pasaje", 2.4, "Pasaje"],
  ["2,40 pasaje", 2.4, "Pasaje"],
  ["3.50 caramelos", 3.5, "Caramelos"],
  ["S/ 3.50 pan", 3.5, "Pan"],
  ["un sol pasaje", 1, "Pasaje"],
  ["dos soles pan", 2, "Pan"],
  ["3 soles pan", 3, "Pan"],
  ["4 pan", 4, "Pan"],
  ["cinco soles chicle", 5, "Chicle"],
  ["60 céntimos caramelo", 0.6, "Caramelo"],
  ["10 céntimos bolsa", 0.1, "Bolsa"],
  ["40 centimos chicle", 0.4, "Chicle"],
  ["sesenta céntimos caramelo", 0.6, "Caramelo"],
  ["diez céntimos bolsa", 0.1, "Bolsa"],
  ["cincuenta céntimos pan", 0.5, "Pan"],
  ["2 soles 40 pasaje", 2.4, "Pasaje"],
  ["dos soles cuarenta pasaje", 2.4, "Pasaje"],
  ["dos cuarenta pasaje", 2.4, "Pasaje"],
  ["tres cincuenta pan", 3.5, "Pan"],
  ["dos con cuarenta pasaje", 2.4, "Pasaje"],
  ["3 con 50 pan", 3.5, "Pan"],
  ["medio sol caramelo", 0.5, "Caramelo"],
  ["un sol y medio pan", 1.5, "Pan"],
  ["pasaje un sol veinte", 1.2, "Pasaje"],
  ["gasté un sol veinte en pasaje", 1.2, "Pasaje"],
  ["un sol con diez céntimos", 1.1],
  ["18 soles taxi", 18, "Taxi"],
  ["treinta y cinco soles almuerzo", 35, "Almuerzo"],
  ["veinte soles cine", 20, "Cine"],
  ["ayer un sol veinte pasaje", 1.2, "Pasaje"],
  ["1.20 soles pasaje", 1.2, "Pasaje"],
  ["S/1.20 pasaje", 1.2, "Pasaje"],
  ["S/. 2.40 pasaje", 2.4, "Pasaje"],
  ["uno cincuenta pan", 1.5, "Pan"],
  ["0.50 caramelo", 0.5, "Caramelo"],
  ["cincuenta centavos caramelo", 0.5, "Caramelo"],
  ["dos soles con cinco céntimos", 2.05],
  ["un sol con 5 pasaje", 1.5, "Pasaje"],
  ["ciento veinte soles supermercado", 120, "Supermercado"],
  ["dos mil quinientos soles sueldo", 2500, "Sueldo"],
  ["me depositaron 2,500 soles", 2500],
  ["Banco 500", 500, "Banco"],
];
describe("montos pequeños y dictados", () => {
  it.each(casos)("%s → %d", (frase, monto, concepto) => {
    const d = parseMovimiento(frase, "2026-10-04");
    expect(d?.amount).toBe(monto);
    if (concepto) expect(d?.concept).toBe(concepto);
  });

  it("sin contexto de dinero, las palabras numéricas no son monto", () => {
    expect(parseMovimiento("dos pasajes", "2026-10-04")).toBeNull();
    expect(parseMovimiento("un pasaje", "2026-10-04")).toBeNull();
  });

  it("'dos veinte soles' no se lee como 2.20", () => {
    expect(parseMovimiento("dos veinte soles", "2026-10-04")?.amount).not.toBe(2.2);
  });
});

describe("errores típicos del dictado", () => {
  it.each([
    ["un sol 20 pasaje", 1.2, "Pasaje"],
    ["dos soles 40 pasaje", 2.4, "Pasaje"],
    ["18 pesos taxi", 18, "Taxi"],
    ["$18 taxi", 18, "Taxi"],
    ["S /18 taxi", 18, "Taxi"],
    ["18 solos taxi", 18, "Taxi"],
    ["3.50 soles. pan", 3.5, "Pan"],
  ])("%s → %d", (frase, monto, concepto) => {
    const d = parseMovimiento(frase as string, "2026-10-04");
    expect(d?.amount).toBe(monto);
    expect(d?.concept).toBe(concepto);
  });
});
