/* /patient-dashboard/resources/[slug]: one guide or video. Unknown slugs are a 404; GuideView shows the rest. */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuideView from "../components/GuideView";
import { GUIDES } from "../content/guideContent";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${GUIDES.find((guide) => guide.slug === slug)?.title ?? "Guide"} | inrange`,
  };
}

export default async function GuidePage({ params }: Params) {
  const { slug } = await params;
  if (!GUIDES.some((guide) => guide.slug === slug)) notFound();
  return <GuideView slug={slug} />;
}
