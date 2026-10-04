import { CuotaFila } from "@/components/CuotaFila";
import { EliminarCompromiso } from "@/components/EliminarCompromiso";
import { FormCompromiso } from "@/components/FormCompromiso";
import { calendario, fraseFrecuencia, proximaCuota, resumenDeuda } from "@/lib/compromisos";
import { etiquetaFecha, soles, todayLima } from "@/lib/dates";
import { listarCategorias, listarCompromisos, listarPagos } from "@/lib/queries";

export default async function PagosPage() {
  const [compromisos, pagos, categorias] = await Promise.all([listarCompromisos(), listarPagos(), listarCategorias()]);
  const hoy = todayLima();
  const cuotas = calendario(compromisos, pagos, hoy, 30).filter((c) => c.estado !== "pagada");
  const vencidas = cuotas.filter((c) => c.estado === "vencida");
  const totalPendiente = cuotas.reduce((s, c) => s + c.compromiso.amount, 0);
  const deudas = compromisos.filter((c) => c.kind === "deuda");
  const recurrentes = compromisos.filter((c) => c.kind === "recurrente");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deudas y pagos</h1>
        <p className="mt-1 text-sm text-muted">Una cuota solo se vuelve gasto cuando la pagas.</p>
      </div>

      <FormCompromiso categorias={categorias.map((c) => c.name)} />

      {compromisos.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          Agrega tus préstamos, tarjetas y pagos fijos (alquiler, internet, suscripciones) para ver aquí qué viene y no olvidar ninguno.
        </div>
      ) : (
        <>
          <section aria-label="Por pagar">
            <div className="mb-1.5 flex items-baseline justify-between px-1">
              <h2 className="text-sm font-semibold">Por pagar · próximos 30 días</h2>
              <span className="text-xs text-muted tabular-nums" data-testid="total-pendiente">{soles(totalPendiente)}</span>
            </div>
            {vencidas.length > 0 && (
              <p className="mb-2 rounded-xl bg-neg/10 px-3 py-2 text-sm text-neg" role="status">
                <span aria-hidden>! </span>{vencidas.length} {vencidas.length === 1 ? "cuota vencida" : "cuotas vencidas"} sin registrar
              </p>
            )}
            {cuotas.length === 0 ? (
              <div className="card p-4 text-center text-sm text-pos"><span aria-hidden>✓</span> Nada pendiente en los próximos 30 días.</div>
            ) : (
              <ul className="card divide-y divide-line overflow-hidden">
                {cuotas.map((c) => <CuotaFila key={`${c.compromiso.id}|${c.fecha}`} cuota={c} />)}
              </ul>
            )}
          </section>

          {deudas.length > 0 && (
            <section className="space-y-2" aria-label="Deudas">
              <h2 className="px-1 text-sm font-semibold">Deudas</h2>
              {deudas.map((d) => {
                const r = resumenDeuda(d, pagos);
                const prox = proximaCuota(d, pagos, hoy);
                return (
                  <article key={d.id} className="card space-y-2 p-4" aria-label={`Deuda ${d.name}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="truncate font-semibold">{d.name}</h3>
                      <span className="shrink-0 text-sm tabular-nums">{soles(d.amount)} <span className="text-muted">{fraseFrecuencia(d)}</span></span>
                    </div>
                    {r.progreso !== null && (
                      <div className="h-2.5 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                        aria-valuenow={Math.round(r.progreso * 100)} aria-valuetext={`${Math.round(r.progreso * 100)} % pagado`}>
                        <div className="h-full rounded-full bg-brand" style={{ width: `${r.progreso * 100}%` }} />
                      </div>
                    )}
                    <p className="text-xs text-muted tabular-nums" data-testid="resumen-deuda">
                      {r.saldo !== null && <>Saldo <b className="text-fg">{soles(r.saldo)}</b> · </>}
                      Pagado {soles(r.pagado)}
                      {r.cuotasTotal ? ` · ${r.cuotasPagadas}/${r.cuotasTotal} cuotas` : ` · ${r.cuotasPagadas} cuotas`}
                    </p>
                    <p className="text-xs text-muted">
                      {[d.creditor, d.interest_rate !== null ? `${d.interest_rate} % anual` : null,
                        prox ? `próxima: ${etiquetaFecha(prox.fecha, hoy)}` : "sin cuotas pendientes"].filter(Boolean).join(" · ")}
                    </p>
                    <div className="text-right"><EliminarCompromiso id={d.id} nombre={d.name} /></div>
                  </article>
                );
              })}
            </section>
          )}

          {recurrentes.length > 0 && (
            <section className="space-y-2" aria-label="Pagos recurrentes">
              <h2 className="px-1 text-sm font-semibold">Pagos recurrentes</h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {recurrentes.map((c) => {
                  const prox = proximaCuota(c, pagos, hoy);
                  return (
                    <li key={c.id} className="space-y-1 px-4 py-3" aria-label={`Recurrente ${c.name}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <span className="shrink-0 text-sm tabular-nums">{soles(c.amount)} <span className="text-muted">{fraseFrecuencia(c)}</span></span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted">{c.category}{prox ? ` · próximo: ${etiquetaFecha(prox.fecha, hoy)}` : ""}</span>
                        <EliminarCompromiso id={c.id} nombre={c.name} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
