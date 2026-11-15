"""The medicine cart, end to end, against the DEPLOYED pilot API (docs/backend/medicine-cart.md).

Usage: python3 supabase/tests/cart_journey.py <TEST_OTP> <dir for the two prescription PDFs>
Needs the test accounts on (secrets TEST_MOBILES with "98000*" and 9000000001, and TEST_OTP) and the
Supabase CLI linked. Writes only test patients (mobile 98000...). What the API cannot do without a person
(the admin's report review, a paid booking, a plan bought through Razorpay) is staged with SQL that
mirrors what those routes write; paying the cart itself needs the browser (test card 4100 2800 0000 1007).
Walks: sign-up -> first consultation -> doctor picks two strengths from the pharmacy -> one signature signs
the prescription (one month, cart held back) -> plan -> follow-up (3 months, cart at once) -> prices,
discount, quantity limits, server-priced medicine order, forged payment refused. Clean up afterwards with
supabase/tests/cleanup_test_patients.sql.
"""
import json, os, subprocess, sys, time, uuid, urllib.request, urllib.error

BASE = "https://wcsglsrjixfrobujchen.supabase.co/functions/v1"
OTP, OUT = sys.argv[1], sys.argv[2]
PATIENT = "98000" + str(int(time.time()))[-5:]
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def call(method, path, token=None, body=None):
    data, headers = None, {"Accept": "application/json", "x-region": "ap-south-1"}
    if body is not None:
        data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def step(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{json.dumps(detail)[:600]}]" if detail and not cond else ""))
    if not cond:
        sys.exit(1)


def sql(q):
    assert "98000" in q or "patient_id" in q
    r = subprocess.run(["supabase", "db", "query", "--remote=wcsglsrjixfrobujchen", "--yes", "-o", "json", q],
                       cwd=REPO, capture_output=True, text=True)
    if r.returncode:
        print(r.stdout, r.stderr); sys.exit(1)
    return r.stdout


def sign_in(mobile):
    s, b = call("POST", "/api/auth/send-otp", body={"mobile": mobile})
    if s == 429:
        time.sleep(31); s, b = call("POST", "/api/auth/send-otp", body={"mobile": mobile})
    step(f"send-otp {mobile[:5]}", s == 200 and b["data"]["mock"], b)
    s, b = call("POST", "/api/auth/verify-otp", body={"mobile": mobile, "otp": OTP})
    step(f"verify-otp {mobile[:5]}", s == 200, b)
    return b["data"]["accessToken"], b["data"]


def sentence(t):
    return {"id": uuid.uuid4().hex[:8], "text": t, "evidence": [], "by": "doctor", "flag": None}


# --- patient signs up ---
pt, info = sign_in(PATIENT)
pid = info["user"]["id"]
s, b = call("GET", "/api/onboarding/config", pt); version = b["data"]["consentVersion"]
for body in [
    {"step": 1, "fullName": "Cart Test", "firstName": "Cart", "lastName": "Test", "email": "cart@example.com"},
    {"step": 2, "gender": "Female"}, {"step": 3, "ageYears": 38}, {"step": 4, "heightCm": 162},
    {"step": 5, "weightKg": 84}, {"step": 6, "weightLossExperience": ["SELF_DIET"]},
    {"step": 7, "noConditions": False, "conditions": [{"code": "PREDIABETES"}]},
    {"step": 8, "consents": [{"type": t, "version": version, "accepted": True} for t in ["TERMS", "PRIVACY", "HEALTH_DATA", "TELECONSULT"]]},
]:
    s, b = call("PATCH", "/api/onboarding/step", pt, {**body, "mobile": PATIENT}); step(f"onboarding {body['step']}", s == 200, b)
s, b = call("POST", "/api/onboarding/complete", pt, {"mobile": PATIENT, "fullName": "Cart Test", "email": "cart@example.com",
                                                      "gender": "Female", "ageYears": 38, "heightCm": 162, "weightKg": 84})
step("onboarding complete", s == 200, b)
s, b = call("POST", "/api/address/add", pt, {"addressLine": "Flat 4B, Test Residency, Sector 45", "landmark": "Near the park",
                                              "city": "Gurugram", "state": "Haryana", "pincode": "122003", "isPrimary": True})
step("address saved", s in (200, 201), b)

# --- staged: report approved, first consultation paid and held with doctor 9000000001 ---
sql(f"""with u as (select id from users where mobile = '{PATIENT}' and mobile like '98000%'),
d as (select id from users where mobile = '9000000001')
insert into appointments (patient_id, doctor_id, status, visit_type, reason, started_at, ended_at)
select u.id, d.id, 'Completed', 'FIRST', 'Weight and prediabetes', now() - interval '35 minutes', now() - interval '5 minutes' from u, d""")
dt, _ = sign_in("9000000001")


def write_and_sign(rx_months, picks, expect_type):
    s, b = call("GET", "/api/doctor/notes", dt)
    mine = [n for n in b["data"] if n["patientId"] == str(pid) and n["status"] == "DRAFT"]
    step(f"{expect_type}: draft note opened", len(mine) == 1, b)
    s, b = call("GET", f"/api/doctor/notes/{mine[0]['id']}", dt); note = b["data"]
    step(f"{expect_type}: note says whether on a plan", "patientOnPlan" in note, note.keys())
    text = {"summary": "Discussed eating pattern, sleep and activity. Fasting sugar in the prediabetes range.",
            "assessment": "Obesity, BMI 32.0, with prediabetes (E66.9, R73.03).",
            "plan": "Start Metformin 500 mg, twice a day after meals.",
            "patient": "Take the pen on the same day each week. Eat protein at every meal. Walk 30 minutes a day."}
    for sec in note["sections"]:
        sec["current"] = [sentence(text[sec["key"]])]; sec["checked"] = True
    s, b = call("GET", "/api/pharmacy/inventory?query=mounjaro", dt)
    step("inventory search", s == 200 and len(b["data"]) == 6, b)
    raw = json.dumps(b).lower()
    step("inventory never carries a cost", "cost" not in raw and "pts" not in raw and "1014300" not in raw, b["data"][0])
    stock = {i["strength"]: i for i in b["data"]}
    for strength, qty in picks:
        it = stock[strength]
        note["medicines"].append({"id": "added-" + uuid.uuid4().hex[:8], "action": "START", "name": it["brand"], "strength": strength,
                                  "detail": it["defaultFrequency"], "was": None, "evidence": [], "include": True,
                                  "medicineId": it["id"], "quantity": qty})
    ch = {k: note[k] for k in ["sections", "medicines", "followUps", "recordUpdates", "checks"]}
    s, b = call("PUT", f"/api/doctor/notes/{note['id']}", dt, {**ch, "change": "Wrote the note"}); step("note saved", s == 200, b)
    s, b = call("POST", f"/api/doctor/notes/{note['id']}/sign", dt, {"sendToApp": True, "rxMonths": rx_months})
    step(f"{expect_type}: one signature signs the prescription", s == 200 and b["data"]["signed"]["prescriptionStatus"] == "SIGNED", b)


# --- first consultation (no plan): one month, cart held back ---
write_and_sign(3, [("2.5 mg", 1), ("5 mg", 1)], "first")
s, b = call("GET", f"/api/doctor/patients/{pid}/record", dt)
rx = [p for p in b["data"]["prescriptions"] if p["status"] == "SIGNED"][0]
step("nano: one month even though 3 were asked", rx["months"] == 1, rx)
step("both strengths kept (step-up)", sum("Mounjaro" in i["name"] for i in rx["items"]) == 2, rx["items"])
s, b = call("GET", "/api/care/prescription/current", pt); step("patient has the PDF", b["data"]["pdfUrl"], b)
with urllib.request.urlopen(b["data"]["pdfUrl"], timeout=60) as r, open(f"{OUT}/rx-first.pdf", "wb") as f:
    f.write(r.read())
s, b = call("GET", "/api/care/cart", pt)
step("nano: cart held back with availableAt", b["data"] is None and b.get("availableAt"), b)
s, b = call("PATCH", "/api/care/cart", pt, {"lines": []}); step("held cart cannot be changed", s == 404, b)

# --- staged: patient buys the 3-month plan, then a follow-up ---
sql(f"""with u as (select id from users where mobile = '{PATIENT}' and mobile like '98000%')
insert into subscriptions (user_id, plan_id, status, starts_at, ends_at)
select u.id, (select id from plans where active and duration_months = 3), 'Active', now(), now() + interval '3 months' from u;
with u as (select id from users where mobile = '{PATIENT}' and mobile like '98000%'),
d as (select id from users where mobile = '9000000001')
insert into appointments (patient_id, doctor_id, status, visit_type, reason, started_at, ended_at)
select u.id, d.id, 'Completed', 'FOLLOW_UP', 'Month one review', now() - interval '20 minutes', now() - interval '2 minutes' from u, d""")
write_and_sign(3, [("5 mg", 2), ("7.5 mg", 1)], "follow-up")
s, b = call("GET", f"/api/doctor/patients/{pid}/record", dt)
rx = [p for p in b["data"]["prescriptions"] if p["status"] == "SIGNED"][0]
step("on a plan: the doctor's 3 months stand", rx["months"] == 3, rx)
s, b = call("GET", "/api/care/prescription/current", pt)
with urllib.request.urlopen(b["data"]["pdfUrl"], timeout=60) as r, open(f"{OUT}/rx-followup.pdf", "wb") as f:
    f.write(r.read())
s, b = call("GET", "/api/care/cart", pt); cart = b["data"]
step("on a plan: cart open at once", s == 200 and cart, b)
lines = {l["strength"]: l for l in cart["lines"]}
step("cart lines are the stocked items at prescribed quantities",
     lines["5 mg"]["quantity"] == 2 and lines["5 mg"]["prescribed"] == 2 and lines["7.5 mg"]["quantity"] == 1, cart["lines"])
# 13% under 6 months, whole rupees
step("default discount 13%", cart["discountPercent"] == 13 and lines["5 mg"]["pricePaise"] == 1427300
     and lines["7.5 mg"]["pricePaise"] == 1794400, cart)
step("total adds up", cart["totalPaise"] == 2 * 1427300 + 1794400 and cart["mrpTotalPaise"] == 2 * 1640625 + 2062500, cart)
step("address preselected", cart["address"] and "Test Residency" in cart["address"]["line"], cart["address"])
step("cart never carries a cost", "cost" not in json.dumps(cart).lower(), cart)
mid = lines["5 mg"]["medicineId"]
s, b = call("PATCH", "/api/care/cart", pt, {"lines": [{"medicineId": mid, "quantity": 3}]})
step("more than prescribed is refused", s == 400, b)
s, b = call("PATCH", "/api/care/cart", pt, {"lines": [{"medicineId": mid, "quantity": 1}]})
step("lower a quantity", s == 200 and b["data"]["totalPaise"] == 1427300 + 1794400, b)
s, b = call("GET", "/api/care/cart", pt); step("older nano cart closed, one open cart", b["data"]["id"] == cart["id"], b)
s, b = call("POST", "/api/payments/orders", pt, {"purpose": "MEDICINE_ORDER", "referenceId": cart["id"]})
step("medicine order priced by the server", s == 200 and b["data"]["amountPaise"] == 1427300 + 1794400, b)
step("bill shows MRP lines and the discount", any("Discount, 13%" in l["label"] for l in b["data"]["lineItems"]), b["data"]["lineItems"])
order = b["data"]["orderId"]
s, b = call("POST", "/api/payments/verify", pt, {"orderId": order, "razorpayPaymentId": "pay_forged", "razorpaySignature": "forged"})
step("forged payment refused", s == 400, b)
s, b = call("GET", "/api/care/medicine-orders", pt); step("no delivery before payment", b["data"] == [], b)
s, b = call("GET", "/api/subscriptions/plans")
step("plans: 3/6/9/12, MRP above price", [p["DurationMonths"] for p in b["data"]] == [3, 6, 9, 12]
     and all(p["Mrp"] > p["Price"] for p in b["data"]), b)
print(f"\nCART E2E OK  patient {PATIENT} (user {pid}); open cart {cart['id']}, order {order}")
