// Servidor que imita la API de Gemini para las pruebas (sin clave real ni costo).
import { createServer } from "node:http";

const respuestas = {
  "le pasé cincuenta a mi hermana por su cumple": [{ amount: 50, concept: "Regalo a mi hermana", type: "egreso", nature: "deseo", category: "Regalos", date: "HOY", confidence: 0.85 }],
  "almuerzo con clientes cuarenta lucas y el uber de vuelta quince": [
    { amount: 40, concept: "Almuerzo con clientes", type: "egreso", nature: "necesidad", category: "Trabajo", date: "HOY", confidence: 0.8 },
    { amount: 15, concept: "Uber", type: "egreso", nature: "necesidad", category: "Transporte", date: "HOY", confidence: 0.9 },
  ],
};
export const llamadas = [];

export function iniciarGeminiFalso(puerto = 4999, hoy) {
  const srv = createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (c) => { cuerpo += c; });
    req.on("end", () => {
      const j = JSON.parse(cuerpo || "{}");
      const frase = j.contents?.[0]?.parts?.[0]?.text ?? "";
      llamadas.push({ url: req.url, clave: req.headers["x-goog-api-key"], frase, sistema: j.systemInstruction?.parts?.[0]?.text ?? "", schema: !!j.generationConfig?.responseSchema });
      if (frase.includes("falla")) { res.writeHead(500); res.end("{}"); return; }
      const movs = (respuestas[frase.toLowerCase()] ?? []).map((m) => ({ ...m, date: hoy }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ movimientos: movs }) }] } }] }));
    });
  });
  return new Promise((ok) => srv.listen(puerto, () => ok(srv)));
}
