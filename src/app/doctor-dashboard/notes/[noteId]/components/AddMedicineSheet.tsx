/**
 * The doctor adds a medicine to the note by picking it from what the pharmacy stocks
 * (GET /api/pharmacy/inventory): type a few letters, tap the strength, set the packs, add. A picked item
 * goes into the patient's cart when the note is signed; a name typed that the pharmacy does not stock
 * goes on the prescription only. "How to take it" starts from the item's usual frequency.
 */

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import QuantityStepper from "@/components/ui/QuantityStepper";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Sheet from "@/components/ui/Sheet";
import { formatRupees } from "@/lib/format/money";
import { searchInventory } from "@/services/doctorPortalService";
import type { MedicineChange } from "@/types/clinicalNote";
import type { InventoryItem } from "@/types/doctor";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "./NoteListSections.module.css";

type Action = MedicineChange["action"];
type Added = Pick<
  MedicineChange,
  "action" | "name" | "strength" | "detail" | "medicineId" | "quantity"
>;

const ACTIONS: { value: Action; label: string }[] = [
  { value: "START", label: "Start" },
  { value: "CHANGE", label: "Change" },
  { value: "STOP", label: "Stop" },
  { value: "CONTINUE", label: "Continue" },
];

export default function AddMedicineSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (medicine: Added) => void;
}) {
  const [action, setAction] = useState<Action>("START");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<InventoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<InventoryItem | null>(null);
  const [strength, setStrength] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [detail, setDetail] = useState("");
  const [tried, setTried] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const missingName = !picked && !query.trim();

  // the whole list on open, then narrowed as the doctor types
  useEffect(() => {
    if (!open || picked) return;
    const stale = new AbortController();
    const timer = window.setTimeout(() => {
      searchInventory(query.trim(), stale.signal)
        .then((items) => {
          setFound(items);
          setFailed(false);
        })
        .catch(() => {
          if (!stale.signal.aborted) setFailed(true);
        });
    }, 160);
    return () => {
      stale.abort();
      clearTimeout(timer);
    };
  }, [open, query, picked]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => input.current?.focus(), 180);
    return () => clearTimeout(timer);
  }, [open]);

  const close = () => {
    setAction("START");
    setQuery("");
    setFound(null);
    setPicked(null);
    setStrength("");
    setQuantity(1);
    setDetail("");
    setTried(false);
    onClose();
  };

  const pick = (item: InventoryItem) => {
    setPicked(item);
    setQuantity(1);
    setDetail(item.defaultFrequency);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (missingName) return;
    onAdd(
      picked
        ? {
            action,
            name: picked.brand,
            strength: picked.strength,
            detail: detail.trim(),
            medicineId: picked.id,
            quantity: action === "STOP" ? null : quantity,
          }
        : {
            action,
            name: query.trim(),
            strength: strength.trim(),
            detail: detail.trim(),
            medicineId: null,
            quantity: null,
          },
    );
    close();
  };

  const typedOnly = !picked && query.trim().length > 0 && found?.length === 0;

  return (
    <Sheet open={open} onClose={close} title="Add a medicine">
      <form className={styles.addForm} onSubmit={submit} noValidate>
        <div className={formStyles.field}>
          <span className={formStyles.label}>Change</span>
          <SegmentedControl
            label="Change"
            value={action}
            options={ACTIONS}
            onChange={setAction}
          />
        </div>

        {picked ? (
          <div className={styles.picked}>
            <span>
              <strong>
                {picked.brand} <span className="num">{picked.strength}</span>
              </strong>
              <small>
                {picked.molecule}, {picked.form.toLowerCase()}. MRP{" "}
                {formatRupees(picked.mrpPaise / 100)} a {picked.pack}
              </small>
            </span>
            <button
              type="button"
              className={styles.pickAgain}
              onClick={() => setPicked(null)}
            >
              Change
            </button>
          </div>
        ) : (
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="rx-search">
              Medicine
            </label>
            <input
              ref={input}
              id="rx-search"
              className={formStyles.input}
              value={query}
              maxLength={80}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or molecule"
              aria-invalid={tried && missingName}
              aria-controls="rx-results"
              autoComplete="off"
            />
            {tried && missingName && (
              <span className={formStyles.err}>
                Choose a medicine or type its name.
              </span>
            )}
            {failed && (
              <span className={formStyles.err}>
                The pharmacy list did not load. Type the name to add it to the
                prescription only.
              </span>
            )}
            {found && found.length > 0 && (
              <ul id="rx-results" className={styles.picks}>
                {found.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={styles.pick}
                      onClick={() => pick(item)}
                    >
                      <strong>
                        {item.brand}{" "}
                        <span className="num">{item.strength}</span>
                      </strong>
                      <small>
                        {item.molecule}
                        <span className="num">
                          {" "}
                          {formatRupees(item.mrpPaise / 100)}
                        </span>
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {typedOnly && (
              <span className={styles.typedNote}>
                Not stocked by our pharmacy. It goes on the prescription; the
                patient buys it at any pharmacy.
              </span>
            )}
          </div>
        )}

        {!picked && typedOnly && (
          <label className={formStyles.field}>
            <span className={formStyles.label}>Strength</span>
            <input
              className={formStyles.input}
              value={strength}
              maxLength={40}
              onChange={(event) => setStrength(event.target.value)}
              placeholder="For example, 500 mg"
              autoComplete="off"
            />
          </label>
        )}

        {picked && action !== "STOP" && (
          <div className={styles.qtyRow}>
            <span className={formStyles.label}>
              Quantity, {picked.pack.replace(/\s*\(.*\)$/, "")}s
              <small>Goes into the patient&apos;s cart</small>
            </span>
            <QuantityStepper
              value={quantity}
              min={1}
              max={12}
              label={`${picked.brand} ${picked.strength}, quantity`}
              onChange={setQuantity}
            />
          </div>
        )}

        {(picked || typedOnly) && action !== "STOP" && (
          <label className={formStyles.field}>
            <span className={formStyles.label}>How to take it</span>
            <input
              className={formStyles.input}
              value={detail}
              maxLength={160}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="For example, twice a day after meals"
              autoComplete="off"
            />
          </label>
        )}

        <button type="submit" className={`btn ${formStyles.go}`}>
          <span>Add to the note</span>
          <span className="well" aria-hidden="true">
            <ArrowRight size={18} />
          </span>
        </button>
      </form>
    </Sheet>
  );
}
