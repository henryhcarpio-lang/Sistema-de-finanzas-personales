import { RegistroRapido } from "@/components/RegistroRapido";
import { TxList } from "@/components/TxList";
import { listarCategorias, listarMovimientos, listarPreferencias } from "@/lib/queries";

export default async function RegistrarPage() {
  const [recientes, prefs, categorias] = await Promise.all([
    listarMovimientos({ limit: 8 }), listarPreferencias(), listarCategorias(),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">¿Qué movimiento hiciste?</h1>
      <RegistroRapido prefs={prefs} categorias={categorias} />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted">Últimos movimientos</h2>
        <TxList items={recientes} empty="Aún no hay movimientos. Dicta o escribe “un sol pasaje” para empezar." />
      </section>
    </div>
  );
}
