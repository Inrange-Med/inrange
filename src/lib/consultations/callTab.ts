/**
 * The doctor's video call opens in its own browser tab (17 Nov 2026 call: the consultation page stays
 * open in the first tab, so the doctor writes the prescription while talking). Each consultation's call
 * tab has a fixed name: pressing Join again finds that tab and brings it forward instead of loading the
 * room a second time. Must run inside the click, or the browser blocks the new tab.
 */

const tabName = (appointmentId: string) => `inrange-call-${appointmentId}`;

export function openCallTab(appointmentId: string) {
  const path = `/consultation/${appointmentId}/`;
  // "" finds the named tab without navigating it; a new one comes back blank
  const tab = window.open("", tabName(appointmentId));
  if (!tab) {
    // a blocked pop-up: the call takes this tab (its end screen links back to the prescription); a full
    // load, as the room needs camera permission on a fresh page
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(path);
    return;
  }
  let blank = true;
  try {
    blank = tab.location.href === "about:blank";
  } catch {
    // another origin: treat it as ours to replace
  }
  if (blank) tab.location.href = path;
  tab.focus();
}
