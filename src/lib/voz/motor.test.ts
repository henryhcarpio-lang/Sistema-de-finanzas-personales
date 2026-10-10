import { describe, expect, it } from "vitest";
import { elegirMotor, tipoGrabacion } from "./motor";

const todo = { webSpeech: true, grabacion: true };
describe("elegirMotor", () => {
  it("automático: Web Speech por defecto", () => expect(elegirMotor("auto", todo, false)).toBe("navegador"));
  it("automático: si Web Speech ya falló en el dispositivo → Whisper", () => expect(elegirMotor("auto", todo, true)).toBe("whisper"));
  it("Firefox (sin Web Speech) → Whisper", () => expect(elegirMotor("auto", { webSpeech: false, grabacion: true }, false)).toBe("whisper"));
  it("si falló pero no hay grabación, sigue con Web Speech", () => expect(elegirMotor("auto", { webSpeech: true, grabacion: false }, true)).toBe("navegador"));
  it("ajuste explícito con respaldo", () => {
    expect(elegirMotor("whisper", todo, false)).toBe("whisper");
    expect(elegirMotor("navegador", todo, true)).toBe("navegador");
    expect(elegirMotor("whisper", { webSpeech: true, grabacion: false }, false)).toBe("navegador");
  });
  it("sin nada → null", () => expect(elegirMotor("auto", { webSpeech: false, grabacion: false }, false)).toBeNull());
});

describe("tipoGrabacion", () => {
  it("iOS (solo mp4)", () => expect(tipoGrabacion((t) => t === "audio/mp4")).toBe("audio/mp4"));
  it("Chrome (webm/opus)", () => expect(tipoGrabacion(() => true)).toBe("audio/webm;codecs=opus"));
});
