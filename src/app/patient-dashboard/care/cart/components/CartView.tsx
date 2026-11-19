"use client";

/**
 * Your medicines: the cart a signed prescription filled, opened from Care or the WhatsApp link.
 * Everything is ready on arrival (the prescribed quantities, the discount, the delivery address), so
 * the one required tap is Pay, which opens Razorpay at once (checkout with payNow). The patient may
 * lower a quantity or take a line out, never go past the prescription. A first consultation's cart is
 * held back for the programme call (12 Nov 2026 call); until then the page says when it opens and
 * offers the prescription and a call back, and, quietly, ordering now if the patient asks (it is
 * their request, never a push: docs/backend/medicine-flow-prd.md, conflict 1). "I already have these"
 * stops the reminders about this order (the same as the WhatsApp button).
 * Data: GET/PATCH /api/care/cart and the prescription (carePlanService). Phone: one column, Pay right
 * under the bill; laptop: the lines left, the address and bill in a sticky column right.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FilePdf, Phone } from "@phosphor-icons/react";
import ItemisedBill from "@/app/patient-dashboard/components/ItemisedBill";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import Card from "@/components/ui/Card";
import ErrorNotice from "@/components/ui/ErrorNotice";
import FileOpenButton from "@/components/ui/FileOpenButton";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { longDate, shortDate, spokenDay } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import { errorMessage } from "@/lib/http/apiClient";
import { checkoutHref } from "@/lib/payments/checkoutHref";
import {
  boughtElsewhere,
  loadCarePlan,
  openCartNow,
  updateCart,
} from "@/services/carePlanService";
import { getFile } from "@/services/fileService";
import { contactSupport } from "@/services/patientProfileService";
import type { MedicineCart } from "@/types/carePlan";
import CartLineRow from "./CartLineRow";
import DeliveryAddress from "./DeliveryAddress";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import styles from "../CartPage.module.css";

const rupees = (paise: number) => formatRupees(paise / 100);

export default function CartView() {
  const toast = useToast();
  const plan = useApiResource("care-plan", loadCarePlan);
  // the server's answer after each change replaces the cart; until the first change, the loaded one
  const [edited, setEdited] = useState<MedicineCart | null>(null);
  const [saving, setSaving] = useState(false);
  const [calledBack, setCalledBack] = useState(false);
  const [opening, setOpening] = useState(false);
  const [elsewhere, setElsewhere] = useState(false);

  const prescription = plan.data?.prescription ?? null;
  const cart = edited ?? plan.data?.cart.cart ?? null;
  const availableAt = plan.data?.cart.availableAt ?? null;

  const change = async (next: Parameters<typeof updateCart>[0]) => {
    setSaving(true);
    try {
      setEdited(await updateCart(next));
    } catch (caught) {
      toast(errorMessage(caught, "That change was not saved."));
    } finally {
      setSaving(false);
    }
  };

  const orderNow = async () => {
    setOpening(true);
    try {
      await openCartNow();
      plan.reload();
    } catch (caught) {
      toast(errorMessage(caught, "Your order could not be opened. Try again."));
    } finally {
      setOpening(false);
    }
  };

  const haveThem = async () => {
    try {
      await boughtElsewhere();
      setElsewhere(true);
      toast("We will not remind you about this order again");
    } catch (caught) {
      toast(errorMessage(caught));
    }
  };

  const callBack = async () => {
    try {
      await contactSupport(
        "Call back about my medicines",
        "Please call me about the medicines on my prescription.",
      );
      setCalledBack(true);
      toast("We will call you soon");
    } catch (caught) {
      toast(errorMessage(caught));
    }
  };

  // a text link beside a card title; a pill beside "Call me" on the held screen
  const openPrescription = (className: string) =>
    prescription?.pdf ? (
      <FileOpenButton
        load={() => getFile(prescription.pdf!)}
        className={className}
      >
        <FilePdf size={16} aria-hidden="true" />
        <span>Prescription</span>
      </FileOpenButton>
    ) : null;

  const sub = prescription
    ? `${prescription.doctorName} prescribed these on ${shortDate(prescription.signedAt)}.`
    : undefined;
  const bought = cart?.lines.filter((line) => line.quantity > 0) ?? [];
  const canPay = Boolean(cart && cart.address && bought.length && !saving);

  return (
    <main className={`${layoutStyles.page} ${styles.page}`}>
      <PageHead
        title="Your medicines"
        back={{ href: "/patient-dashboard", label: "Home" }}
        sub={cart ? sub : undefined}
      />

      {plan.loading && !plan.data && <PageGhosts heights={[220, 180]} />}
      {plan.error && <ErrorNotice message={plan.error} onRetry={plan.reload} />}

      {plan.data && !cart && (
        <Card className={styles.held}>
          {availableAt ? (
            <>
              <p className={styles.heldTitle}>Your prescription is ready</p>
              <p className={styles.text}>
                Your medicine quote opens here{" "}
                {spokenDay(new Date(availableAt))}. Your care team calls you
                before then about your programme.{" "}
                <button
                  type="button"
                  className={styles.inlineLink}
                  disabled={opening}
                  onClick={orderNow}
                >
                  {opening ? "Opening your order" : "Order now instead"}
                </button>
              </p>
            </>
          ) : (
            <>
              <p className={styles.heldTitle}>Nothing to order right now</p>
              <p className={styles.text}>
                When your doctor prescribes medicine our pharmacy stocks, it is
                added here for you, ready to pay.
              </p>
            </>
          )}
          <div className={styles.heldActions}>
            {openPrescription(`btn btn--ghost ${styles.secondary}`)}
            {availableAt && (
              <button
                type="button"
                className={`btn btn--ghost ${styles.secondary}`}
                disabled={calledBack}
                onClick={callBack}
              >
                <Phone size={18} aria-hidden="true" />
                <span>{calledBack ? "We will call you" : "Call me"}</span>
              </button>
            )}
          </div>
        </Card>
      )}

      {cart && (
        <div className={styles.layout}>
          <Card
            title={
              cart.kind === "REFILL" ? "Your next supply" : "Prescribed for you"
            }
            className={styles.lines}
            action={openPrescription(styles.pdfLink)}
          >
            <ul className={styles.list}>
              {cart.lines.map((line) => (
                <CartLineRow
                  key={line.medicineId}
                  line={line}
                  disabled={saving}
                  onQuantity={(quantity) =>
                    change({
                      lines: [{ medicineId: line.medicineId, quantity }],
                    })
                  }
                />
              ))}
            </ul>
            {cart.validUntil && (
              <p className={styles.foot}>
                Valid until {longDate(cart.validUntil)}. You can buy less than
                prescribed, never more.
              </p>
            )}
          </Card>

          <div className={styles.side}>
            <Card title="Deliver to">
              <DeliveryAddress
                address={cart.address}
                onChoose={(addressId) => change({ addressId })}
              />
            </Card>

            <Card className={styles.billCard}>
              <ItemisedBill
                lines={
                  cart.discountPaise > 0
                    ? [
                        {
                          key: "mrp",
                          label: "Medicines at MRP",
                          amount: rupees(cart.mrpTotalPaise),
                        },
                        {
                          key: "off",
                          label: `Discount, ${cart.discountPercent}%`,
                          amount: `- ${rupees(cart.discountPaise)}`,
                        },
                      ]
                    : []
                }
                total={{
                  label: "To pay",
                  note: "From inrange's licensed pharmacy",
                  amount: rupees(cart.totalPaise),
                }}
              />
              {canPay ? (
                <Link
                  href={checkoutHref({
                    purpose: "MEDICINE_ORDER",
                    referenceId: cart.id,
                    returnTo: "/patient-dashboard",
                    payNow: true,
                  })}
                  className={`btn ${formStyles.go} ${styles.pay}`}
                >
                  <span>Pay {rupees(cart.totalPaise)}</span>
                  <span className="well" aria-hidden="true">
                    <ArrowRight size={18} />
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  className={`btn ${formStyles.go} ${styles.pay}`}
                  disabled
                >
                  <span>
                    {!bought.length
                      ? "Nothing in your cart"
                      : !cart.address
                        ? "Add an address to pay"
                        : `Pay ${rupees(cart.totalPaise)}`}
                  </span>
                </button>
              )}
              <p className={styles.small}>
                Card or UPI through Razorpay. You may also fill this
                prescription at any licensed pharmacy.{" "}
                {cart.boughtElsewhere || elsewhere ? (
                  "You told us you have these, so we will not remind you."
                ) : (
                  <button
                    type="button"
                    className={styles.inlineLink}
                    onClick={haveThem}
                  >
                    I already have these
                  </button>
                )}
              </p>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
