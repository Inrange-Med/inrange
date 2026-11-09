/** /robots.txt, built once at build time: crawlers may visit, and the sitemap is on inrangemed.com. */

import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://inrangemed.com/sitemap.xml",
  };
}
