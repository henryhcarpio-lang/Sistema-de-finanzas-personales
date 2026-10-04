"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Registrar", icon: "M12 5v14M5 12h14" },
  { href: "/dashboard", label: "Dashboard", icon: "M4 19V10M10 19V5M16 19v-6M22 19H2" },
  { href: "/movimientos", label: "Movimientos", icon: "M4 6h16M4 12h16M4 18h10" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:border-0 md:bg-transparent md:pb-0"
    >
      <ul className="mx-auto flex max-w-xl justify-around md:justify-start md:gap-2">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 min-w-20 flex-col items-center justify-center gap-0.5 rounded-xl px-3 text-[11px] font-medium transition md:min-h-10 md:flex-row md:gap-2 md:text-sm ${
                  active ? "text-brand" : "text-muted hover:text-fg"
                }`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d={it.icon} />
                </svg>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
