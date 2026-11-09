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
        <Link href="/" aria-label="InRange home" className={styles.home}>
          <Wordmark />
        </Link>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.pilot}>
          Pilot version, for invited people. Counsel reviews this text and
          replaces it before public launch.
        </p>
        <p className={styles.intro}>{intro}</p>
        {sections.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2>{section.heading}</h2>
            {section.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ))}
        <p className={styles.contact}>
          Questions: <a href="mailto:care@inrangemed.com">care@inrangemed.com</a>
        </p>
      </main>
    </AppTheme>
  );
}
