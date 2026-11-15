/**
 * One prescribed item in the cart: the medicine and its pack on the left, what it costs under the struck
 * MRP on the right, and the quantity (0 up to what was prescribed) under it. At 0 the line stays, dimmed,
 * so putting it back is one tap on plus.
 */

import QuantityStepper from "@/components/ui/QuantityStepper";
import { formatRupees } from "@/lib/format/money";
import type { CartLine } from "@/types/carePlan";
import styles from "../CartPage.module.css";

const rupees = (paise: number) => formatRupees(paise / 100);

export default function CartLineRow({
  line,
  disabled,
  onQuantity,
}: {
  line: CartLine;
  disabled: boolean;
  onQuantity: (quantity: number) => void;
}) {
  const shown = Math.max(line.quantity, 1);
  return (
    <li className={styles.line} data-out={line.quantity === 0 || undefined}>
      <div className={styles.lineText}>
        <strong>
          {line.brand} <span className="num">{line.strength}</span>
        </strong>
        <small>
          {line.molecule}, {line.pack}
        </small>
      </div>
      <div className={styles.linePrice}>
        {line.mrpPaise > line.pricePaise && (
          <s className="num">{rupees(line.mrpPaise * shown)}</s>
        )}
        <strong className="num">{rupees(line.pricePaise * shown)}</strong>
      </div>
      <div className={styles.lineQty}>
        {line.available ? (
          <>
            <small>
              {line.quantity === 0
                ? "Taken out"
                : `${line.prescribed} prescribed`}
            </small>
            <QuantityStepper
              value={line.quantity}
              max={line.prescribed}
              label={`${line.brand} ${line.strength}, quantity`}
              disabled={disabled}
              onChange={onQuantity}
            />
          </>
        ) : (
          <small>No longer stocked. Any licensed pharmacy can fill it.</small>
        )}
      </div>
    </li>
  );
}
