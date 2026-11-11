import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { Mask, Tag } from "./ui";
import { find } from "./tools/catalog";
import h from "./tools/Hub.module.css";
import s from "./Resources.module.css";

/*
  Free tools and guides, linked from the homepage: the answers people search for, one tap from the
  site's strongest page. Useful to visitors who are not ready to start, and it tells search engines
  which pages matter.
*/
const PICKS = [
  "/tools/diabetes-risk-score",
  "/tools/ideal-weight-calculator",
  "/guides/blood-sugar-level-chart",
  "/guides/hba1c-chart",
  "/guides/fatty-liver-grades",
  "/tools/protein-calculator",
];

export default function Resources() {
  const items = PICKS.map(find).filter((r) => r !== undefined);
  return (
    <section id="resources" className={`section ${s.resources}`} aria-labelledby="resources-title">
      <div className={`wrap ${s.grid}`}>
        <div className={s.intro}>
          <Tag>Free tools and guides</Tag>
          <Mask id="resources-title" className="h2" lines={["Answers first,", "on Indian numbers."]} soft={1} />
          <p className="body" suppressHydrationWarning data-reveal="rise" style={{ "--d": "140ms" } as React.CSSProperties}>
            Check your risk, read a report or plan a vrat, with the thresholds used for Indians. No sign&#8209;up, and nothing you
            enter is saved.
          </p>
          <a href="/tools" className={s.all} suppressHydrationWarning data-reveal="rise" style={{ "--d": "220ms" } as React.CSSProperties}>
            All free tools and guides
          </a>
        </div>
        <ol className={h.list}>
          {items.map((t, i) => (
            <li key={t.href} suppressHydrationWarning data-reveal="rise" style={{ "--d": `${i * 60}ms` } as React.CSSProperties}>
              <a href={t.href} className={h.row}>
                <span className={h.name}>{t.name}</span>
                <span className={h.asks}>&ldquo;{t.asks}&rdquo;</span>
                <span className={h.go} aria-hidden="true">
                  <ArrowUpRight size={20} />
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
