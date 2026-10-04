import type { MetadataRoute } from "next";

/** Permite "Agregar a la pantalla de inicio" con icono propio y abrir sin barra del navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finanzas personales",
    short_name: "Finanzas",
    description: "Registra tus gastos en segundos, por voz o texto.",
    lang: "es-PE",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7f9",
    theme_color: "#0d9488",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
