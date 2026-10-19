import type { MetadataRoute } from "next";

/** "Add to home screen": Alumnity opens like an app (and, on iPhones, can then send notifications). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alumnity · HKBK College of Engineering",
    short_name: "Alumnity",
    description: "The alumni and student network of HKBK College of Engineering.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f7f1e6",
    theme_color: "#f7f1e6",
    icons: [
      { src: "/assets/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/assets/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/assets/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
