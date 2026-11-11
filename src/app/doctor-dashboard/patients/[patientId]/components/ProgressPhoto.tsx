"use client";

/* One progress photo in the record, front or side: blurred until the doctor chooses to look, with its date and the weight logged that week. The image is fetched through the signed-in API and shown from memory, so no link to it exists. */

import { useEffect, useState } from "react";
import { shortDate } from "@/lib/format/dateTime";
import { getFile } from "@/services/fileService";
import type { ProgressPhotoSet } from "@/types/patientRecord";
import styles from "./ProgressPhoto.module.css";

export default function ProgressPhoto({
  set,
  pose,
  label,
  hidden,
}: {
  set: ProgressPhotoSet;
  pose: "front" | "side";
  label: string;
  hidden: boolean;
}) {
  const path = pose === "front" ? set.front : set.side;
  const [loaded, setLoaded] = useState<{ path: string; src: string } | null>(
    null,
  );
  const src = loaded && loaded.path === path ? loaded.src : null;

  useEffect(() => {
    if (!path) return;
    let live = true;
    let url: string | null = null;
    getFile(path)
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setLoaded({ path, src: url });
      })
      .catch(() => {
        // the figure keeps its empty frame; the rest of the record still works
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  const alt = `${pose === "front" ? "Front" : "Side"} view, ${shortDate(set.takenAt)}`;
  return (
    <figure className={styles.figure}>
      {path ? (
        <span className={styles.pic} data-hidden={hidden || undefined}>
          {src && (
            // eslint-disable-next-line @next/next/no-img-element -- an in-memory image fetched through the API
            <img src={src} alt={hidden ? "" : alt} draggable={false} />
          )}
        </span>
      ) : (
        <span className={`${styles.pic} ${styles.none}`}>No {pose} view</span>
      )}
      <figcaption className={styles.cap}>
        <strong>{label}</strong>
        <span>
          <span className="num">{shortDate(set.takenAt)}</span>
          {set.weightKg !== null && (
            <>
              , <span className="num">{set.weightKg.toFixed(1)} kg</span>
            </>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
