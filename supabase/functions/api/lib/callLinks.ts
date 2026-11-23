// A consultation's video links for people other than the two signing in to join (routes/care.ts does that):
// admin, who shares them by any means, and the salesperson, who joins the call after the doctor (23 Nov 2026 call).
import { sql } from "./db.ts";
import { type CallRole, createRoom, hmsLive, joinLink, mockJoinLink } from "../integrations/hms.ts";

/** The link for one person; the room is made the first time anyone asks (two asking at once land in one room). */
export async function callLink(a: { id: number; video_room_id: string | null }, role: CallRole, name: string, userId: number) {
  if (!hmsLive()) return mockJoinLink(a.id, role, name);
  const roomId = a.video_room_id ?? (await sql`
    update appointments set video_room_id = coalesce(video_room_id, ${await createRoom(a.id)})
    where id = ${a.id} returning video_room_id`)[0].video_room_id;
  a.video_room_id = roomId;
  return await joinLink(roomId, role, name, userId);
}
