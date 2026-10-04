import { RegistroRapido } from "@/components/RegistroRapido";
import { TxList } from "@/components/TxList";
import { listarMovimientos } from "@/lib/queries";

export default async function RegistrarPage() {
  const recientes = await listarMovimientos({ limit: 8 });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">¿Qué movimiento hiciste?</h1>
      <RegistroRapido />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted">Últimos movimientos</h2>
        <TxList items={recientes} empty="Aún no hay movimientos. Escribe arriba “un sol pasaje” para empezar." />
      </section>
    </div>
  );
}
