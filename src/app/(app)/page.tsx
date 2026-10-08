import { RegistroRapido } from "@/components/RegistroRapido";
import { TxList } from "@/components/TxList";
import { listarCategorias, listarMovimientos, listarPreferencias, mapaCategorias, obtenerAjustes } from "@/lib/queries";

export default async function RegistrarPage() {
  const [recientes, prefs, categorias, ajustes] = await Promise.all([
    listarMovimientos({ limit: 8 }), listarPreferencias(), listarCategorias(), obtenerAjustes(),
  ]);
  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-5">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">¿Qué movimiento hiciste?</h1>
        <RegistroRapido prefs={prefs} categorias={categorias}
          voz={{ activa: ajustes.voz_activa, idioma: ajustes.voz_idioma }} cuenta={ajustes.cuenta_defecto} />
      </div>
      <section className="space-y-2 lg:pt-14">
        <h2 className="text-sm font-semibold text-muted">Últimos movimientos</h2>
        <TxList items={recientes} cats={mapaCategorias(categorias)} empty="Aún no hay movimientos. Dicta o escribe “un sol pasaje” para empezar." />
      </section>
    </div>
  );
}
