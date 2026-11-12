import type { MetadataRoute } from "next";
import { SITE } from "@/components/landing/tools/catalog";

/*
  Every crawler may read the site. The AI search and user-fetch crawlers are named explicitly, so a
  future blanket rule, or a CDN bot filter, can't shut them out by accident: they are how pages get
  quoted in ChatGPT, Claude, Perplexity and Copilot answers.
*/
const AI_SEARCH = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "bingbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_SEARCH, allow: "/" },
      { userAgent: "*", allow: "/" },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
