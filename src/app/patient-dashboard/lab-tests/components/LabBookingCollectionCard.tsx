/** Collection on one home blood test: when and where, who it is for, the price or plan, the lab's booking number. */

import Card from "@/components/ui/Card";
import { formatRupees } from "@/lib/format/money";
import type { LabBooking } from "@/types/labTest";
import { collectionWindow } from "./labBookingFormat";
import styles from "../LabTestsPage.module.css";

export default function LabBookingCollectionCard({
  booking,
}: {
  booking: LabBooking;
}) {
  return (
    <Card title="Collection" className={styles.card}>
      <dl className={styles.facts}>
        <div className={styles.wide}>
          <dt>When</dt>
          <dd className="num">{collectionWindow(booking)}</dd>
        </div>
        <div className={styles.wide}>
          <dt>Where</dt>
          <dd>{booking.address}</dd>
        </div>
        <div>
          <dt>For</dt>
          <dd>
            {booking.patient.name},{" "}
            <span className="num">{booking.patient.age}</span>,{" "}
            {booking.patient.gender.toLowerCase()}
          </dd>
        </div>
        <div>
          <dt>
            {booking.paymentRequired
              ? "Price"
              : booking.price.total > 0
                ? "Paid"
                : "Paid by"}
          </dt>
          <dd className="num">
            {booking.price.total > 0
              ? formatRupees(booking.price.total)
              : "Your plan"}
          </dd>
        </div>
        {booking.partnerBookingId && (
          <div>
            <dt>Lab booking number</dt>
            <dd className="num">{booking.partnerBookingId}</dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
