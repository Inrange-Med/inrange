"use client";

/**
 * Your medicines: the cart a signed prescription filled, opened from Care or the WhatsApp link.
 * Everything is ready on arrival (the prescribed quantities, the discount, the delivery address), so
 * the one required tap is Pay, which opens Razorpay at once (checkout with payNow). The patient may
 * lower a quantity or take a line out, never go past the prescription. The cart is open the moment the
 * prescription is sent, plan or not (19 Nov 2026: no waiting). "I already have these" stops the
 * reminders about this order (the same as the WhatsApp button).
 * Data: GET/PATCH /api/care/cart and the prescription (carePlanService). Phone: one column, Pay right
 * under the bill; laptop: the lines left, the address and bill in a sticky column right.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FilePdf } from "@phosphor-icons/react";
import ItemisedBill from "@/app/patient-dashboard/components/ItemisedBill";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import Card from "@/components/ui/Card";
import ErrorNotice from "@/components/ui/ErrorNotice";
import FileOpenButton from "@/components/ui/FileOpenButton";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { longDate, shortDate } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import { errorMessage } from "@/lib/http/apiClient";
import { checkoutHref } from "@/lib/payments/checkoutHref";
import {
  boughtElsewhere,
  loadCarePlan,
  updateCart,
} from "@/services/carePlanService";
import { getFile } from "@/services/fileService";
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
  const [elsewhere, setElsewhere] = useState(false);

  const prescription = plan.data?.prescription ?? null;
  const cart = edited ?? plan.data?.cart.cart ?? null;

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

  const haveThem = async () => {
    try {
      await boughtElsewhere();
      setElsewhere(true);
      toast("We will not remind you about this order again");
    } catch (caught) {
      toast(errorMessage(caught));
    }
  };

  // a text link beside a card title; a pill on the nothing-to-order card
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
  const canPay = Boolean(cart && cart.address && (bought.length || cart.plan) && !saving);

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
          <p className={styles.heldTitle}>Nothing to order right now</p>
          <p className={styles.text}>
            When your doctor prescribes medicine our pharmacy stocks, it is
            added here for you, ready to pay.
          </p>
          <div className={styles.heldActions}>
            {openPrescription(`btn btn--ghost ${styles.secondary}`)}
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
                lines={[
                  // the plan the doctor prescribed: one bill, one payment with the medicines
                  ...(cart.plan
                    ? [
                        {
                          key: "plan",
                          label: cart.plan.name,
                          amount: rupees(cart.plan.pricePaise),
                        },
                      ]
                    : []),
                  ...(cart.discountPaise > 0
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
                    : cart.plan
                      ? [
                          {
                            key: "medicines",
                            label: "Medicines",
                            amount: rupees(cart.mrpTotalPaise),
                          },
                        ]
                      : []),
                ]}
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
                    {!bought.length && !cart.plan
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
