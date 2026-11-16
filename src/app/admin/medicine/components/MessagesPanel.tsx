"use client";

/*
  Every WhatsApp message, newest first: what it was, to whom, and whether it went (and why not: WhatsApp
  off, already paid, a failure from WhatsApp). In test mode an admin can play the patient's reply here.
*/

import { useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { timeAgo } from "@/lib/format/dateTime";
import { errorMessage } from "@/lib/http/apiClient";
import { listMessages, playReply } from "@/services/medicineOpsService";
import type { OpsMessage } from "@/types/medicineOps";
import { MESSAGE_WORDS, REPLIES_FOR, STATUS_WORDS } from "./words";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";

const notSent = (m: OpsMessage) =>
  m.status === "FAILED" || m.status === "SKIPPED";

export default function MessagesPanel({
  now,
  mock,
  onOpenPatient,
}: {
  now: number;
  mock: boolean;
  onOpenPatient: (id: string) => void;
}) {
  const messages = useApiResource("medicine-messages", listMessages);
  const toast = useToast();
  const [show, setShow] = useState<"all" | "unsent">("all");
  const [busy, setBusy] = useState<string | null>(null);

  if (messages.error && !messages.data)
    return <ErrorNotice message={messages.error} onRetry={messages.reload} />;
  if (!messages.data) return <LoadingSkeleton />;
  const unsent = messages.data.filter(notSent);
  const rows = show === "unsent" ? unsent : messages.data;

  return (
    <section className={adminStyles.panel} aria-labelledby="messages-h">
      <div className={`${adminStyles.panelHead} ${s.headWrap}`}>
        <h2 id="messages-h" className={adminStyles.h2}>
          WhatsApp
        </h2>
        {unsent.length > 0 && (
          <span className={s.seg}>
            <SegmentedControl
              label="Which messages"
              value={show}
              options={[
                { value: "all", label: "All" },
                {
                  value: "unsent",
                  label: (
                    <>
                      Not sent <span className="num">{unsent.length}</span>
                    </>
                  ),
                },
              ]}
              onChange={setShow}
            />
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className={adminStyles.empty}>
          No messages yet. The first goes out when a doctor signs a
          prescription.
        </p>
      ) : (
        <ul className={s.rows}>
          {rows.map((m) => {
            const replies = m.choices?.length
              ? m.choices
              : (REPLIES_FOR[m.kind] ?? []);
            return (
              <li key={m.id}>
                <div className={s.row}>
                  <button
                    type="button"
                    className={s.open}
                    onClick={() => m.patientId && onOpenPatient(m.patientId)}
                  >
                    <span className={s.what}>
                      {m.kind === "REPLY"
                        ? `Reply: ${m.text ?? ""}`
                        : (MESSAGE_WORDS[m.kind] ?? m.kind)}
                    </span>
                    <span className={s.sub}>
                      <span>{m.patientName}</span>
                      {notSent(m) && (
                        <span>
                          {m.status === "SKIPPED"
                            ? m.skipReason
                            : (m.error ?? "WhatsApp refused it")}
                        </span>
                      )}
                    </span>
                  </button>
                  <span className={s.side}>
                    <span className={adminStyles.muted}>
                      {STATUS_WORDS[m.status]}
                    </span>
                    <span className={`${adminStyles.muted} num`}>
                      {timeAgo(m.sentAt ?? m.createdAt, now)}
                    </span>
                  </span>
                </div>
                {mock &&
                  replies.length > 0 &&
                  (m.status === "SENT" ||
                    m.status === "DELIVERED" ||
                    m.status === "READ") && (
                    <span
                      className={s.chips}
                      aria-label="Play the patient's reply (test mode)"
                    >
                      {replies.map((r) => (
                        <button
                          key={r.code}
                          type="button"
                          className={s.chip}
                          disabled={busy === m.id}
                          onClick={async () => {
                            setBusy(m.id);
                            try {
                              toast(await playReply(m.id, { code: r.code }));
                              messages.reload();
                            } catch (caught) {
                              toast(
                                errorMessage(
                                  caught,
                                  "That reply could not be played.",
                                ),
                              );
                            } finally {
                              setBusy(null);
                            }
                          }}
                        >
                          {r.label}
                        </button>
                      ))}
                    </span>
                  )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
