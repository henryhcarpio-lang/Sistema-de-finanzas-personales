import { PeriodoSelector, leerPeriodo } from "@/components/PeriodoSelector";
import { periodoAnterior, rangoPeriodo, soles, todayLima } from "@/lib/dates";
import { listarMovimientos, resumir } from "@/lib/queries";

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const p = leerPeriodo(sp.p);
  const rango = rangoPeriodo(p, todayLima(), { from: str(sp.from), to: str(sp.to) });
  const [txs, prev] = await Promise.all([
    listarMovimientos({ rango }),
    listarMovimientos({ rango: periodoAnterior(rango) }),
  ]);
  const r = resumir(txs);
  const gastoPrev = resumir(prev).gastos;
  const delta = gastoPrev > 0 ? Math.round(((r.gastos - gastoPrev) / gastoPrev) * 100) : null;
  const maxCat = r.categorias[0]?.[1] ?? 0;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Mi situación financiera</h1>
      <PeriodoSelector base="/dashboard" actual={p} from={rango.from} to={rango.to} />
      <p className="text-xs text-muted">{rango.from} → {rango.to}</p>

      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Ingresos" value={r.ingresos} tone="pos" />
        <Kpi label="Gastos" value={r.gastos} />
        <Kpi label="Balance" value={r.balance} tone={r.balance < 0 ? "neg" : "pos"} />
        <Kpi label="Ahorro" value={r.ahorro} />
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">Necesidades, deseos y deudas</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["Necesidades", r.necesidad], ["Deseos", r.deseo], ["Deudas", r.deuda]].map(([l, v]) => (
            <div key={l as string}><p className="text-xs text-muted">{l}</p><p className="font-semibold tabular-nums">{soles(v as number)}</p></div>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">¿En qué estoy gastando?</h2>
        {r.categorias.length === 0 ? (
          <p className="text-sm text-muted">Sin gastos en este periodo.</p>
        ) : (
          <ul className="space-y-3">
            {r.categorias.map(([cat, v]) => (
              <li key={cat}>
                <div className="mb-1 flex justify-between text-sm"><span>{cat}</span><span className="tabular-nums">{soles(v)}</span></div>
                <div className="h-2 rounded-full bg-bg"><div className="h-2 rounded-full bg-brand" style={{ width: `${(v / maxCat) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {delta !== null && (
        <section className="card p-4 text-sm">
          <h2 className="mb-1 font-semibold">Comparación</h2>
          <p className="text-muted">
            Gastaste <span className={delta > 0 ? "font-semibold text-neg" : "font-semibold text-pos"}>{Math.abs(delta)} % {delta > 0 ? "más" : "menos"}</span> que el periodo anterior.
          </p>
        </section>
      )}
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
