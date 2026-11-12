"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Check, X } from "@phosphor-icons/react";
import { CONTACT_EMAIL, WAITLIST_URL, type ProgrammeKey } from "./programme-data";
import s from "./Waitlist.module.css";

type State = "idle" | "sending" | "done" | "drafted" | "error";

/*
  A waitlist for a programme that is not open yet. Joining one says something about a person's health,
  so it asks for the least it can (name, mobile, city), never a symptom, and the consent box starts unticked
  (SPDI Rules 2011 r.5, DPDP Act 2023). The details are used once, to say the programme has opened.
  With no endpoint yet (NEXT_PUBLIC_WAITLIST_URL), the form drafts an email to the team instead of
  pretending to have saved anything.
*/
export default function WaitlistButton({
  programme,
  name,
  covers,
  className,
}: {
  programme: ProgrammeKey;
  name: string;
  covers?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>("idle");
  const id = useId();
  const doneRef = useRef<HTMLButtonElement>(null);

  const open = () => {
    setState("idle");
    ref.current?.showModal();
  };
  const close = () => ref.current?.close();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const entry = {
      programme,
      name: String(f.get("name") ?? "").trim(),
      mobile: String(f.get("mobile") ?? "").replace(/\D/g, ""),
      city: String(f.get("city") ?? "").trim(),
      consent: f.get("consent") === "on",
      consented_at: new Date().toISOString(),
    };
    if (!WAITLIST_URL) {
      const body = `Please add me to the ${name} waitlist.\n\nName: ${entry.name}\nMobile: +91 ${entry.mobile}\nCity: ${entry.city}\n\nI agree inrange may use these details only to tell me when ${name} opens. I am 18 or older.`;
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`${name} waitlist`)}&body=${encodeURIComponent(body)}`;
      setState("drafted");
      return;
    }
    setState("sending");
    try {
      const r = await fetch(WAITLIST_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  const finished = state === "done" || state === "drafted";
  // the form unmounts on success; keep keyboard focus inside the sheet, on its one action
  useEffect(() => {
    if (finished) doneRef.current?.focus();
  }, [finished]);

  return (
    <>
      <button type="button" className={className} onClick={open} aria-haspopup="dialog">
        <span>Join the waitlist</span>
        {/* "well" lets the button take the site's .btn styles when it is given them */}
        <span className={`${s.well} well`} aria-hidden="true">
          <ArrowRight size={16} weight="regular" />
        </span>
      </button>

      <dialog
        ref={ref}
        className={s.dialog}
        data-lenis-prevent
        aria-labelledby={`${id}-t`}
        onClick={(e) => {
          // a tap on the dimmed backdrop closes it, like any sheet
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className={s.panel}>
          <button type="button" className={s.close} onClick={close} aria-label="Close" autoFocus>
            <X size={18} weight="regular" />
          </button>

          {finished ? (
            <div className={s.done} role="status">
              <span className={s.tick} aria-hidden="true">
                <Check size={22} weight="regular" />
              </span>
              <h2 id={`${id}-t`} className={s.title}>
                {state === "done" ? "You are on the list." : "Your email is ready to send."}
              </h2>
              <p className={s.text}>
                {state === "done"
                  ? `We will message you once, when ${name} opens. Nothing else.`
                  : `Your email app has opened with your details. Send it, and we will tell you once, when ${name} opens.`}
              </p>
              <button type="button" ref={doneRef} className={`btn ${s.doneBtn}`} onClick={close}>
                Done
              </button>
            </div>
          ) : (
            <form className={s.form} onSubmit={submit}>
              <p className="tag">
                <svg width="9" height="11" viewBox="0 0 9 11" shapeRendering="crispEdges" aria-hidden="true">
                  <path d="M1.5 1v9M4.5 1v4.5M7.5 1v6.5" stroke="currentColor" strokeWidth="1" fill="none" />
                </svg>
                Coming soon
              </p>
              <h2 id={`${id}-t`} className={s.title}>
                {name}
              </h2>
              {covers && (
                <p className={s.covers}>
                  <span>What a doctor looks at</span>
                  {covers}
                </p>
              )}
              <p className={s.text}>Leave your details and we will tell you when it opens. We ask only what we need to reach you.</p>

              <label className={s.field}>
                <span>Your name</span>
                <input name="name" autoComplete="name" required maxLength={80} />
              </label>
              <label className={s.field}>
                <span>Mobile number</span>
                <span className={s.phone}>
                  <span aria-hidden="true">+91</span>
                  <input
                    name="mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    required
                    pattern="[6-9][0-9]{9}"
                    maxLength={16}
                    // people type spaces and dashes; keep only the 10 digits
                    onInput={(e) => {
                      const el = e.currentTarget;
                      const digits = el.value.replace(/\D/g, "").replace(/^(91|0)(?=\d{10})/, "").slice(0, 10);
                      if (digits !== el.value) el.value = digits;
                    }}
                    aria-describedby={`${id}-m`}
                  />
                </span>
                <small id={`${id}-m`}>10 digits, starting with 6, 7, 8 or 9</small>
              </label>
              <label className={s.field}>
                <span>City</span>
                <input name="city" autoComplete="address-level2" required maxLength={60} />
              </label>

              <label className={s.consent}>
                <input type="checkbox" name="consent" required />
                <span>
                  I agree that Novaxis Lifesciences Pvt Ltd (inrange) may use these details only to tell me when {name} opens.
                  I&nbsp;am 18&nbsp;or&nbsp;older. Read the <a href="/privacy">privacy policy</a>.
                </span>
              </label>

              {state === "error" && (
                <p className={s.error} role="alert">
                  That did not go through. Try again, or write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                </p>
              )}

              <button type="submit" className={`btn ${s.submit}`} disabled={state === "sending"}>
                <span>{state === "sending" ? "Adding you" : "Join the waitlist"}</span>
                <span className="well" aria-hidden="true">
                  <ArrowRight size={18} weight="regular" />
                </span>
              </button>
              <p className={s.fine}>Not for emergencies. If you need help now, call 112.</p>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
