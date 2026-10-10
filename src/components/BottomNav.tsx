"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Registrar", corto: "Registrar", icon: "M12 5v14M5 12h14" },
  { href: "/dashboard", label: "Resumen", corto: "Resumen", icon: "M4 19V10M10 19V5M16 19v-6M22 19H2" },
  { href: "/movimientos", label: "Movimientos", corto: "Historial", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/presupuestos", label: "Presupuestos", corto: "Presupuesto", icon: "M3 7h18v12H3zM3 7l3-3h12l3 3M12 11v4M10 13h4" },
  { href: "/pagos", label: "Deudas y pagos", corto: "Pagos", icon: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4" },
];

const esActivo = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

function Icono({ d, size }: { d: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Barra inferior para celular y tablet: 5 zonas iguales de ancho completo. */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {ITEMS.map((it) => {
          const activo = esActivo(path, it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={activo ? "page" : undefined} aria-label={it.label}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 text-[12px] font-semibold tracking-tight transition ${
                  activo ? "text-brand" : "text-muted active:text-fg"
                }`}>
                {activo && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-brand" aria-hidden />}
                <Icono d={it.icon} size={24} />
                <span className="w-full truncate text-center">{it.corto}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Navegación lateral para computadora. */
export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Principal">
      <ul className="space-y-1">
        {ITEMS.map((it) => {
          const activo = esActivo(path, it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={activo ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium transition ${
                  activo ? "bg-brand/10 text-brand" : "text-muted hover:bg-bg hover:text-fg"
                }`}>
                <Icono d={it.icon} size={22} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
