"use client";

import { ChevronRight, Download, KeyRound, LogOut, Tags, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { borrarMisDatos, cambiarContrasena, guardarAjustes } from "@/app/actions";
import { cerrarSesion } from "@/app/login/actions";
import { modeloDescargado, precargar } from "@/lib/voz/whisper";
import type { Ajustes as AjustesT } from "@/lib/queries";

const IDIOMAS = [["es-PE", "Perú"], ["es-MX", "México"], ["es-CO", "Colombia"], ["es-AR", "Argentina"], ["es-ES", "España"], ["es-US", "EE. UU."]] as const;
const CUENTAS = ["Efectivo", "Yape / Plin", "Débito", "Crédito"];

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section aria-label={titulo} className="space-y-2">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted">{titulo}</h2>
      <div className="card divide-y divide-line">{children}</div>
    </section>
  );
}

function Fila({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 px-4 py-3">
      <div>
        <p className="text-base font-medium">{titulo}</p>
        {ayuda && <p className="text-xs text-muted">{ayuda}</p>}
      </div>
      {children}
    </div>
  );
}

/** Grupo de opciones excluyentes con botones grandes (≥ 44 px). */
function Opciones<T extends string | number>({ nombre, valor, opciones, onCambio }: {
  nombre: string; valor: T; opciones: readonly (readonly [T, string])[]; onCambio: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={nombre} className="flex flex-wrap gap-1.5 rounded-xl bg-bg p-1">
      {opciones.map(([v, l]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={valor === v} onClick={() => onCambio(v)}
          className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition ${valor === v ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-muted"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Interruptor({ etiqueta, activo, onCambio }: { etiqueta: string; activo: boolean; onCambio: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} onClick={() => onCambio(!activo)}
      className="-mr-1 flex min-h-11 shrink-0 items-center px-1">
      <span className={`relative block h-8 w-14 rounded-full transition ${activo ? "bg-brand" : "bg-line"}`}>
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${activo ? "left-7" : "left-1"}`} />
      </span>
    </button>
  );
}

export function Ajustes({ inicial, correo, iaDisponible = false }: { inicial: AjustesT; correo: string; iaDisponible?: boolean }) {
  const [a, setA] = useState(inicial);
  const [estado, setEstado] = useState<{ ok: boolean; msg: string } | null>(null);
  const [, start] = useTransition();

  /** Guarda al instante; tema y texto se aplican sin esperar al servidor. */
  const cambiar = <K extends keyof AjustesT>(k: K, v: AjustesT[K]) => {
    setA((x) => ({ ...x, [k]: v }));
    if (k === "tema") document.documentElement.dataset.tema = v === "sistema" ? "" : String(v);
    if (k === "texto") document.documentElement.dataset.texto = v === "normal" ? "" : String(v);
    start(async () => {
      const r = await guardarAjustes({ [k]: v });
      setEstado(r.ok ? { ok: true, msg: "Guardado" } : { ok: false, msg: r.error });
    });
  };

  return (
    <div className="space-y-6">
      <p aria-live="polite" className={`sticky top-2 z-10 min-h-5 text-right text-sm font-medium ${estado?.ok ? "text-pos" : "text-neg"}`} data-testid="estado-ajustes">
        {estado ? (estado.ok ? "✓ " : "") + estado.msg : ""}
      </p>

      <Seccion titulo="Perfil">
        <Fila titulo="Tu nombre" ayuda="Para saludarte en el Resumen.">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); cambiar("nombre", a.nombre?.trim() || null); }}>
            <input className="field flex-1" maxLength={40} aria-label="Tu nombre" placeholder="Opcional" value={a.nombre ?? ""}
              onChange={(e) => setA({ ...a, nombre: e.target.value })} />
            <button className="btn-ghost">Guardar</button>
          </form>
        </Fila>
        <Fila titulo="Correo"><p className="text-sm text-muted">{correo}</p></Fila>
      </Seccion>

      <Seccion titulo="Registro">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-base font-medium">Registro por voz</p>
            <p className="text-xs text-muted">Muestra el micrófono en Registrar.</p>
          </div>
          <Interruptor etiqueta="Registro por voz" activo={a.voz_activa} onCambio={(v) => cambiar("voz_activa", v)} />
        </div>
        <Fila titulo="Acento de la voz" ayuda="Elige el país cuyo español hablas: mejora el reconocimiento.">
          <select className="field" aria-label="Acento de la voz" value={a.voz_idioma} onChange={(e) => cambiar("voz_idioma", e.target.value)}>
            {IDIOMAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Fila>
        <Fila titulo="Motor de voz" ayuda="Automático usa el del navegador y, si falla en tu teléfono, la voz sin conexión (Whisper, gratis, en tu dispositivo).">
          <select className="field" aria-label="Motor de voz" value={a.voz_motor} onChange={(e) => cambiar("voz_motor", e.target.value as AjustesT["voz_motor"])}>
            <option value="auto">Automático</option>
            <option value="navegador">Navegador (más rápido)</option>
            <option value="whisper">Sin conexión (Whisper)</option>
          </select>
          <DescargarVoz />
        </Fila>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-base font-medium">Interpretar con IA</p>
            <p className="text-xs text-muted">
              {iaDisponible
                ? "Si una frase no queda clara, Gemini (gratis) la interpreta. Siempre confirmas tú."
                : "Aún no está configurada la clave de Gemini en el servidor."}
            </p>
          </div>
          <Interruptor etiqueta="Interpretar con IA" activo={a.usar_ia && iaDisponible} onCambio={(v) => cambiar("usar_ia", v)} />
        </div>
        <Fila titulo="Cuenta por defecto" ayuda="Se guarda en cada movimiento nuevo.">
          <select className="field" aria-label="Cuenta por defecto" value={a.cuenta_defecto ?? ""} onChange={(e) => cambiar("cuenta_defecto", e.target.value || null)}>
            <option value="">Ninguna</option>
            {CUENTAS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Fila>
        <Link href="/categorias" className="flex min-h-14 items-center gap-3 px-4 py-3">
          <Tags size={22} className="text-brand" aria-hidden />
          <span className="flex-1"><span className="block text-base font-medium">Categorías</span>
            <span className="block text-xs text-muted">Nombres, iconos, colores y grupos</span></span>
          <ChevronRight size={20} className="text-muted" aria-hidden />
        </Link>
      </Seccion>

      <Seccion titulo="Apariencia">
        <Fila titulo="Tema">
          <Opciones nombre="Tema" valor={a.tema} onCambio={(v) => cambiar("tema", v)}
            opciones={[["sistema", "Automático"], ["claro", "Claro"], ["oscuro", "Oscuro"]] as const} />
        </Fila>
        <Fila titulo="Tamaño del texto">
          <Opciones nombre="Tamaño del texto" valor={a.texto} onCambio={(v) => cambiar("texto", v)}
            opciones={[["normal", "Normal"], ["grande", "Grande"], ["muy-grande", "Muy grande"]] as const} />
        </Fila>
      </Seccion>

      <Seccion titulo="Resumen y avisos">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-base font-medium">Tu resumen inteligente</p>
            <p className="text-xs text-muted">Gastos atípicos, categorías que suben y presupuestos sugeridos.</p>
          </div>
          <Interruptor etiqueta="Tu resumen inteligente" activo={a.resumen_inteligente} onCambio={(v) => cambiar("resumen_inteligente", v)} />
        </div>
        <Fila titulo="Avisar pagos próximos" ayuda="Cuántos días antes aparecen en el Resumen.">
          <Opciones nombre="Avisar pagos próximos" valor={a.dias_aviso} onCambio={(v) => cambiar("dias_aviso", v)}
            opciones={[[3, "3 días"], [7, "7 días"], [14, "14 días"]] as const} />
        </Fila>
        <Fila titulo="Aviso de presupuesto" ayuda="Te avisa cuando usaste este porcentaje.">
          <Opciones nombre="Aviso de presupuesto" valor={a.umbral_presupuesto} onCambio={(v) => cambiar("umbral_presupuesto", v)}
            opciones={[[70, "70 %"], [80, "80 %"], [90, "90 %"]] as const} />
        </Fila>
      </Seccion>

      <Seccion titulo="Datos y cuenta">
        <a href="/exportar" download className="flex min-h-14 items-center gap-3 px-4 py-3">
          <Download size={22} className="text-brand" aria-hidden />
          <span className="flex-1"><span className="block text-base font-medium">Exportar movimientos</span>
            <span className="block text-xs text-muted">Archivo CSV para Excel o Google Sheets</span></span>
        </a>
        <CambiarContrasena />
        <form action={cerrarSesion}>
          <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left">
            <LogOut size={22} className="text-muted" aria-hidden /><span className="text-base font-medium">Cerrar sesión</span>
          </button>
        </form>
        <BorrarDatos />
      </Seccion>
    </div>
  );
}

function CambiarContrasena() {
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left">
        <KeyRound size={22} className="text-muted" aria-hidden /><span className="text-base font-medium">Cambiar contraseña</span>
      </button>
    );
  }
  return (
    <form className="space-y-2 px-4 py-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await cambiarContrasena(clave);
        setMsg(r.ok ? { ok: true, t: "Contraseña actualizada" } : { ok: false, t: r.error });
        if (r.ok) { setClave(""); setAbierto(false); }
      });
    }}>
      <label><span className="label">Nueva contraseña (mínimo 8)</span>
        <input className="field" type="password" autoComplete="new-password" minLength={8} value={clave} onChange={(e) => setClave(e.target.value)} /></label>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-pos" : "text-neg"}`}>{msg.t}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-ghost" onClick={() => setAbierto(false)}>Cancelar</button>
        <button className="btn-primary" disabled={pending || clave.length < 8}>Cambiar</button>
      </div>
    </form>
  );
}

function BorrarDatos() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-neg">
        <Trash2 size={22} aria-hidden /><span className="text-base font-medium">Borrar todos mis datos</span>
      </button>
    );
  }
  return (
    <form className="space-y-2 px-4 py-3" aria-label="Borrar todos mis datos" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => {
        const r = await borrarMisDatos(texto);
        if (!r.ok) return setError(r.error);
        router.push("/");
      });
    }}>
      <p className="text-sm">Se borrarán <b>todos</b> tus movimientos, deudas, pagos, presupuestos, categorías y ajustes. No se puede deshacer. Exporta antes si quieres conservarlos.</p>
      <label><span className="label">Escribe BORRAR para confirmar</span>
        <input className="field" autoComplete="off" autoCapitalize="characters" value={texto} onChange={(e) => setTexto(e.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-neg">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-ghost" onClick={() => { setAbierto(false); setTexto(""); }}>Cancelar</button>
        <button className="btn bg-neg text-white" disabled={pending}>Borrar todo</button>
      </div>
    </form>
  );
}

/** Descarga anticipada del modelo de voz sin conexión (útil con Wi-Fi). */
function DescargarVoz() {
  const [estado, setEstado] = useState<"inicio" | "bajando" | "listo" | "error">("inicio");
  const [pct, setPct] = useState(0);
  useEffect(() => { if (modeloDescargado()) setTimeout(() => setEstado("listo"), 0); }, []);
  if (estado === "listo") return <p className="text-sm text-pos" data-testid="voz-descargada">✓ Voz sin conexión lista en este dispositivo</p>;
  return (
    <div className="space-y-1">
      <button type="button" className="btn-ghost w-full" disabled={estado === "bajando"}
        onClick={() => { setEstado("bajando"); precargar(setPct).then(() => setEstado("listo"), () => setEstado("error")); }}>
        {estado === "bajando" ? `Descargando voz sin conexión… ${pct} %` : "Descargar voz sin conexión (~60 MB)"}
      </button>
      {estado === "error" && <p role="alert" className="text-sm text-neg">No se pudo descargar. Revisa tu conexión e inténtalo de nuevo.</p>}
    </div>
  );
}
