"use client";

/*
  Focus mode for the patient shell (Arhaan account/Shell.tsx `focus`): a task that owns the screen
  (the first-injection walk-through, the checkout) swaps the bar for a round close button and the
  task's name, and the dock goes away. A page turns it on with useShellFocus while it is mounted.
  The close does what the page's own exit already did: `onClose` runs the page's handler,
  `closeHref` links where the page's back link goes; with neither, the slot stays empty.
*/

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";

export type ShellFocus = {
  title: string;
  onClose?: () => void;
  closeHref?: string;
  /** What the close does, read by screen readers ("Close" when not given). */
  closeLabel?: string;
};

export const ShellFocusContext = createContext<
  Dispatch<SetStateAction<ShellFocus | null>>
>(() => {});

/** Shows the focus bar while `focus` is set; pass null to show the normal bar. */
export function useShellFocus(focus: ShellFocus | null) {
  const setFocus = useContext(ShellFocusContext);
  // the latest handler, so a new function each render does not redraw the bar
  const onCloseRef = useRef(focus?.onClose);
  useLayoutEffect(() => {
    onCloseRef.current = focus?.onClose;
  });

  const active = focus !== null;
  const title = focus?.title ?? "";
  const closeHref = focus?.closeHref;
  const closeLabel = focus?.closeLabel;
  const closes = !!focus?.onClose;

  // a layout effect, so the bar swaps before the first paint of the task
  useLayoutEffect(() => {
    if (!active) return;
    setFocus({
      title,
      closeHref,
      closeLabel,
      onClose: closes ? () => onCloseRef.current?.() : undefined,
    });
    return () => setFocus(null);
  }, [setFocus, active, title, closeHref, closeLabel, closes]);
}
