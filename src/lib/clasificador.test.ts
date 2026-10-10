import { describe, expect, it } from "vitest";
import { parseMovimiento } from "./parser";

const T = "2026-10-04";
const N = "necesidad", D = "deseo";

// [frase, categoría, naturaleza]
const casos: [string, string, string][] = [
  // Transporte
  ["un sol veinte pasaje", "Transporte", N],
  ["2 pasajes 2.40", "Transporte", N],
  ["18 soles taxi", "Transporte", N],
  ["12 soles uber", "Transporte", N],
  ["1.50 combi", "Transporte", N],
  ["3 soles metropolitano", "Transporte", N],
  ["50 soles gasolina", "Gasolina", N],
  ["mototaxi 3 soles", "Transporte", N],
  // Comida fuera
  ["12 soles menú", "Almuerzo / comida fuera", N],
  ["15 soles almuerzo", "Almuerzo / comida fuera", N],
  ["8 soles desayuno", "Almuerzo / comida fuera", N],
  ["45 soles pollo a la brasa", "Restaurantes", D],
  ["35 soles pizza", "Restaurantes", D],
  ["28 soles hamburguesa", "Restaurantes", D],
  ["30 soles chifa", "Restaurantes", D],
  ["25 soles delivery", "Restaurantes", D],
  ["40 soles rappi", "Restaurantes", D],
  ["14 soles starbucks", "Almuerzo / comida fuera", D],
  ["6 soles café", "Almuerzo / comida fuera", D],
  ["22 soles kfc", "Restaurantes", D],
  ["10 soles helado", "Almuerzo / comida fuera", D],
  // Alimentación en casa
  ["un sol pan", "Alimentación", N],
  ["5 soles leche", "Alimentación", N],
  ["12 soles huevos", "Alimentación", N],
  ["18 soles pollo", "Alimentación", N],
  ["4 soles frutas", "Alimentación", N],
  ["2.50 galletas", "Alimentación", D],
  ["60 céntimos caramelo", "Alimentación", D],
  ["3.50 gaseosa", "Alimentación", D],
  ["4 soles inca kola", "Alimentación", D],
  ["2 soles chocolate", "Alimentación", D],
  ["1.50 chicles", "Alimentación", D],
  ["6 soles papitas", "Alimentación", D],
  ["20 soles cerveza", "Entretenimiento", D],
  ["15 soles chelas", "Entretenimiento", D],
  // Supermercado
  ["150 soles plaza vea", "Supermercado", N],
  ["80 soles mercado", "Supermercado", N],
  ["12 soles detergente", "Supermercado", N],
  ["9 soles papel higiénico", "Supermercado", N],
  // Vivienda y servicios
  ["800 soles alquiler", "Vivienda", N],
  ["120 soles luz", "Servicios", N],
  ["60 soles agua", "Servicios", N],
  ["99 soles internet", "Servicios", N],
  ["10 soles recarga", "Servicios", N],
  ["45 soles balón de gas", "Servicios", N],
  ["7 soles agua de mesa", "Alimentación", N],
  // Salud
  ["25 soles farmacia", "Salud", N],
  ["40 soles inkafarma", "Salud", N],
  ["80 soles consulta", "Salud", N],
  ["15 soles corte de pelo", "Cuidado personal", N],
  ["60 soles masaje", "Cuidado personal", D],
  // Educación
  ["300 soles pensión", "Educación", N],
  ["5 soles copias", "Educación", N],
  ["40 soles útiles", "Educación", N],
  // Entretenimiento / compras / suscripciones
  ["30 soles cine", "Entretenimiento", D],
  ["50 soles concierto", "Entretenimiento", D],
  ["80 soles regalo", "Regalos", D],
  ["120 soles zapatillas", "Ropa", D],
  ["60 soles polo", "Ropa", D],
  ["90 soles shein", "Compras", D],
  ["45 soles netflix", "Suscripciones", D],
  ["24.90 spotify", "Suscripciones", D],
  ["100 soles gimnasio", "Suscripciones", D],
  // Otros
  ["50 soles veterinario", "Mascotas", N],
  ["40 soles paquete de pañales", "Hijos", N],
  ["30 soles croquetas", "Mascotas", N],
  ["60 soles grifo", "Gasolina", N],
  ["5 soles propina", "Otros", D],
];

describe("clasificación necesidad / deseo", () => {
  it.each(casos)("%s → %s · %s", (frase, categoria, naturaleza) => {
    expect(parseMovimiento(frase, T)).toMatchObject({ category: categoria, nature: naturaleza });
  });

  it("gana el concepto más específico", () => {
    expect(parseMovimiento("45 soles pollo a la brasa", T)?.tags).toEqual(["Pollo a la brasa"]);
    expect(parseMovimiento("7 soles agua de mesa", T)?.category).toBe("Alimentación");
    expect(parseMovimiento("30 soles comida de perro", T)?.category).toBe("Mascotas");
  });

  it("los artículos no se confunden con conceptos ('unas galletas')", () => {
    expect(parseMovimiento("compré unas galletas 3 soles", T)).toMatchObject({ category: "Alimentación", nature: D });
  });

  it("lo desconocido queda con confianza baja para revisarlo", () => {
    expect(parseMovimiento("20 soles cosa rara", T)).toMatchObject({ category: "Otros", confidence: 0.4 });
  });
});
