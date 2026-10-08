import { Settings } from "lucide-react";
import Link from "next/link";
import { BottomNav, SideNav } from "@/components/BottomNav";
import { cerrarSesion } from "../login/actions";

function Logo() {
  return (
    <span className="text-lg font-bold tracking-tight">
      <span className="text-brand">●</span> Finanzas
    </span>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh">
      {/* Computadora: barra lateral fija */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <div className="mb-8 px-3"><Logo /></div>
        <SideNav />
        <div className="mt-auto space-y-1 border-t border-line pt-4">
          <Link href="/configuracion" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-base text-muted hover:bg-bg hover:text-fg">
            <Settings size={22} aria-hidden /> Configuración
          </Link>
          <form action={cerrarSesion}>
            <button className="flex min-h-11 w-full items-center rounded-xl px-3 text-base text-muted hover:bg-bg hover:text-fg">Salir</button>
          </form>
        </div>
      </aside>

      <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-3 sm:max-w-2xl lg:ml-64 lg:max-w-none lg:px-10 lg:pb-12 lg:pt-8">
        <div className="lg:mx-auto lg:max-w-5xl">
          {/* Celular y tablet: cabecera compacta */}
          <header className="mb-3 flex items-center justify-between lg:hidden">
            <Logo />
            <Link href="/configuracion" aria-label="Configuración" className="tap -mr-2 flex items-center justify-center text-muted">
              <Settings size={24} aria-hidden />
            </Link>
          </header>
          <main>{children}</main>
        </div>
      </div>

      <div className="lg:hidden"><BottomNav /></div>
    </div>
  );
}
