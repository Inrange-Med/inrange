"use client";

/**
 * A sheet from the bottom on a phone, a centred panel on a laptop. On a phone it follows the finger
 * from the handle and closes on a flick or a long pull, whichever comes first. Escape and the scrim
 * close it too, and focus returns to whatever opened it. It renders at the top of the themed area
 * (a portal), so a card that animates in, and so has its own stacking layer, can never paint over it.
 */

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import formStyles from "./styles/FormControls.module.css";
import styles from "./Sheet.module.css";

type Drag = { startY: number; time: number; offset: number; velocity: number };

const FOCUSABLE =
  "button:not([disabled]), a[href], input:not([disabled]), select, summary, [tabindex='0']";

export default function Sheet({
  open,
  onClose,
  title,
  children,
  size = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** "compact" is a narrower panel from 768px, for a short confirmation */
  size?: "default" | "compact";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const drag = useRef<Drag | null>(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  // mount, then show on the next frame so the entry transition plays; hide, then unmount after it
  if (open && !mounted) setMounted(true);
  if (!open && shown) setShown(false);

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement;
      const frame = requestAnimationFrame(() =>
        requestAnimationFrame(() => setShown(true)),
      );
      return () => cancelAnimationFrame(frame);
    }
    const unmountTimer = setTimeout(() => setMounted(false), 380);
    (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    return () => clearTimeout(unmountTimer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    // confirmations wait while a sheet is open, so they never cover what is in it
    html.dataset.sheet = "open";
    // Escape closes; Tab stays inside the panel
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel.current) return;
      const nodes = Array.from(
        panel.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = previousOverflow;
      delete html.dataset.sheet;
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted, onClose]);

  useEffect(() => {
    if (shown) panel.current?.focus({ preventScroll: true });
  }, [shown]);

  const host =
    typeof document === "undefined"
      ? null
      : (document.querySelector(".app-theme") ?? document.body);
  if (!mounted || !host) return null;

  const onDown = (event: PointerEvent) => {
    if (
      window.matchMedia("(min-width: 768px)").matches ||
      (event.target as HTMLElement).closest("button")
    )
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startY: event.clientY,
      time: performance.now(),
      offset: 0,
      velocity: 0,
    };
    panel.current!.style.transition = "none";
  };
  const onMove = (event: PointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const now = performance.now();
    const pulled = event.clientY - current.startY;
    // pulled upwards it resists, the further the harder; downwards it follows the finger exactly
    const offset =
      pulled < 0 ? -((-pulled * 0.55 * 80) / (80 + 0.55 * -pulled)) : pulled;
    current.velocity =
      (offset - current.offset) / Math.max(1, now - current.time);
    current.offset = offset;
    current.time = now;
    panel.current!.style.transform = `translate3d(0, ${offset}px, 0)`;
  };
  const onUp = () => {
    const released = drag.current;
    drag.current = null;
    if (!released || !panel.current) return;
    panel.current.style.transition = "";
    panel.current.style.transform = "";
    // a quick flick closes it even when short; a slow pull closes it past a third of its height
    if (
      released.velocity > 0.5 ||
      released.offset > panel.current.offsetHeight / 3
    )
      onClose();
  };

  return createPortal(
    <div className={styles.root} data-shown={shown}>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        className={styles.panel}
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div
          className={styles.grab}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <span className={styles.handle} aria-hidden="true" />
          <div className={styles.head}>
            <h2 className={styles.title}>{title}</h2>
            <button
              type="button"
              className={formStyles.round}
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    host,
  );
}
