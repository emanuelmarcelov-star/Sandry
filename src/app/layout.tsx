import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AvisoSinConexion, RegistroServiceWorker } from "@/components/pwa";
import { textos } from "@/lib/textos";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: textos.app.nombre,
  description: textos.app.descripcion,
  applicationName: textos.app.nombre,
  appleWebApp: { capable: true, title: textos.app.nombre, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-EC"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AvisoSinConexion />
        <RegistroServiceWorker />
        {children}
      </body>
    </html>
  );
}
