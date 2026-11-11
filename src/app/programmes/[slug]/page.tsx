import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProgrammeView from "@/components/landing/pages/ProgrammeView";
import { PAGES } from "@/components/landing/pages/programme-pages";
import { PROGRAMMES, programmeHref } from "@/components/landing/programme-data";

/* One pre-built page per programme, open or coming soon. */
export const dynamicParams = false;

export function generateStaticParams() {
  return PROGRAMMES.map((p) => ({ slug: p.slug }));
}

const bySlug = (slug: string) => PROGRAMMES.find((p) => p.slug === slug);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const p = bySlug((await params).slug);
  if (!p) return {};
  const d = PAGES[p.key];
  const href = programmeHref(p);
  return {
    title: d.seo,
    description: d.description,
    alternates: { canonical: href },
    openGraph: {
      title: d.seo.replace(/ \| inrange$/, ""),
      description: d.description,
      url: href,
      locale: "en_IN",
      type: "website",
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = bySlug((await params).slug);
  if (!p) notFound();
  return <ProgrammeView programme={p} />;
}
