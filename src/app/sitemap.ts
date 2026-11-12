import type { MetadataRoute } from "next";
import { ALL, SITE, UPDATED } from "@/components/landing/tools/catalog";
import { HEIGHT_INCHES, heightSlug } from "@/components/landing/tools/data";
import { PROGRAMMES, programmeHref } from "@/components/landing/programme-data";

const at = new Date(UPDATED);

// trailingSlash is on (next.config.ts): list the final URLs, not ones that redirect
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number) => ({
    url: `${SITE}${path.endsWith("/") ? path : `${path}/`}`,
    lastModified: at,
    changeFrequency: "monthly" as const,
    priority,
  });
  return [
    page("/", 1),
    page("/programmes", 0.9),
    ...PROGRAMMES.map((x) => page(programmeHref(x), x.live ? 0.9 : 0.7)),
    page("/doctors", 0.8),
    page("/tools", 0.8),
    page("/guides", 0.8),
    ...ALL.map((r) => page(r.href, 0.8)),
    ...HEIGHT_INCHES.map((i) =>
      page(`/tools/ideal-weight/${heightSlug(i)}`, 0.5),
    ),
    page("/editorial-standards", 0.4),
  ];
}
