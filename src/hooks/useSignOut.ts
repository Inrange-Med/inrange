"use client";

/**
 * Signing out, the same for every dashboard: this device forgets the session at once (so every open
 * tab signs out too, through the storage event), the server ends it in the background (authService
 * logout, never awaited, so a slow or offline network cannot hold anyone signed in), then sign-in.
 * `leaving` is true until the page changes.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getAccessToken } from "@/lib/session/authSession";
import { logout } from "@/services/authService";

export function useSignOut() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const signOut = () => {
    setLeaving(true);
    const token = getAccessToken();
    clearSession();
    if (token) logout(token);
    router.replace("/sign-in?out=1");
  };

  return { signOut, leaving };
}
