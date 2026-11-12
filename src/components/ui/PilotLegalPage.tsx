/**
 * The pilot's legal pages (privacy, terms, grievance): plain sections of text that describe what this
 * build actually does. Each page says it is the pilot version, replaced by counsel's text before launch.
 */
import Link from "next/link";
import AppTheme from "@/components/ui/AppTheme";
import Wordmark from "@/components/ui/Wordmark";
import styles from "./PilotLegalPage.module.css";

export type LegalSection = { heading: string; body: string[] };

export default function PilotLegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <AppTheme>
      <main className={styles.page}>
        <header className={styles.head}>
          <Link href="/" aria-label="inrange home" className={styles.home}>
            <Wordmark />
          </Link>
          <h1 className={`h2 ${styles.title}`}>{title}</h1>
          <p className={styles.pilot} role="note">
            Pilot version, for invited people. Counsel reviews this text and
            replaces it before public launch.
          </p>
          <p className={styles.intro}>{intro}</p>
        </header>
        <div className={styles.body}>
          {sections.map((section) => (
            <section key={section.heading} className={styles.section}>
              <h2 className="h3">{section.heading}</h2>
              <div className={styles.prose}>
                {section.body.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </section>
          ))}
          <p className={styles.contact}>
            Questions:{" "}
            <a href="mailto:care@inrangemed.com">care@inrangemed.com</a>
          </p>
        </div>
      </main>
    </AppTheme>
  );
}
