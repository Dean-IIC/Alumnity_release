import type { MetadataRoute } from "next";

/*
 * Search engines may index the pages about Alumnity, and nothing else: no member's page,
 * no gallery photo, nothing behind sign-in, no endpoint. (Members' pages also say noindex.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // The join page and the share card too: link previews (WhatsApp, LinkedIn) read them.
      allow: ["/$", "/about", "/how-it-works", "/community", "/committee", "/developers", "/privacy", "/terms", "/join$", "/og.jpg"],
      disallow: "/"
    }
  };
}
