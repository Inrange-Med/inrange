"use client";

/*
  The prescription PDF right on the page, exactly what the patient gets (PRD: "the PDF above is the
  check"). It is fetched through the signed-in API and shown from this browser's memory, so no link
  leaves the app. A phone shows Open (phone browsers do not draw a PDF inside a page).
*/

import { useEffect, useState } from "react";
import FileOpenButton from "@/components/ui/FileOpenButton";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { getFile } from "@/services/fileService";
import styles from "./PatientPage.module.css";

export default function PdfPanel({
  path,
  version,
  heading,
}: {
  path: string;
  /** changes when a new PDF is made, so the page shows the new one */
  version: string;
  heading: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let made: string | null = null;
    let gone = false;
    getFile(path)
      .then((blob) => {
        if (gone) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
        setFailed(false);
      })
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [path, version]);

  return (
    <section className={styles.pdf} aria-labelledby="pdf-heading" id="pdf">
      <div className={styles.pdfHead}>
        <h2 id="pdf-heading" className={styles.h2}>
          {heading}
        </h2>
        <FileOpenButton load={() => getFile(path)} className={styles.textBtn}>
          {(opening) => (opening ? "Opening" : "Open in a new tab")}
        </FileOpenButton>
      </div>
      {failed ? (
        <p className={styles.searchNote}>
          The PDF did not load here. Open it in a new tab instead.
        </p>
      ) : url ? (
        <iframe
          className={styles.pdfFrame}
          src={`${url}#view=FitH`}
          title={heading}
        />
      ) : (
        <LoadingSkeleton />
      )}
    </section>
  );
}
