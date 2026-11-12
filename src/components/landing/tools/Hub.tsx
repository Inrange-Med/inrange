import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Motion from "../Motion";
import Nav from "../Nav";
import Footer from "../Footer";
import { Mask, Tag } from "../ui";
import { SITE, type Resource } from "./catalog";
import s from "./Hub.module.css";

function Ledger({ items }: { items: Resource[] }) {
  return (
    <ol className={s.list}>
      {items.map((t, i) => (
        <li key={t.href} suppressHydrationWarning data-reveal="rise" style={{ "--d": `${Math.min(i, 6) * 60}ms` } as React.CSSProperties}>
          <a href={t.href} className={s.row}>
            <span className={s.name}>{t.name}</span>
            <span className={s.asks}>&ldquo;{t.asks}&rdquo;</span>
            <span className={s.what}>{t.what}</span>
            <span className={s.go} aria-hidden="true">
              <ArrowUpRight size={20} />
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/** A hub: an index read like a ledger, then the other kind of resource, so every page is two clicks from every other. */
export default function Hub({
  path,
  tag,
  title,
  lede,
  items,
  also,
  description,
}: {
  path: string;
  tag: string;
  title: string[];
  lede: string;
  items: Resource[];
  also: { tag: string; title: string[]; href: string; label: string; items: Resource[] };
  description: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title.join(" "),
    url: `${SITE}${path}`,
    inLanguage: "en-IN",
    description,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, url: `${SITE}${t.href}` })),
    },
  };
  return (
    <>
      <Motion />
      <Nav home={false} />
      <main id="main" className={s.page}>
        <header className={`wrap ${s.head}`}>
          <Tag>{tag}</Tag>
          <Mask as="h1" className="h2" lines={title} soft={1} />
          <p className="lede" suppressHydrationWarning data-reveal="rise" style={{ "--d": "160ms" } as React.CSSProperties}>
            {lede}
          </p>
        </header>
        <div className="wrap">
          <Ledger items={items} />
          <section className={s.also} aria-labelledby="also-title">
            <div className={s.alsoHead}>
              <div className={s.alsoTitle}>
                <Tag>{also.tag}</Tag>
                <Mask id="also-title" className="h2" lines={also.title} soft={1} />
              </div>
              <a href={also.href}>{also.label}</a>
            </div>
            <Ledger items={also.items.slice(0, 3)} />
          </section>
          <p className={`fineprint ${s.fine}`}>
            General health information for adults in India. It does not replace a consultation, diagnosis or treatment, and
            is not for emergencies: if you feel very unwell, call 112. <a href="/editorial-standards">How we write and check these pages</a>.
          </p>
        </div>
      </main>
      <Footer home={false} field={false} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
