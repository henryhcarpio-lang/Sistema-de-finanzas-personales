import { createElement } from "react";
import { iconoDe } from "@/lib/iconos";

/** Icono de una categoría sobre un fondo suave de su color. */
export function IconoCategoria({ icono, color, size = "md" }: { icono?: string | null; color?: string | null; size?: "sm" | "md" | "lg" }) {
  const c = color ?? "#6b7280";
  const caja = size === "lg" ? "size-14 rounded-2xl" : size === "sm" ? "size-8 rounded-lg" : "size-11 rounded-xl";
  const px = size === "lg" ? 26 : size === "sm" ? 16 : 22;
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center ${caja}`}
      style={{ backgroundColor: `${c}1f`, color: c }}>
      {createElement(iconoDe(icono), { size: px, strokeWidth: 2 })}
    </span>
  );
}
