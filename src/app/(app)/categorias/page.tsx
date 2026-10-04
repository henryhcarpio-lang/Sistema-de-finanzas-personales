import { GestorCategorias } from "@/components/GestorCategorias";
import { listarCategorias } from "@/lib/queries";

export default async function CategoriasPage() {
  const categorias = await listarCategorias();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Categorías</h1>
        <p className="mt-1 text-sm text-muted">La naturaleza se propone al elegir la categoría al registrar.</p>
      </div>
      <GestorCategorias categorias={categorias} />
    </div>
  );
}
