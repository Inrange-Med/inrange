/** The heading of a list under the prose (medicines, follow-ups, record updates), with its tick. */

import { Check } from "@phosphor-icons/react";
import type { NoteListKey } from "@/types/clinicalNote";
import { checkSection } from "@/app/doctor-dashboard/notes/components/noteEdits";
import { TITLES } from "@/app/doctor-dashboard/notes/components/noteState";
import { useNoteReview } from "./NoteReviewContext";
import SectionCheckButton from "./SectionCheckButton";
import SectionHead from "./SectionHead";
import styles from "./NoteSections.module.css";

export default function ListSectionHead({ listKey }: { listKey: NoteListKey }) {
  const review = useNoteReview();
  const on = !!review.note.checks[listKey];
  return (
    <SectionHead
      sectionKey={listKey}
      title={TITLES[listKey]}
      meta={
        review.done ? null : on ? (
          <>
            <Check
              size={13}
              weight="bold"
              className={styles.metaTick}
              aria-hidden="true"
            />{" "}
            Checked
          </>
        ) : review.note.transcribed ? (
          "Found by the scribe"
        ) : null
      }
    >
      {!review.done && (
        <SectionCheckButton
          on={on}
          title={TITLES[listKey]}
          onClick={() => review.apply(checkSection(review.note, listKey, !on))}
        />
      )}
    </SectionHead>
  );
}
