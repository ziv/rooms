import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "מערכת תיאום חדרים",
    short_name: "Rooms",
    description: "תיאום חדרי טיפול",
    start_url: "/he/calendar",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    background_color: "#ffffff",
    theme_color: "#111111",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
