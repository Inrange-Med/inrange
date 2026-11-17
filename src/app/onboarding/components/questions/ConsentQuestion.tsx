"use client";

/**
 * Question 8: one tick for the four consents care needs, the documents behind "Read them", and
 * the optional AI scribe as its own choice (never bundled with the care consents).
 */

import { useState, type MouseEvent } from "react";
import { CaretDown, CaretRight, Check } from "@phosphor-icons/react";
import Sheet from "@/components/ui/Sheet";
import type { ConsentText, ConsentType } from "@/types/onboarding";
import type {
  DraftChanges,
  OnboardingDraft,
} from "@/app/onboarding/onboardingDraft";
import pageStyles from "@/app/onboarding/OnboardingPage.module.css";
import styles from "./ConsentQuestion.module.css";

type Props = {
  consents: ConsentText[];
  draft: OnboardingDraft;
  update: (changes: DraftChanges) => void;
};

export default function ConsentQuestion({ consents, draft, update }: Props) {
  const [openDocument, setOpenDocument] = useState<ConsentType | null>(null);
  const requiredConsents = consents
    .filter((consent) => consent.required)
    .map((consent) => consent.type);
  const titleOf = (type: ConsentType | null) =>
    consents.find((consent) => consent.type === type)?.title ?? "";
  const allRequired = requiredConsents.every((type) =>
    draft.consents.includes(type),
  );
  const aiAgreed = draft.consents.includes("AI");
  const whatsappAgreed = draft.consents.includes("WHATSAPP");
  const shownConsent = consents.find(
    (consent) => consent.type === openDocument,
  );

  // a link inside the tick's label: it opens the document and leaves the tick alone
  const openFromLabel = (type: ConsentType) => (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenDocument(type);
  };

  return (
    <div className={styles.consents}>
      <label className={pageStyles.agree} data-on={allRequired}>
        <input
          type="checkbox"
          className={pageStyles.check}
          checked={allRequired}
          onChange={() =>
            update({
              consents: allRequired
                ? draft.consents.filter(
                    (type) => !requiredConsents.includes(type),
                  )
                : [...new Set([...draft.consents, ...requiredConsents])],
            })
          }
        />
        <i className={pageStyles.mark} data-multi="true" aria-hidden="true">
          <Check size={12} weight="bold" />
        </i>
        <span className={pageStyles.agreeText}>
          <strong>I agree</strong> to the terms, privacy notice, use of my
          health details and video consultations.
        </span>
      </label>
      <details className={styles.readDocs}>
        <summary>
          Read them
          <CaretDown
            size={14}
            weight="bold"
            className={styles.readCaret}
            aria-hidden="true"
          />
        </summary>
        <ul>
          {requiredConsents.map((type) => (
            <li key={type}>
              <button type="button" onClick={() => setOpenDocument(type)}>
                {titleOf(type)}
                <CaretRight size={14} weight="bold" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </details>
      <label
        className={pageStyles.agree}
        data-on={aiAgreed}
        data-optional="true"
      >
        <input
          type="checkbox"
          className={pageStyles.check}
          checked={aiAgreed}
          onChange={() =>
            update({
              consents: aiAgreed
                ? draft.consents.filter((type) => type !== "AI")
                : [...draft.consents, "AI"],
            })
          }
        />
        <i className={pageStyles.mark} data-multi="true" aria-hidden="true">
          <Check size={12} weight="bold" />
        </i>
        <span className={pageStyles.agreeText}>
          <strong>Optional.</strong> Let an{" "}
          <a
            href="#ai"
            className={styles.docLink}
            onClick={openFromLabel("AI")}
          >
            AI&nbsp;scribe
          </a>{" "}
          transcribe my video calls to draft my doctor&rsquo;s notes.
        </span>
      </label>

      {consents.some((consent) => consent.type === "WHATSAPP") && (
        <label
          className={pageStyles.agree}
          data-on={whatsappAgreed}
          data-optional="true"
        >
          <input
            type="checkbox"
            className={pageStyles.check}
            checked={whatsappAgreed}
            onChange={() =>
              update({
                consents: whatsappAgreed
                  ? draft.consents.filter((type) => type !== "WHATSAPP")
                  : [...draft.consents, "WHATSAPP"],
              })
            }
          />
          <i className={pageStyles.mark} data-multi="true" aria-hidden="true">
            <Check size={12} weight="bold" />
          </i>
          <span className={pageStyles.agreeText}>
            <strong>Optional.</strong> Updates about my care from inrange
            on{" "}
            <a
              href="#whatsapp"
              className={styles.docLink}
              onClick={openFromLabel("WHATSAPP")}
            >
              WhatsApp
            </a>
            : bookings, blood tests, any prescription, orders and reminders.
          </span>
        </label>
      )}
      <Sheet
        open={!!openDocument}
        onClose={() => setOpenDocument(null)}
        title={titleOf(openDocument)}
      >
        {shownConsent && (
          <div className={styles.docs}>
            <p className={styles.docLead}>{shownConsent.line}</p>
            <p>{shownConsent.more}</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
