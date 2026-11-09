/** The app-wide 404 route: sets the tab title and renders the screen (NotFoundView). */

import type { Metadata } from "next";
import NotFoundView from "./NotFoundView";

export const metadata: Metadata = {
  title: "Page not found | InRange",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundView />;
}
