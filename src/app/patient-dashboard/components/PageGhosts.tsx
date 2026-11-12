/**
 * The waiting state of a page that already shows its own title under the bar: soft placeholders
 * shaped like the cards that will land (Arhaan Dashboard.module.css .ghost), with no title ghost and
 * no stand-in for the bar, so nothing reads as a second title and nothing moves when the data
 * arrives. `title` adds the 48% title ghost for a page whose heading is part of its data (Home's
 * greeting). `className` lays the ghosts out like the page (Care's grid, for example).
 */

import styles from "./PageGhosts.module.css";

export default function PageGhosts({
  heights,
  title = false,
  className,
}: {
  /** one ghost per card, in px */
  heights: number[];
  title?: boolean;
  className?: string;
}) {
  return (
    <div
      className={className ?? styles.stack}
      aria-busy="true"
      aria-label="Loading"
    >
      {title && (
        <span className={styles.ghost} style={{ width: "48%", height: 44 }} />
      )}
      {heights.map((height, i) => (
        <span key={i} className={styles.ghost} style={{ height }} />
      ))}
    </div>
  );
}
