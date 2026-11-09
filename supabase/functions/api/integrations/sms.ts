// Sign-in codes by SMS through MSG91 (DLT template with an ##OTP## variable). Live when
// MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are set; otherwise mock: every number accepts PILOT_OTP.
import { env, live } from "../lib/env.ts";

export const smsLive = live.sms;

export async function sendOtpSms(mobile: string, code: string): Promise<void> {
  if (!smsLive()) return;
  const res = await fetch("https://control.msg91.com/api/v5/otp?" + new URLSearchParams({
    template_id: env.msg91TemplateId, mobile: `91${mobile}`, otp: code,
  }), { method: "POST", headers: { authkey: env.msg91AuthKey, "Content-Type": "application/json" }, body: "{}" });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.type === "error") throw new Error(`MSG91: ${out.message ?? res.status}`);
}
