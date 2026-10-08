import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Registra tus finanzas en segundos",
  applicationName: "Finanzas",
  // iPhone: al agregar a la pantalla de inicio abre a pantalla completa con este nombre.
  appleWebApp: { capable: true, title: "Finanzas", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Tema y tamaño de texto de Configuración: en cookie para pintar bien desde el primer render.
  const c = await cookies();
  const tema = c.get("tema")?.value;
  const texto = c.get("texto")?.value;
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}
      data-tema={tema === "claro" || tema === "oscuro" ? tema : undefined}
      data-texto={texto === "grande" || texto === "muy-grande" ? texto : undefined}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
