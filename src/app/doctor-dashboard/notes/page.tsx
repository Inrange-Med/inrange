/* /doctor-dashboard/notes: the call notes to sign and the signed ones. The page sets the title; NotesView loads them. */

import type { Metadata } from "next";
import NotesView from "./components/NotesView";

export const metadata: Metadata = { title: "Notes | inrange" };

export default function NotesPage() {
  return <NotesView />;
}
