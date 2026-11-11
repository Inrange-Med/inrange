"use client";

/**
 * Opens a stored file (report, prescription) in a new tab. The page passes `load`, which fetches the
 * file through the signed-in API; the tab shows it from this browser's memory, so there is no link
 * anyone could forward. The tab opens inside the tap, so the browser does not block it.
 */

import { useState, type ReactNode } from "react";
import { useToast } from "./ToastProvider";
import { errorMessage } from "@/lib/http/apiClient";

// ponytail: the in-memory copy is freed after 10 minutes; the open tab keeps showing it, only its own
// Download button needs it, so a longer read just means opening the file again
const KEEP_MS = 10 * 60 * 1000;

export default function FileOpenButton({
  load,
  className,
  disabled,
  children,
}: {
  load: () => Promise<Blob>;
  className?: string;
  disabled?: boolean;
  /** Content, or a function of whether the file is still opening (for a spinner). */
  children: ReactNode | ((opening: boolean) => ReactNode);
}) {
  const toast = useToast();
  const [opening, setOpening] = useState(false);

  const open = async () => {
    if (opening) return;
    const tab = window.open("", "_blank");
    if (tab) tab.document.title = "Opening";
    setOpening(true);
    try {
      const url = URL.createObjectURL(await load());
      setTimeout(() => URL.revokeObjectURL(url), KEEP_MS);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (caught) {
      tab?.close();
      toast(errorMessage(caught, "The file could not be opened."));
    } finally {
      setOpening(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={open}
      data-busy={opening}
      aria-busy={opening}
    >
      {typeof children === "function" ? children(opening) : children}
    </button>
  );
}
