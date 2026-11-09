"use client";

/*
  The foot of Profile (Arhaan Profile.tsx): sign out asks once, in place, then ends the session on
  the server and on this device (useSignOut) and goes to sign-in. The version sits under it.
*/

import { useState } from "react";
import { SignOut } from "@phosphor-icons/react";
import { useSignOut } from "@/hooks/useSignOut";
import styles from "../ProfilePage.module.css";

const VERSION = "0.9";

export default function SignOutFoot() {
  const { signOut, leaving } = useSignOut();
  const [asking, setAsking] = useState(false);

  return (
    <div className={styles.foot}>
      {asking ? (
        <div className={styles.outAsk} role="group" aria-label="Sign out">
          <p>Sign out of InRange on this device?</p>
          <div className={styles.outBtns}>
            <button
              type="button"
              className={styles.signOut}
              onClick={() => setAsking(false)}
              disabled={leaving}
            >
              Stay signed in
            </button>
            <button
              type="button"
              className={`${styles.signOut} ${styles.signOutGo}`}
              disabled={leaving}
              onClick={signOut}
            >
              <SignOut size={20} />
              {leaving ? "Signing out" : "Sign out"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.signOut}
          onClick={() => setAsking(true)}
        >
          <SignOut size={20} />
          Sign out
        </button>
      )}
      <p className={styles.version}>
        InRange for patients, version{" "}
        <span className="num">{VERSION}</span>
      </p>
    </div>
  );
}
