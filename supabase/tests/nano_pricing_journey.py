"""The Nano plan's price and the cortisol add-on (20 Nov 2026), against the deployed pilot with BASE set (same
environment as medicine_flow_journey.py: BASE, PSQL_URL, OTP). Writes one test patient (mobile 98000...); clean up
with cleanup_test_patients.sql.

Walks: the care package shows Rs 1,799 against a real Rs 3,999, with the cortisol add-on at Rs 300 against Rs 350
-> a home collection held with the add-on ticked costs the two together -> the checkout itemises both -> held
without it, the package alone -> an add-on from nowhere is refused.
"""
import os, sys, time
from datetime import datetime, timedelta, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from medicine_flow_journey import call, step, sign_in, RUN  # noqa: E402

PATIENT = f"98000{7}{RUN}"
IST = timezone(timedelta(hours=5, minutes=30))
day = lambda n: (datetime.now(IST) + timedelta(days=n)).strftime("%Y-%m-%d")  # noqa: E731


def main():
    pt, _ = sign_in(PATIENT)
    s, b = call("GET", "/api/care-packages", pt)
    nano = next((p for p in b.get("data") or [] if p["code"] == "LAB_AND_CONSULT"), None)
    step("the Nano plan: Rs 1,799 against Rs 3,999", s == 200 and nano and nano["priceRupees"] == 1799 and nano["mrpRupees"] == 3999, b)
    cortisol = next((a for a in nano["addOns"] if a["code"] == "CORTISOL"), None) if nano else None
    step("the cortisol add-on: Rs 300 against Rs 350", cortisol and cortisol["priceRupees"] == 300 and cortisol["mrpRupees"] == 350, nano)

    addr = {"addressLine": "House 7, Sector 56", "landmark": "Near the park", "city": "Gurugram", "state": "Haryana",
            "pincode": "122011", "latitude": 28.42, "longitude": 77.1, "label": "Home", "isPrimary": True}
    s, b = call("POST", "/api/address/add", pt, addr)
    home = (b.get("data") or b)["addressId"]

    def hold(add_ons, n=1):
        slots = call("GET", f"/api/labs/slots?date={day(n)}&addressId={home}", pt)[1]["data"]
        slots = slots if isinstance(slots, list) else [x for v in (slots or {}).values() for x in v]
        return call("POST", "/api/labs/bookings", pt, {
            "packageCode": nano["labPackageCode"], "carePackageCode": "LAB_AND_CONSULT", "addOns": add_ons,
            "addressId": int(home), "collectionDate": day(n), "slotId": str(slots[0]["slotId"]),
            "patient": {"name": "Nano Check", "age": 41, "gender": "Female", "mobile": PATIENT, "email": "nano@example.com"}})

    s, b = hold(["CORTISOL"])
    price = (b.get("data") or {}).get("price", {})
    step("held with cortisol: Rs 2,099, the add-on named", s == 201 and price.get("total") == 2099 and price.get("packagePrice") == 1799
         and [a["code"] for a in price.get("addOns", [])] == ["CORTISOL"], b)
    s, o = call("POST", "/api/payments/orders", pt, {"purpose": "LAB_BOOKING", "referenceId": b["data"]["id"]})
    lines = [(l["label"], l["amountPaise"]) for l in (o.get("data") or {}).get("lineItems", [])]
    step("the checkout itemises the package and the test", s == 200 and o["data"]["amountPaise"] == 209900
         and [a for _, a in lines] == [179900, 30000] and "Cortisol" in lines[1][0], o)

    s, b = hold([])
    step("held without it: the package alone", s == 201 and b["data"]["price"]["total"] == 1799, b)
    s, b = hold(["NOT_A_TEST"])
    step("an add-on that does not exist is refused", s == 400, b)

    print(f"\nALL {__import__('medicine_flow_journey').passed} CHECKS PASSED")


if __name__ == "__main__":
    t0 = time.time()
    main()
    print(f"({time.time() - t0:.0f}s)")
