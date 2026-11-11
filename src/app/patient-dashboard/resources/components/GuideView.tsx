"use client";

/*
  One guide or video inside the app (Arhaan Guides.tsx GuidePage): the video at the top, its
  presenter, then the written version. A guide with no video shows its summary in the left column
  instead. The first injection's walk-through opens in place, one step a screen, in the shell's
  focus mode (its name in the bar, Close back to the guide, no dock). A guide only for
  someone prescribed a pen opens only when it has a video, as in Arhaan's design for a patient with
  no pen on record (the backend does not expose prescriptions yet).
*/

import { useState } from "react";
import Avatar from "@/components/ui/Avatar";
import PageHead from "@/components/ui/PageHead";
import { useShellFocus } from "@/app/patient-dashboard/components/shellFocus";
import { GUIDES, PRESENTERS, type Guide } from "../content/guideContent";
import GuideArticle from "./GuideArticle";
import GuidePlayer from "./GuidePlayer";
import GuideSummary from "./GuideSummary";
import InjectionStepper from "./InjectionStepper";
import InjectionStepsIntro from "./InjectionStepsIntro";
import surfaceStyles from "@/components/ui/styles/CardSurface.module.css";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import pageStyles from "../ResourcesPage.module.css";
import styles from "./GuideView.module.css";

type VideoGuide = Guide & { video: NonNullable<Guide["video"]> };

export default function GuideView({ slug }: { slug: string }) {
  const [walkThrough, setWalkThrough] = useState(false);
  const guide = GUIDES.find(
    (candidate) =>
      candidate.slug === slug && (!candidate.pen || !!candidate.video),
  );
  const inWalkThrough = !!guide && walkThrough;
  // the walk-through owns the screen: the shell's focus bar carries its name and the Close
  useShellFocus(
    inWalkThrough
      ? { title: "First injection", onClose: () => setWalkThrough(false) }
      : null,
  );

  if (guide && walkThrough) {
    return (
      <main
        className={`${layoutStyles.page} ${styles.readPage}`}
        data-focus="true"
      >
        <section className={`${surfaceStyles.card} ${styles.focusCard}`}>
          <InjectionStepper />
        </section>
      </main>
    );
  }

  const presenter = guide?.video && PRESENTERS[guide.video.by];
  const hasSummary = !!guide && guide.short.length > 0;

  return (
    <main className={`${layoutStyles.page} ${styles.guidePage}`}>
      <PageHead
        back={{ href: "/patient-dashboard/resources", label: "Resources" }}
        title={guide ? guide.title : "This guide is not here"}
        sub={
          !guide ? (
            "It may not apply to your programme yet."
          ) : presenter ? undefined : (
            <>
              {guide.line} <span className="num">{guide.minutes}</span> min.
            </>
          )
        }
      />
      {guide && (
        <div className={styles.guide}>
          <div className={pageStyles.guideTop}>
            {guide.video ? (
              <GuidePlayer guide={guide as VideoGuide} />
            ) : (
              hasSummary && (
                <div className={styles.guideBrief}>
                  <GuideSummary guide={guide} />
                </div>
              )
            )}
            {presenter && (
              <div className={styles.byline}>
                <Avatar name={presenter.name} size={40} />
                <span>
                  <strong>{presenter.name}</strong>
                  <span>{presenter.role}</span>
                </span>
              </div>
            )}
          </div>
          <div className={styles.guideText}>
            <section
              id="guide-text"
              className={`${surfaceStyles.card} ${styles.textCard} ${styles.anchor}`}
              aria-label="The steps in writing"
            >
              {guide.slug === "first-injection" ? (
                <InjectionStepsIntro
                  onStart={() => {
                    setWalkThrough(true);
                    window.scrollTo({ top: 0 });
                  }}
                />
              ) : (
                <GuideArticle
                  guide={guide}
                  summary={!!guide.video || !hasSummary}
                />
              )}
            </section>
            <p
              className={`${formStyles.hint} ${styles.readFoot} ${styles.guideFoot}`}
            >
              General guidance from inrange&apos;s care team. Your doctor&apos;s
              advice comes first.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
