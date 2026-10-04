import { notFound } from "next/navigation";
import { EditarMovimiento } from "@/components/EditarMovimiento";
import { obtenerMovimiento } from "@/lib/queries";

export default async function EditarPage({ params }: PageProps<"/movimientos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await obtenerMovimiento(id);
  if (!t) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Editar movimiento</h1>
      <EditarMovimiento t={t} />
    </div>
  );
}
