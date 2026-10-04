import Link from "next/link";
import { BarraNaturaleza } from "@/components/BarraNaturaleza";
import { GraficoGasto } from "@/components/GraficoGasto";
import { PeriodoSelector, leerPeriodo } from "@/components/PeriodoSelector";
import { compararCategorias, proyeccionMes, serieGasto } from "@/lib/analisis";
import { calendario } from "@/lib/compromisos";
import { PERIODOS, periodoAnterior, rangoPeriodo, soles, todayLima } from "@/lib/dates";
import { CuotaFila } from "@/components/CuotaFila";
import { BarraSobre, DetalleSobre } from "@/components/EstadoSobre";
import { listarCompromisos, listarMovimientos, listarPagos, listarPresupuestos, resumir } from "@/lib/queries";

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const p = leerPeriodo(sp.p);
  const hoy = todayLima();
  const rango = rangoPeriodo(p, hoy, { from: str(sp.from), to: str(sp.to) });
  const [txs, prev, presupuestos, compromisos, pagos] = await Promise.all([
    listarMovimientos({ rango }),
    listarMovimientos({ rango: periodoAnterior(rango) }),
    listarPresupuestos(),
    listarCompromisos(),
    listarPagos(),
  ]);
  const proximos = calendario(compromisos, pagos, hoy, 7).filter((c) => c.estado !== "pagada");
  const totalProximos = proximos.reduce((s2, c) => s2 + c.compromiso.amount, 0);
  const enAlerta = presupuestos.filter((x) => x.estado.nivel !== "ok").slice(0, 3);
  const r = resumir(txs);
  const gastoPrev = resumir(prev).gastos;
  const delta = gastoPrev > 0 ? Math.round(((r.gastos - gastoPrev) / gastoPrev) * 100) : null;
  const serie = serieGasto(txs, rango);
  const proyeccion = p === "mes" ? proyeccionMes(r.gastos, rango, hoy) : null;
  const categorias = compararCategorias(txs, prev);
  const maxCat = categorias[0]?.actual ?? 0;
  const periodoTxt = PERIODOS.find((x) => x.v === p)!.frase;
  const qsCat = (cat: string) =>
    new URLSearchParams({ p, ...(p === "rango" ? { from: rango.from, to: rango.to } : {}), cat }).toString();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Mi situación financiera</h1>
      <PeriodoSelector base="/dashboard" actual={p} from={rango.from} to={rango.to} />

      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Ingresos" value={r.ingresos} tone="pos" />
        <Kpi label="Gastos" value={r.gastos} />
        <Kpi label="Balance" value={r.balance} tone={r.balance < 0 ? "neg" : "pos"} />
        <Kpi label="Ahorro" value={r.ahorro} />
      </div>

      {(proyeccion || delta !== null) && (
        <section className="card space-y-1 p-4 text-sm" aria-label="Tendencia">
          {proyeccion && (
            <p data-testid="proyeccion">
              A este ritmo cerrarás el mes con <b className="tabular-nums">{soles(proyeccion.proyectado)}</b> en gastos
              <span className="text-muted"> (día {proyeccion.dia} de {proyeccion.diasMes}).</span>
            </p>
          )}
          {delta !== null && (
            <p className="text-muted" data-testid="comparacion">
              Gastaste{" "}
              <span className={`font-semibold ${delta > 0 ? "text-neg" : "text-pos"}`}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} % {delta > 0 ? "más" : "menos"}
              </span>{" "}
              que en el periodo anterior ({soles(gastoPrev)}).
            </p>
          )}
        </section>
      )}

      {compromisos.length > 0 && (
        <section aria-label="Próximos compromisos">
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <h2 className="text-sm font-semibold">Próximos compromisos · 7 días</h2>
            <Link href="/pagos" className="text-xs text-muted hover:text-fg">Ver todos ›</Link>
          </div>
          {proximos.length === 0 ? (
            <div className="card p-4 text-sm text-pos"><span aria-hidden>✓</span> Nada por pagar esta semana.</div>
          ) : (
            <>
              <ul className="card divide-y divide-line overflow-hidden">
                {proximos.slice(0, 5).map((c) => <CuotaFila key={`${c.compromiso.id}|${c.fecha}`} cuota={c} />)}
              </ul>
              <p className="mt-1.5 px-1 text-xs text-muted tabular-nums">Total: {soles(totalProximos)}{proximos.length > 5 ? ` · ${proximos.length - 5} más en Pagos` : ""}</p>
            </>
          )}
        </section>
      )}

      {presupuestos.length > 0 && (
        <section className="card space-y-3 p-4" aria-label="Presupuestos del mes">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Presupuestos de este mes</h2>
            <Link href="/presupuestos" className="text-xs text-muted hover:text-fg">Ver todos ›</Link>
          </div>
          {enAlerta.length === 0 ? (
            <p className="text-sm text-pos"><span aria-hidden>✓</span> Todos tus presupuestos están en orden.</p>
          ) : (
            enAlerta.map((x) => (
              <div key={x.id} className="space-y-1.5">
                <div className="flex justify-between text-sm"><span>{x.category}</span><span className="tabular-nums text-muted">{x.estado.porcentaje} %</span></div>
                <BarraSobre e={x.estado} />
                <DetalleSobre e={x.estado} />
              </div>
            ))
          )}
        </section>
      )}

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">Gasto por {serie.punto === "dia" ? "día" : "mes"}</h2>
        <GraficoGasto datos={serie.datos} punto={serie.punto} />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">Necesidades, deseos y deudas</h2>
        <BarraNaturaleza valores={{ necesidad: r.necesidad, deseo: r.deseo, deuda: r.deuda }} />
      </section>

      <section className="card p-4">
        <h2 className="mb-1 text-sm font-semibold">¿En qué estoy gastando?</h2>
        <p className="mb-3 text-xs text-muted">Principales categorías {periodoTxt}, frente al periodo anterior.</p>
        {categorias.length === 0 ? (
          <p className="text-sm text-muted">Sin gastos en este periodo.</p>
        ) : (
          <ul className="space-y-3">
            {categorias.map((c) => (
              <li key={c.categoria}>
                <Link href={`/movimientos?${qsCat(c.categoria)}`} aria-label={`Ver movimientos de ${c.categoria}`}
                  className="-mx-2 block rounded-lg px-2 py-1 transition hover:bg-bg">
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{c.categoria}</span>
                    <span className="shrink-0 tabular-nums">{soles(c.actual)} ›</span>
                  </div>
                  <div className="h-2 rounded-full bg-bg">
                    <div className="h-2 rounded-full bg-[var(--serie-1)]" style={{ width: `${(c.actual / maxCat) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted tabular-nums">
                    {c.delta === null ? "Nuevo en este periodo" : c.delta === 0 ? "Igual que antes" : (
                      <>
                        <span className={c.delta > 0 ? "text-neg" : "text-pos"}>{c.delta > 0 ? "▲" : "▼"} {Math.abs(c.delta)} %</span>
                        {" "}vs. {soles(c.anterior)}
                      </>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "pos" | "neg" }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : ""}`}>{soles(value)}</p>
    </div>
  );
}
