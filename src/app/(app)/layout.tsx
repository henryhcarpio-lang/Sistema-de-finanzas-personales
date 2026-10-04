import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { cerrarSesion } from "../login/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pb-28 pt-4 md:max-w-3xl md:pb-10">
      <header className="mb-4 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tracking-tight">
          <span className="text-brand">●</span> Finanzas
        </span>
        <div className="hidden md:block"><BottomNav /></div>
        <div className="flex items-center gap-4">
          <Link href="/categorias" className="text-xs text-muted hover:text-fg">Categorías</Link>
          <form action={cerrarSesion}>
            <button className="text-xs text-muted hover:text-fg">Salir</button>
          </form>
        </div>
      </header>
      <main>{children}</main>
      <div className="md:hidden"><BottomNav /></div>
    </div>
  );
}
