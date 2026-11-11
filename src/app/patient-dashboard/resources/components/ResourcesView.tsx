"use client";

/*
  Resources (Arhaan Resources.tsx): the video for this point in care, the rest of the videos, then
  short reads. What shows depends on whether the patient's programme is running (from their
  profile). Before it: how inrange works, how the medicine works, blood tests and when to call us.
  Once it runs: every guide that does not need a prescribed pen, since the backend does not say yet
  which pen, if any, is prescribed.
*/

import { useState } from "react";
import Link from "next/link";
import { CaretDown, CaretRight, Play } from "@phosphor-icons/react";
import ContourField from "@/components/ui/ContourField";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { getMyProfile } from "@/services/patientProfileService";
import { GUIDES, PRESENTERS, type Guide } from "../content/guideContent";
import VideoThumb from "./VideoThumb";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import styles from "../ResourcesPage.module.css";

type VideoGuide = Guide & { video: NonNullable<Guide["video"]> };

const VIDEOS = GUIDES.filter((guide): guide is VideoGuide => !!guide.video);
const EARLY = [
  "how-inrange-works",
  "how-your-medicine-works",
  "blood-tests",
  "when-to-call",
];
const FIRST = 3;

const showsFor = (guide: Guide, active: boolean) =>
  active ? !guide.pen : EARLY.includes(guide.slug);
const pinnedFor = (active: boolean) =>
  active
    ? { slug: "eating-with-less-appetite", why: "For your programme" }
    : { slug: "how-inrange-works", why: "Before your first consultation" };
const metaOf = (guide: VideoGuide) =>
  `${guide.video.length}, ${PRESENTERS[guide.video.by].name}`;

/** A small deterministic number from a slug, so the pinned plate draws its own field. */
const seedOf = (slug: string) =>
  [...slug].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 9973, 7);

export default function ResourcesView() {
  const profile = useApiResource("patient-profile", getMyProfile);
  // a phone shows three videos and opens the rest in place; a laptop has room for all of them
  const [all, setAll] = useState(false);

  if (profile.loading && !profile.data) {
    return (
      <main className={layoutStyles.page}>
        <LoadingSkeleton />
      </main>
    );
  }

  // the guides are static: if the profile cannot load, the early set still helps
  const active = profile.data?.planStatus.trim().toLowerCase() === "active";
  const pin = pinnedFor(active);
  const top = VIDEOS.find((guide) => guide.slug === pin.slug) ?? VIDEOS[0];
  // once a plan is running, how inrange works has done its job
  const rest = VIDEOS.filter(
    (guide) =>
      guide !== top &&
      showsFor(guide, active) &&
      !(active && guide.slug === "how-inrange-works"),
  );
  const reads = GUIDES.filter(
    (guide) => !guide.video && showsFor(guide, active),
  );
  const hidden = rest.length - FIRST;

  return (
    <main className={`${layoutStyles.page} ${styles.page}`}>
      <PageHead
        title="Resources"
        sub={
          <span className={styles.lede}>
            Short videos, each with the steps in writing.
          </span>
        }
      />

      <div className={styles.layout}>
        <section className={styles.forYou} aria-labelledby="resources-pinned">
          <h2 id="resources-pinned" className={styles.h2}>
            For you now
          </h2>
          <Link
            href={`/patient-dashboard/resources/${top.slug}`}
            className={styles.pinned}
          >
            <ContourField
              className={styles.field}
              density={9}
              lineAlpha={0.12}
              signalAlpha={0.4}
              seed={seedOf(top.slug) % 9}
              interactive={false}
            />
            <span className={styles.pinWhy}>{pin.why}</span>
            <span className={styles.pinTitle}>{top.title}</span>
            <span className={styles.pinSummary}>{top.video.summary}</span>
            <span className={styles.pinFoot}>
              <span className={styles.pinPlay} aria-hidden="true">
                <Play size={18} weight="fill" />
              </span>
              <span>
                <strong>Watch</strong>
                <span className="num">{metaOf(top)}</span>
              </span>
            </span>
          </Link>
        </section>

        <section className={styles.videos} aria-labelledby="resources-videos">
          <h2 id="resources-videos" className={styles.h2}>
            Videos
          </h2>
          <ul
            id="resources-video-list"
            className={styles.list}
            data-all={all || hidden <= 0}
          >
            {rest.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={`/patient-dashboard/resources/${guide.slug}`}
                  className={styles.row}
                >
                  <VideoThumb slug={guide.slug} />
                  <span className={styles.rowText}>
                    <strong>{guide.title}</strong>
                    <span className={`${styles.rowMeta} num`}>
                      {metaOf(guide)}
                    </span>
                    <span className={styles.rowSummary}>
                      {guide.video.summary}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <button
              type="button"
              className={styles.more}
              aria-expanded={all}
              aria-controls="resources-video-list"
              onClick={() => setAll(!all)}
            >
              <span>
                {all ? (
                  "Fewer videos"
                ) : (
                  <>
                    All videos <span className="num">({rest.length})</span>
                  </>
                )}
              </span>
              <CaretDown size={16} aria-hidden="true" />
            </button>
          )}
        </section>

        {reads.length > 0 && (
          <section className={styles.reads} aria-labelledby="resources-reads">
            <h2 id="resources-reads" className={styles.h2}>
              Short reads
            </h2>
            <ul className={styles.readList}>
              {reads.map((guide) => (
                <li key={guide.slug}>
                  <Link
                    href={`/patient-dashboard/resources/${guide.slug}`}
                    className={styles.read}
                  >
                    <strong>{guide.title}</strong>
                    <span className={`${styles.readMin} num`}>
                      {guide.minutes} min
                    </span>
                    <CaretRight
                      size={16}
                      className={styles.readGo}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
