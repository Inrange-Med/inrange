/**
 * The doctor's video call opens in its own browser tab (17 Nov 2026 call: the consultation page stays
 * open in the first tab, so the doctor writes the prescription while talking). Each consultation's call
 * tab has a fixed name: pressing Join again finds that tab and brings it forward instead of loading the
 * room a second time (a tab that left the call loads the room again, so Join always rejoins). Must run inside the click, or the browser blocks the new tab.
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
  // only a tab that is in the room right now is brought forward as it is: a blank new tab, or one that left the
  // call (its end screen, "Finish the prescription in your other tab"), loads the room again, so Join rejoins
  let inRoom = false;
  try {
    inRoom =
      tab.location.pathname === path &&
      Boolean(tab.document.querySelector('main[data-live="true"]'));
  } catch {
    // another origin: ours to replace
  }
  if (!inRoom) tab.location.href = path;
  tab.focus();
}
