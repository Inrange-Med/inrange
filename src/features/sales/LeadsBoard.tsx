"use client";

/*
  The sales dashboard (23 and 24 Nov 2026 calls). For a salesperson: the leads assigned to them and nobody
  else's. For an admin (`admin`): every lead, by salesperson, with the same page for each.
  The list is the team's sheet: one row a lead, one column a fact, the thing to do next on the right. It opens
  on "To do": a follow-up that is due, a call today or tomorrow (with Join on the row), a sale to close, a sales
  form to fill in. A row opens the lead's own page (LeadPage).
*/

import { useDeferredValue, useState } from "react";
import Link from "next/link";
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
import p from "./LeadPage.module.css";

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
  if (lead.stage === "CONSULTED") return { words: "Send the plan", tone: "new" };
  return { words: STAGE_WORDS[lead.stage], tone: "pending" };
}

export default function LeadsBoard({
  admin = false,
}: {
  /** every lead, with who has each; the page and its actions are the same */
  admin?: boolean;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  // the list chosen and whose leads stay in the address, so coming back from a lead finds them as they were
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const asked = params.get("view") as View | null;
  const view: View =
    asked && VIEWS.some((v) => v.value === asked)
      ? asked
      : admin
        ? "all"
        : "todo";
  const seller = admin ? (params.get("seller") ?? "") : "";
  const put = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(next.size ? `${pathname}?${next}` : pathname, {
      scroll: false,
    });
  };
  const setView = (value: View) => put("view", value);
  const setSeller = (value: string) => put("seller", value);
  const leads = useApiResource(`leads-${q}-${seller}`, () =>
    listLeads(q, seller),
  );
  const team = useApiResource(admin ? "salespeople" : null, listSalespeople);
  const base = admin ? "/admin/medicine/leads" : "/sales/leads";

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
    <section className={surfaceStyles.panel} aria-label="Leads">
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
              .filter((x) => x.active)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.fullName}
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
                : "No leads yet. Admin assigns them to you."
              : view === "todo"
                ? "Nothing to do right now. See All."
                : "None in this list."}
        </p>
      ) : (
        <div className={p.tableWrap}>
          <table className={p.table}>
            <thead>
              <tr>
                <th scope="col">Lead</th>
                <th scope="col">Status</th>
                <th scope="col">Doctor</th>
                <th scope="col">Consultation</th>
                <th scope="col">Last call</th>
                {admin && <th scope="col">Salesperson</th>}
                <th scope="col">Next</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((lead) => {
                const step = nextStep(lead);
                const callToday =
                  lead.nextCallId &&
                  lead.nextCallAt &&
                  relativeDayName(lead.nextCallAt) === "Today";
                return (
                  <tr
                    key={lead.id}
                    onClick={(e) => {
                      // the name is the link (keyboard, new tab); a click anywhere else on the row opens it too
                      if (!(e.target as HTMLElement).closest("a, button"))
                        router.push(`${base}/${lead.id}`);
                    }}
                  >
                    <td>
                      <Link href={`${base}/${lead.id}`} className={p.name}>
                        {lead.name}
                      </Link>
                      <small className="num">{spacedMobile(lead.mobile)}</small>
                    </td>
                    <td>
                      {STAGE_WORDS[lead.stage]}
                      {lead.paidRupees ? (
                        <small className="num">
                          Paid {formatRupees(lead.paidRupees)}
                        </small>
                      ) : null}
                    </td>
                    <td data-hide="true">{lead.doctors ?? "None yet"}</td>
                    <td
                      className="num"
                      data-hide={
                        !(lead.nextCallAt || lead.lastConsultAt) || undefined
                      }
                    >
                      {lead.nextCallAt
                        ? callWhen(lead.nextCallAt)
                        : lead.lastConsultAt
                          ? `Done ${shortDate(lead.lastConsultAt)}`
                          : "Not booked"}
                    </td>
                    <td
                      className="num"
                      data-hide={
                        !(lead.callStatus || lead.followUpOn) || undefined
                      }
                    >
                      {lead.callStatus ? CALL_WORDS[lead.callStatus] : "None"}
                      {lead.followUpOn && (
                        <small>Call again {shortDate(lead.followUpOn)}</small>
                      )}
                    </td>
                    {admin && (
                      <td data-hide="true">
                        {lead.salesperson ?? "Not assigned"}
                      </td>
                    )}
                    <td>
                      {callToday ? (
                        <button
                          type="button"
                          className={s.chip}
                          data-on="true"
                          onClick={() => join(lead.nextCallId!)}
                        >
                          Join the call
                        </button>
                      ) : (
                        <span
                          className={surfaceStyles.pill}
                          data-tone={step.tone}
                        >
                          {step.words}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
