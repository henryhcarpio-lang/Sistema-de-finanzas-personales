import Link from "next/link";
import { GestorCategorias } from "@/components/GestorCategorias";
import { conteoCategoriasMes, listarCategorias } from "@/lib/queries";

export default async function CategoriasPage() {
  const [categorias, conteo] = await Promise.all([listarCategorias(), conteoCategoriasMes()]);
  return (
    <div className="space-y-4">
      <div>
        <Link href="/configuracion" className="tap -ml-2 inline-flex items-center px-2 text-sm font-medium text-brand">‹ Configuración</Link>
        <h1 className="text-2xl font-bold tracking-tight">Categorías</h1>
        <p className="mt-1 text-sm text-muted">Toca una categoría para cambiar su nombre, icono, color o grupo. Entre paréntesis, movimientos de este mes.</p>
      </div>
      <GestorCategorias categorias={categorias} conteo={conteo} />
    </div>
  );
}
