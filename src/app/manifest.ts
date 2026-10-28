import type { MetadataRoute } from "next";
import { textos } from "@/lib/textos";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: textos.app.nombre,
    short_name: textos.app.nombre,
    description: textos.app.descripcion,
    lang: "es-EC",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#15803d",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
