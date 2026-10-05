import Link from "next/link";
import type { Analisis } from "@/lib/inteligencia";
import { etiquetaFecha, soles, todayLima } from "@/lib/dates";
import { UsarSugerencia } from "./UsarSugerencia";

function Item({ icono, children, href, tinta = "text-fg" }: { icono: string; children: React.ReactNode; href?: string; tinta?: string }) {
  const contenido = (
    <>
      <span aria-hidden className={`mt-0.5 text-lg leading-none ${tinta}`}>{icono}</span>
      <span className="flex-1 text-base leading-snug">{children}</span>
      {href && <span aria-hidden className="text-muted">›</span>}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="-mx-2 flex min-h-12 items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-bg">{contenido}</Link>
      ) : (
        <div className="flex items-start gap-3 py-2">{contenido}</div>
      )}
    </li>
  );
}

/** Lectura automática del mes: resumen, alertas y sugerencias. Solo informa; el usuario decide. */
export function ResumenInteligente({ a }: { a: Analisis }) {
  const hoy = todayLima();
  const m = a.mes;
  const dif = a.promedioAFecha !== null ? m.gastado - a.promedioAFecha : null;
  const subeDeseo = a.deseos.anterior !== null && a.deseos.actual >= a.deseos.anterior + 10;

  return (
    <section className="card space-y-2 p-4 sm:p-5" aria-label="Tu resumen inteligente">
      <h2 className="flex items-center gap-2 text-base font-semibold"><span aria-hidden>✨</span> Tu resumen inteligente · este mes</h2>
      <p className="text-base leading-relaxed" data-testid="resumen-texto">
        Llevas <b className="tabular-nums">{soles(m.gastado)}</b> gastados
        {m.pctIngresos !== null && <> (el <b>{m.pctIngresos} %</b> de tus ingresos)</>}.
        {m.mayor && <> Tu mayor gasto es <b>{m.mayor.categoria}</b> ({soles(m.mayor.monto)}).</>}
        {dif !== null && Math.abs(dif) >= 1 && (
          <> Vas <b className={dif > 0 ? "text-neg" : "text-pos"}>{soles(Math.abs(dif))} {dif > 0 ? "por encima" : "por debajo"}</b> de tu promedio a esta fecha.</>
        )}
      </p>

      {!a.suficiente ? (
        <p className="rounded-xl bg-bg px-3 py-2.5 text-sm text-muted" data-testid="pocos-datos">
          Sigue registrando: con unas semanas de datos te avisaré de gastos fuera de lo normal y te sugeriré presupuestos
          (llevas {a.diasHistorial} {a.diasHistorial === 1 ? "día" : "días"}).
        </p>
      ) : (
        <ul className="divide-y divide-line" data-testid="hallazgos">
          {a.atipicos.map(({ tx, usual }) => (
            <Item key={tx.id} icono="!" tinta="text-warn" href={`/movimientos/${tx.id}`}>
              Pagaste <b>{soles(tx.amount)}</b> en {tx.concept} ({tx.category}, {etiquetaFecha(tx.occurred_on, hoy)}); lo usual es {soles(usual)}.
            </Item>
          ))}
          {a.crecen.map((c) => (
            <Item key={c.categoria} icono="↗" tinta="text-warn" href={`/movimientos?p=mes&cat=${encodeURIComponent(c.categoria)}`}>
              <b>{c.categoria}</b> sube {c.pct} %: llevas {soles(c.actual)}, lo usual a esta fecha es {soles(c.promedio)}.
            </Item>
          ))}
          {subeDeseo && (
            <Item icono="◐" tinta="text-serie-2" href="/movimientos?p=mes&nat=deseo">
              El <b>{a.deseos.actual} %</b> de tus gastos fue en deseos (antes {a.deseos.anterior} %).
            </Item>
          )}
          {a.sugerencias.map((s) => (
            <li key={s.categoria} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <span aria-hidden className="text-lg leading-none text-brand">◎</span>
              <span className="min-w-0 flex-1 text-base leading-snug">
                <b>{s.categoria}</b>: gastas unos {soles(s.promedio)} al mes. ¿Le pones presupuesto?
              </span>
              <UsarSugerencia categoria={s.categoria} monto={s.monto} />
            </li>
          ))}
          {a.atipicos.length + a.crecen.length + a.sugerencias.length === 0 && !subeDeseo && (
            <Item icono="✓" tinta="text-pos">Todo dentro de lo habitual. ¡Bien!</Item>
          )}
        </ul>
      )}
    </section>
  );
}
