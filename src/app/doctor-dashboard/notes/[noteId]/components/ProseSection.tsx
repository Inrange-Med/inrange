/**
 * One prose section of the note (summary, assessment, plan, or the patient's summary): its
 * sentences, flags and evidence, an editor in place, and "For the patient" as a preview of the app.
 */

import { Fragment } from "react";
import { Check } from "@phosphor-icons/react";
import Avatar from "@/components/ui/Avatar";
import type { NoteSectionKey } from "@/types/clinicalNote";
import { checkSection } from "@/app/doctor-dashboard/notes/components/noteEdits";
import {
  firstName,
  isEdited,
  sectionOf,
  TITLES,
} from "@/app/doctor-dashboard/notes/components/noteState";
import { PROMPT } from "@/app/doctor-dashboard/notes/components/noteFormat";
import { useNoteReview } from "./NoteReviewContext";
import NoteSentenceLink from "./NoteSentenceLink";
import SectionCheckButton from "./SectionCheckButton";
import SectionEditor from "./SectionEditor";
import SectionHead from "./SectionHead";
import SectionMoreMenu from "./SectionMoreMenu";
import SentenceUnder from "./SentenceUnder";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./NoteSections.module.css";

export default function ProseSection({
  sectionKey,
  isWriting,
}: {
  sectionKey: NoteSectionKey;
  isWriting: boolean;
}) {
  const review = useNoteReview();
  const { note, done } = review;
  const section = sectionOf(note, sectionKey);
  const title = TITLES[sectionKey];
  const edited = isEdited(section);
  const editing = review.editing?.key === sectionKey;
  const allDoctor =
    section.current.length > 0 &&
    section.current.every((sentence) => sentence.by === "doctor");
  const meta =
    isWriting || done || !section.current.length ? null : section.checked ? (
      <>
        <Check
          size={13}
          weight="bold"
          className={styles.metaTick}
          aria-hidden="true"
        />{" "}
        Checked
      </>
    ) : allDoctor && !section.draft.length ? (
      "Written by you"
    ) : edited ? (
      "Edited by you"
    ) : (
      "Drafted by the scribe"
    );
  const appLine =
    sectionKey === "patient" && !done
      ? `Shown in ${firstName(note)}'s app after you sign`
      : null;
  const plan = sectionOf(note, "plan").current;

  const body = isWriting ? (
    <div className={styles.skel} aria-hidden="true">
      <span style={{ width: "92%" }} />
      <span style={{ width: "80%" }} />
      <span style={{ width: "64%" }} />
    </div>
  ) : editing ? (
    <SectionEditor sectionKey={sectionKey} caret={review.editing?.caret} />
  ) : !section.current.length ? (
    done ? (
      <p className={styles.none}>Nothing recorded.</p>
    ) : (
      <button
        type="button"
        className={styles.emptyBox}
        onClick={() => review.openEditor(sectionKey)}
      >
        {PROMPT[sectionKey]}
      </button>
    )
  ) : sectionKey === "plan" ? (
    <ul className={styles.planList}>
      {section.current.map((sentence) => (
        <li key={sentence.id}>
          <NoteSentenceLink sentence={sentence} />
          <SentenceUnder sectionKey={sectionKey} ids={[sentence.id]} />
        </li>
      ))}
    </ul>
  ) : (
    <>
      <p className={styles.prose}>
        {section.current.map((sentence) => (
          <Fragment key={sentence.id}>
            <NoteSentenceLink sentence={sentence} />{" "}
          </Fragment>
        ))}
      </p>
      <SentenceUnder
        sectionKey={sectionKey}
        ids={section.current.map((sentence) => sentence.id)}
      />
    </>
  );

  return (
    <section
      id={`sec-${sectionKey}`}
      data-sec={sectionKey}
      tabIndex={-1}
      aria-labelledby={`h-${sectionKey}`}
      className={styles.sec}
    >
      <SectionHead
        sectionKey={sectionKey}
        title={title}
        meta={
          <>
            {meta}
            {meta && appLine ? " · " : ""}
            {appLine}
          </>
        }
      >
        {!isWriting && !done && (
          <>
            {section.current.length > 0 && (
              <SectionCheckButton
                on={section.checked}
                title={title}
                onClick={() =>
                  review.apply(checkSection(note, sectionKey, !section.checked))
                }
              />
            )}
            {!editing && section.current.length > 0 && (
              <button
                type="button"
                id={`edit-${sectionKey}`}
                className={`${clinicStyles.textBtn} ${styles.editBtn}`}
                onClick={() => review.openEditor(sectionKey)}
              >
                Edit
              </button>
            )}
            {(section.current.length > 0 || section.draft.length > 0) && (
              <SectionMoreMenu
                sectionKey={sectionKey}
                canRestore={edited && section.draft.length > 0}
                text={section.current
                  .map((sentence) => sentence.text)
                  .join(sectionKey === "plan" ? "\n" : " ")}
              />
            )}
          </>
        )}
      </SectionHead>
      <div
        className={styles.body}
        data-tone={!done && !section.checked ? "draft" : undefined}
      >
        {sectionKey === "patient" &&
        !isWriting &&
        !editing &&
        section.current.length > 0 ? (
          <div className={styles.preview}>
            <p className={styles.previewHead}>
              <Avatar
                name={review.doctor.name}
                src={review.doctor.photoUrl}
                size={24}
              />{" "}
              {review.doctor.name} · after your call
            </p>
            {body}
            {plan.length > 0 && (
              <>
                <p className={styles.nextHead}>Next steps</p>
                <ul className={styles.nextList}>
                  {plan.map((sentence) => (
                    <li key={sentence.id}>{sentence.text}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          body
        )}
      </div>
    </section>
  );
}
