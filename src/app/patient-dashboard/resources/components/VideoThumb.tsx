/*
  A video's drawn thumbnail (Arhaan Resources.tsx Thumb): one line drawing for the topic, in the
  brand's instrument style, on the dark plate, with a play mark. Drawn in a 160 by 100 box; "hi"
  strokes take the signal colour. No temperature cues on the storage drawing.
*/

import { Play } from "@phosphor-icons/react";
import pageStyles from "../ResourcesPage.module.css";
import styles from "./VideoThumb.module.css";

const DRAWINGS: Record<string, { d: string; hi?: string }> = {
  // a phone on a video call: the frame, a head and shoulders, the brand dot
  "how-inrange-works": {
    d: "M62 18h36a6 6 0 0 1 6 6v52a6 6 0 0 1-6 6H62a6 6 0 0 1-6-6V24a6 6 0 0 1 6-6ZM80 38a8 8 0 1 0 0.01 0M66 66c3-9 9-13 14-13s11 4 14 13",
    hi: "M80 28a2 2 0 1 0 0.01 0",
  },
  // doses rising in steps, held flat between them
  "how-your-medicine-works": {
    d: "M30 80h100M30 80V20",
    hi: "M36 74h20v-10h20v-10h20v-10h20v-10h14",
  },
  // a pen lying flat: body, window, dose dial, needle
  "first-injection": {
    d: "M36 42h82a8 8 0 0 1 8 8 8 8 0 0 1-8 8H36a8 8 0 0 1-8-8 8 8 0 0 1 8-8ZM62 46h18v8H62ZM126 45h10v10h-10",
    hi: "M28 50H14M18 46v8",
  },
  // a cup of adrak tea, steam rising
  "first-weeks": {
    d: "M56 46h40v18a14 14 0 0 1-14 14h-12a14 14 0 0 1-14-14ZM96 52h6a7 7 0 0 1 0 14h-8M50 84h52",
    hi: "M68 38c-4-5 4-9 0-14M80 38c-4-5 4-9 0-14",
  },
  // a plate from above, its rim, and a spoon beside it
  "eating-with-less-appetite": {
    d: "M76 18a32 32 0 1 0 0.01 0M76 30a20 20 0 1 0 0.01 0",
    hi: "M126 22a5 8 0 1 0 0.01 0M126 38v40",
  },
  // a pen in its box, lid open
  "storing-your-pen": {
    d: "M40 44h80v34H40ZM40 44l10-14h80l-10 14M120 44l10-14v34l-10 14",
    hi: "M52 58h56a3 3 0 0 1 0 6H52a3 3 0 0 1 0-6Z",
  },
};

export default function VideoThumb({ slug }: { slug: string }) {
  const drawing = DRAWINGS[slug];
  return (
    <span className={pageStyles.thumb} aria-hidden="true">
      {drawing && (
        <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet">
          {/* held to the left two thirds, clear of the play mark */}
          <g transform="translate(2 14) scale(0.7)">
            <path d={drawing.d} />
            {drawing.hi && <path d={drawing.hi} data-hi="true" />}
          </g>
        </svg>
      )}
      <span className={styles.thumbPlay}>
        <Play size={12} weight="fill" />
      </span>
    </span>
  );
}
