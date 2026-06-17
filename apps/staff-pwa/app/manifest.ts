import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f6f2f4",
    description: "Agenda personale, richieste disponibilità e report staff.",
    display: "standalone",
    icons: [
      {
        sizes: "192x192",
        src: "/icon-192.png",
        type: "image/png"
      },
      {
        sizes: "512x512",
        src: "/icon-512.png",
        type: "image/png"
      }
    ],
    name: "EsseBeauty Staff",
    short_name: "Staff",
    start_url: "/",
    theme_color: "#402334"
  };
}
