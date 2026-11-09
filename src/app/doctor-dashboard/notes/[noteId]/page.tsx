/*
  /doctor-dashboard/notes/[noteId]?from=today|patient: one call note to check, edit and sign.
  This server page sets the title and reads the id from the URL; NoteReviewView loads the note.
*/

import type { Metadata } from "next";
import NoteReviewView from "./components/NoteReviewView";

export const metadata: Metadata = { title: "Call note | InRange" };

export default async function NoteReviewPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  return <NoteReviewView key={noteId} noteId={noteId} />;
}
