"use client";

/*
  The sales dashboard (23 and 24 Nov 2026 calls). For a salesperson: the leads assigned to them and nobody
  else's. For an admin (`admin`): every lead, by salesperson, with the same page for each.
  The list opens on "To do": a follow-up that is due, a call today or tomorrow (with Join on the row), a sale to
  close, a sales form to fill in. Each row says where the lead stands in one line. A row opens the lead
  (LeadSheet): everything about them end to end, the call notes, the payment link, the sales form.
*/

import { useDeferredValue, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate, relativeDayName } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import { listSalespeople } from "@/services/medicineOpsService";
import { getSalesCallLink, listLeads } from "@/services/salesService";
import type { Lead } from "@/types/sales";
import LeadSheet from "./LeadSheet";
import {
  callWhen,
  CALL_WORDS,
  followUpDue,
  inView,
  STAGE_WORDS,
  VIEWS,
  type View,
} from "./leadWords";
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

/** The one thing to do next for this lead, as the pill on the right. */
function nextStep(lead: Lead): {
  words: string;
  tone: "new" | "ok" | "pending";
} {
  if (lead.formDue) return { words: "Fill in the sales form", tone: "new" };
  if (followUpDue(lead)) return { words: "Call again today", tone: "new" };
  if (lead.stage === "ON_PLAN") return { words: lead.planName!, tone: "ok" };
  if (lead.stage === "LINK_SENT")
    return {
      words: `Link sent, ${formatRupees(lead.linkRupees!)}`,
      tone: "pending",
    };
  if (lead.stage === "CONSULTED")
    return { words: "Send a payment link", tone: "new" };
  return { words: STAGE_WORDS[lead.stage], tone: "pending" };
}

export default function LeadsBoard({
  admin = false,
  onChanged,
}: {
  /** every lead, with who has each; the page and its actions are the same */
  admin?: boolean;
  /** something changed that other lists on the page show too */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const leadId = params.get("lead");
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  const [view, setView] = useState<View>(admin ? "all" : "todo");
  const [seller, setSeller] = useState("");
  const [version, setVersion] = useState(0);
  const leads = useApiResource(`leads-${q}-${seller}-${version}`, () =>
    listLeads(q, seller),
  );
  const team = useApiResource(admin ? "salespeople" : null, listSalespeople);

  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("lead", id);
    else next.delete("lead");
    router.replace(next.size ? `${pathname}?${next}` : pathname, {
      scroll: false,
    });
  };

  const join = async (callId: string) => {
    // opened before the wait, so the browser treats the new tab as the person's own click
    const tab = window.open("", "_blank");
    try {
      (tab ?? window).location.assign(await getSalesCallLink(callId));
    } catch (caught) {
      tab?.close();
      toast(errorMessage(caught, "The call could not be opened."));
    }
  };

  const all = leads.data ?? [];
  const shown = all.filter((lead) => inView(lead, view));

  return (
    <>
      <section className={surfaceStyles.panel} aria-labelledby="leads-h">
        <div className={surfaceStyles.panelHead}>
          <h2 id="leads-h" className={surfaceStyles.h2}>
            Leads
          </h2>
        </div>
        <div className={s.tabs}>
          <SegmentedControl
            label="Which leads"
            value={view}
            options={VIEWS.map((v) => ({
              value: v.value,
              label: (
                <>
                  {v.label}
                  {leads.data && (
                    <span className="num">
                      {" "}
                      {all.filter((lead) => inView(lead, v.value)).length}
                    </span>
                  )}
                </>
              ),
            }))}
            onChange={setView}
          />
        </div>
        <div className={s.formGrid} data-cols={admin ? "2" : undefined}>
          <input
            className={s.search}
            type="search"
            value={query}
            placeholder="Name or mobile"
            aria-label="Find a lead by name or mobile"
            onChange={(e) => setQuery(e.target.value)}
          />
          {admin && (
            <select
              className={s.input}
              value={seller}
              aria-label="Whose leads"
              onChange={(e) => setSeller(e.target.value)}
            >
              <option value="">Everyone&apos;s leads</option>
              <option value="none">Not assigned to anyone</option>
              {(team.data ?? [])
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.rank}. {p.fullName}
                  </option>
                ))}
            </select>
          )}
        </div>
        {leads.error && !leads.data ? (
          <ErrorNotice message={leads.error} onRetry={leads.reload} />
        ) : !leads.data ? (
          <LoadingSkeleton />
        ) : shown.length === 0 ? (
          <p className={surfaceStyles.empty}>
            {q
              ? "No lead matches that."
              : all.length === 0
                ? admin
                  ? "No leads here."
                  : "No leads yet. Admin assigns them to you, and they appear here."
                : view === "todo"
                  ? "Nothing to do right now. Everything is under All."
                  : "None in this list."}
          </p>
        ) : (
          <ul className={s.rows}>
            {shown.map((lead) => {
              const step = nextStep(lead);
              const callToday =
                lead.nextCallId &&
                lead.nextCallAt &&
                relativeDayName(lead.nextCallAt) === "Today";
              return (
                <li key={lead.id}>
                  <div className={s.row}>
                    <button
                      type="button"
                      className={s.open}
                      onClick={() => open(lead.id)}
                    >
                      <span className={s.what}>{lead.name}</span>
                      <span className={`${s.sub} num`}>
                        <span>{spacedMobile(lead.mobile)}</span>
                        <span>{STAGE_WORDS[lead.stage]}</span>
                        {lead.nextCallAt && (
                          <span>
                            Call {callWhen(lead.nextCallAt).toLowerCase()}
                            {lead.nextCallDoctor
                              ? `, ${lead.nextCallDoctor}`
                              : ""}
                          </span>
                        )}
                        {lead.followUpOn && (
                          <span>Call again {shortDate(lead.followUpOn)}</span>
                        )}
                        {lead.callStatus && (
                          <span>{CALL_WORDS[lead.callStatus]}</span>
                        )}
                        {admin && (
                          <span>{lead.salesperson ?? "Not assigned"}</span>
                        )}
                      </span>
                    </button>
                    <span className={s.side}>
                      {callToday && (
                        <button
                          type="button"
                          className={s.chip}
                          data-on="true"
                          onClick={() => join(lead.nextCallId!)}
                        >
                          Join the call
                        </button>
                      )}
                      <span
                        className={surfaceStyles.pill}
                        data-tone={step.tone}
                      >
                        {step.words}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <LeadSheet
        leadId={leadId}
        admin={admin}
        onJoin={join}
        onClose={() => open(null)}
        onChanged={() => {
          setVersion((v) => v + 1);
          onChanged?.();
        }}
      />
    </>
  );
}
