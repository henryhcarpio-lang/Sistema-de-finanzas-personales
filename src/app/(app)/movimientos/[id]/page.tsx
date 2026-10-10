import { notFound } from "next/navigation";
import { EditarMovimiento } from "@/components/EditarMovimiento";
import { listarCategorias, obtenerMovimiento } from "@/lib/queries";

export default async function EditarPage({ params }: PageProps<"/movimientos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, categorias] = await Promise.all([obtenerMovimiento(id), listarCategorias()]);
  if (!t) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Editar movimiento</h1>
      <p className="text-sm text-muted">Si cambias tipo, categoría o naturaleza, la app lo recordará para “{t.concept}”.</p>
      <EditarMovimiento t={t} categorias={categorias} />
    </div>
  );
}
