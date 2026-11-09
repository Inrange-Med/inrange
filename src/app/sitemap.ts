/** /sitemap.xml, built once at build time: only the public homepage is listed. */

import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://inrange.in/",
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
