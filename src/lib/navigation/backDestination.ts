/**
 * Where a page's Back link goes: the patient-dashboard page the person came from, else the page's
 * parent. Every in-app link click records { from, to } in sessionStorage; PageHead reads it once
 * and trusts it only when `to` is the page it is on (so a stale record from an earlier tap, a
 * typed URL or the browser's own Back never decides). The doctor dashboard passes ?from= instead.
 */

export type BackDestination = { href: string; label: string };

type LinkTap = { from: string; to: string };

const KNOWN_PAGES: BackDestination[] = [
  { href: "/patient-dashboard", label: "Home" },
  { href: "/patient-dashboard/care", label: "Care" },
  { href: "/patient-dashboard/appointments", label: "Appointments" },
  { href: "/patient-dashboard/messages", label: "Messages" },
  { href: "/patient-dashboard/lab-tests", label: "Blood tests" },
  { href: "/patient-dashboard/reports", label: "Reports" },
  { href: "/patient-dashboard/resources", label: "Resources" },
  { href: "/patient-dashboard/profile", label: "Profile" },
];
const STORAGE_KEY = "inrange-from";

function withoutTrailingSlash(path: string): string {
  return path.replace(/\/$/, "") || "/";
}

if (typeof window !== "undefined") {
  document.addEventListener(
    "click",
    (event) => {
      const link = (event.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!link) return;
      const target = new URL(link.href, window.location.href);
      if (
        target.origin !== window.location.origin ||
        target.pathname === window.location.pathname
      )
        return;
      const tap: LinkTap = {
        from: withoutTrailingSlash(window.location.pathname),
        to: withoutTrailingSlash(target.pathname),
      };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tap));
      } catch {
        // storage blocked: Back keeps the page's own parent
      }
    },
    true,
  );
}

/** The known page whose link opened this page, if the last recorded tap led here. */
export function readBackDestination(): BackDestination | null {
  if (typeof window === "undefined") return null;
  let tap: LinkTap | null = null;
  try {
    tap = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
  const here = withoutTrailingSlash(window.location.pathname);
  if (!tap || tap.to !== here) return null;
  return (
    KNOWN_PAGES.find((page) => page.href === tap.from && page.href !== here) ??
    null
  );
}
