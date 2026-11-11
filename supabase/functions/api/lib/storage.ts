// Supabase Storage over its REST API with the service role (private buckets only). Files reach the
// browser only through routes/files.ts, which checks who is asking; no storage link leaves the server. Plain fetch on purpose:
// supabase-js made the function's cold start heavy enough that workers were retired after one request.
import { env } from "./env.ts";

const headers = () => ({ Authorization: `Bearer ${env.serviceRoleKey}`, apikey: env.serviceRoleKey });
const objectPath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export async function uploadFile(bucket: string, path: string, file: Blob, contentType: string) {
  const res = await fetch(`${env.supabaseUrl}/storage/v1/object/${bucket}/${objectPath(path)}`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": contentType, "x-upsert": "false" },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  return path;
}

export async function signedUrl(bucket: string, path: string | null | undefined, seconds = 600) {
  if (!path) return null;
  const res = await fetch(`${env.supabaseUrl}/storage/v1/object/sign/${bucket}/${objectPath(path)}`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: seconds }),
  });
  if (!res.ok) return null;
  const { signedURL } = await res.json();
  return signedURL ? `${env.supabaseUrl}/storage/v1${signedURL}` : null;
}

/** The stored file itself, for routes/files.ts to stream to someone it has checked. */
export async function downloadFile(bucket: string, path: string): Promise<Response | null> {
  const res = await fetch(`${env.supabaseUrl}/storage/v1/object/authenticated/${bucket}/${objectPath(path)}`, { headers: headers() });
  if (!res.ok || !res.body) {
    console.error("storage download", bucket, path, res.status);
    await res.body?.cancel();
    return null;
  }
  return res;
}
