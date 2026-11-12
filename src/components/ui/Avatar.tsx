/** Round portrait, or the person's initials on carbon when there is no photo. */

import Image from "next/image";
import styles from "./Avatar.module.css";

/** "Dr. Asha Rao" -> "AR": the title is dropped, then the first letters of two words. */
function initialsOf(name: string) {
  return name
    .replace(/^Dr\.?\s+/, "")
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("");
}

export default function Avatar({
  name,
  src,
  size = 56,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  if (src)
    return (
      <Image
        className={styles.photo}
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  // initials shrink with a small avatar so two letters never spill past the circle
  const fontSize = Math.max(
    10,
    Math.min(size * 0.4, Math.max(14, size * 0.34)),
  );
  return (
    <span
      className={styles.initials}
      style={{ width: size, height: size, fontSize }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
