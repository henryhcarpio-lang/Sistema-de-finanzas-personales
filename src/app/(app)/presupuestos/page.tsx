import { GestorPresupuestos } from "@/components/GestorPresupuestos";
import { soles } from "@/lib/dates";
import { listarCategorias, listarPresupuestos, mesActual, obtenerAjustes } from "@/lib/queries";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default async function PresupuestosPage() {
  const [presupuestos, categorias] = await Promise.all([listarPresupuestos((await obtenerAjustes()).umbral_presupuesto / 100), listarCategorias()]);
  const { rango, dia, diasMes } = mesActual();
  const limite = presupuestos.reduce((s, p) => s + p.monthly_limit, 0);
  const gastado = presupuestos.reduce((s, p) => s + p.estado.gastado, 0);
  const nombres = categorias.filter((c) => c.nature !== "ahorro" && c.name !== "Ahorro").map((c) => c.name);
  const avisos = presupuestos.filter((p) => p.estado.nivel !== "ok").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Presupuestos</h1>
        <p className="mt-1 text-sm text-muted">
          {MESES[Number(rango.from.slice(5, 7)) - 1]} · día {dia} de {diasMes}. Son una guía: nunca bloquean un gasto.
        </p>
      </div>
      {presupuestos.length > 0 && (
        <section className="card grid grid-cols-3 gap-2 p-4 text-center text-sm" aria-label="Resumen del mes">
          <div><p className="text-xs text-muted">Presupuestado</p><p className="font-semibold tabular-nums">{soles(limite)}</p></div>
          <div><p className="text-xs text-muted">Gastado</p><p className="font-semibold tabular-nums">{soles(gastado)}</p></div>
          <div><p className="text-xs text-muted">Disponible</p><p className={`font-semibold tabular-nums ${limite - gastado < 0 ? "text-neg" : "text-pos"}`}>{soles(limite - gastado)}</p></div>
          {avisos > 0 && <p className="col-span-3 pt-1 text-xs text-warn" data-testid="avisos"><span aria-hidden>!</span> {avisos} {avisos === 1 ? "presupuesto necesita" : "presupuestos necesitan"} atención</p>}
        </section>
      )}
      <GestorPresupuestos presupuestos={presupuestos} categorias={nombres} />
    </div>
  );
}
