"""The 23 Nov 2026 client call, against the DEPLOYED API: the sales panel, the coach's panel, payment links whose
payment starts the plan, the calls admin schedules, and who may reach what.

Usage: OTP=<TEST_OTP> ADMIN=<a test admin's mobile> python3 supabase/tests/sales_coach_journey.py
Signs in two new test patients, two new salespeople and a new coach (98000...), a test admin and the pilot's first
test doctor (9000000001). It pays nothing: a test patient's payment link is paid with admin's "play the payment".
With Razorpay live it makes real payment links for the test patient (never texted) and withdraws them. It leaves
the test people behind; remove them when the pilot is cleaned.

  roles         each role reaches only its own routes; a salesperson only their leads; a coach only their patients;
                the operations team only its desks
  pay first     the care package is paid for with no time chosen; the patient then has the blood test to book
  sales         admin assigns a customer -> the salesperson sees them -> a payment link within the plan's discount ->
                a new link replaces the last -> the app shows it to the patient -> paid: the plan starts, the sale is
                recorded with the amount and the payment ID, the patient has an invoice
  coach         a diet chart (the health coach, not the exercise plan), a call counted against the plan, a remark;
                the doctor and the patient read them; a coach never sees the sale
  calls         admin books with the salesperson -> the call is listed -> its links -> the salesperson joins
  prescription  one month at most, plan or not
"""
import json, os, sys, time, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

BASE = os.environ.get("BASE", "https://wcsglsrjixfrobujchen.supabase.co/functions/v1").rstrip("/")
OTP = os.environ["OTP"]
ADMIN = os.environ["ADMIN"]
RUN = str(int(time.time()))[-4:]
PATIENT, OTHER, SELLER, SELLER2, COACH, FITNESS, OPS = (f"98000{n}{RUN}" for n in (5, 4, 3, 2, 1, 6, 7))
IST = timezone(timedelta(hours=5, minutes=30))
passed = 0


def call(method, path, token=None, body=None):
    h = {"Accept": "application/json"}
    data = None
    if body is not None:
        data, h["Content-Type"] = json.dumps(body).encode(), "application/json"
    if token:
        h["Authorization"] = f"Bearer {token}"
    try:
        with urllib.request.urlopen(urllib.request.Request(BASE + path, data=data, method=method, headers=h), timeout=120) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"null")
        except ValueError:
            return e.code, None


def step(name, cond, detail=""):
    global passed
    print(("PASS " if cond else "FAIL ") + name + (f"  [{json.dumps(detail, default=str)[:900]}]" if not cond else ""))
    if not cond:
        sys.exit(1)
    passed += 1


def sign_in(mobile):
    call("POST", "/api/auth/send-otp", body={"mobile": mobile})
    s, b = call("POST", "/api/auth/verify-otp", body={"mobile": mobile, "otp": OTP})
    step(f"signed in {mobile}", s == 200, b)
    return b["data"]["accessToken"], b["data"]["user"]["id"], b["data"]["user"]["role"]


def refused(token, routes):
    """Every route answers 401, 403 or 404: never data."""
    bad = [(m, p, s) for m, p in routes for s in [call(m, p, token, {} if m != "GET" else None)[0]] if s not in (401, 403, 404)]
    return not bad, bad


def main():
    admin, _, _ = sign_in(ADMIN)
    doctor, doctor_id, _ = sign_in("9000000001")
    patient, pid, _ = sign_in(PATIENT)
    other, oid, _ = sign_in(OTHER)
    sheet = lambda: call("GET", f"/api/admin/medicine/patients/{pid}", admin)[1]["data"]

    # ---------------------------------------------------------------- the sales team signs in
    names = {SELLER: f"Test Seller {RUN}", SELLER2: f"Test Seller Two {RUN}"}
    for mobile, name in names.items():
        s, b = call("POST", "/api/admin/salespeople", admin, {"fullName": name, "mobile": mobile})
        step(f"admin adds {name} with a sign-in", s == 200 and any(p["fullName"] == name and p["canSignIn"] for p in b["data"]), b)
    team = call("GET", "/api/admin/salespeople", admin)[1]["data"]
    sid, sid2 = (next(p["id"] for p in team if p["fullName"] == names[m]) for m in (SELLER, SELLER2))
    s, b = call("POST", "/api/admin/salespeople", admin, {"fullName": f"Test Clash {RUN}", "mobile": PATIENT})
    step("a patient's number cannot become a salesperson's sign-in", s == 409, b)
    seller, _, role = sign_in(SELLER)
    step("the salesperson's role is SALES", role == "SALES", role)
    seller2, _, _ = sign_in(SELLER2)
    s, b = call("GET", "/api/sales/me", seller)
    step("the sales panel opens: no customers yet", s == 200 and b["data"]["patients"] == 0 and b["data"]["name"] == names[SELLER], b)

    # ---------------------------------------------------------------- who may reach what
    admin_only = [("GET", "/api/admin/medicine/patients"), ("GET", f"/api/admin/medicine/patients/{pid}"), ("GET", "/api/admin/payments"),
                  ("GET", "/api/admin/plans"), ("GET", "/api/admin/calls"), ("GET", "/api/admin/salespeople"), ("GET", "/api/admin/doctors"),
                  ("GET", "/api/admin/reviews"), ("POST", f"/api/admin/medicine/patients/{pid}/payment-links"),
                  ("PUT", f"/api/admin/medicine/patients/{pid}/plan"), ("POST", "/api/admin/salespeople"), ("PATCH", "/api/admin/plans/1"),
                  ("GET", "/api/admin/pipeline"), ("GET", f"/api/admin/patients/{pid}/lab"), ("GET", "/api/admin/lab/places?q=delhi"),
                  ("POST", f"/api/admin/patients/{pid}/lab/bookings"), ("POST", f"/api/admin/patients/{pid}/addresses"),
                  ("POST", "/api/admin/lab-bookings/LB-1/paid"), ("POST", "/api/admin/lab-bookings/LB-1/cancel")]
    doctor_only = [("GET", f"/api/doctor/patients/{pid}/page"), ("PUT", f"/api/doctor/patients/{pid}/prescription"), ("GET", "/api/doctor/patients")]
    patient_only = [("GET", "/api/patient/next-step"), ("GET", "/api/care/cart"), ("GET", "/api/care/coach-plans"), ("GET", "/api/payments")]
    sales_only = [("GET", "/api/sales/me"), ("GET", "/api/sales/patients"), ("GET", f"/api/sales/patients/{pid}"), ("GET", "/api/sales/plans"),
                  ("POST", f"/api/sales/patients/{pid}/payment-links"), ("POST", f"/api/sales/patients/{pid}/sale")]
    coach_only = [("GET", "/api/coach/patients"), ("GET", f"/api/coach/patients/{pid}"), ("PUT", f"/api/coach/patients/{pid}/plans/diet"),
                  ("POST", f"/api/coach/patients/{pid}/calls")]
    files = [("GET", "/api/files/prescriptions/1"), ("GET", "/api/files/reports/1")]
    ok, bad = refused(seller, admin_only + doctor_only + patient_only + coach_only + files)
    step("a salesperson reaches nothing of admin's, a doctor's, a patient's or a coach's", ok, bad)
    ok, bad = refused(other, admin_only + doctor_only + sales_only + coach_only)
    step("a patient reaches nothing of admin's, a doctor's, sales' or a coach's", ok, bad)
    ok, bad = refused(doctor, [r for r in admin_only if r[1] != "/api/admin/doctors"] + sales_only + coach_only)
    step("a doctor reaches nothing of admin's, sales' or a coach's", ok, bad)
    s, b = call("GET", "/api/sales/patients?salespersonId=none", admin)
    step("an admin reaches every lead through the same routes", s == 200 and any(x["id"] == str(pid) for x in b["data"]), b)
    ok, bad = refused(None, admin_only + sales_only + coach_only + doctor_only + patient_only)
    step("nothing opens without a sign-in", ok, bad)

    # ---------------------------------------------------------------- blood tests: the patient's two days, the team's side
    day = lambda n: (datetime.now(IST) + timedelta(days=n)).date().isoformat()
    for n, words in ((0, "today"), (3, "three days ahead")):
        s, b = call("GET", f"/api/labs/slots?addressId=1&date={day(n)}", patient)
        step(f"a patient cannot book a blood test for {words}", s == 400 and "tomorrow" in b["message"], b)
    s, b = call("POST", "/api/labs/bookings", patient, {"packageCode": "X", "addressId": 1, "collectionDate": day(4), "slotId": 1})
    step("nor hold a time beyond the day after tomorrow", s == 400 and "tomorrow" in b["message"], b)
    s, b = call("GET", "/api/admin/pipeline", admin)
    step("admin sees who to call, by where they are stuck", s == 200
         and set(b["data"]) == {"bloodTest", "paidNoTest", "labProblem", "consultation", "plan", "coach"}, b)

    # ---------------------------------------------------------------- pay first, then book
    s, b = call("POST", "/api/payments/orders", other, {"purpose": "CARE_PACKAGE", "referenceId": "LAB_AND_CONSULT"})
    step("the care package is paid for first: the order is for its price, with no time chosen",
         s == 200 and b["data"]["amountPaise"] > 0 and b["data"]["lineItems"], b)
    s, b = call("POST", f"/api/admin/patients/{oid}/lab/credit", admin, {"paymentRef": "pay_TESTCARE" + RUN})
    step("a payment taken outside the app is recorded before any booking", s == 200, b)
    s, b = call("GET", "/api/eligibility", other)
    step("the patient has paid and has the blood test to book", s == 200 and b["data"]["labCredit"] is True, b)
    s, b = call("GET", "/api/patient/next-step", other)
    step("their app says: book your home blood test", b["data"]["stage"] == "BOOK_BLOOD_TEST", b["data"])
    s, b = call("POST", "/api/payments/orders", other, {"purpose": "CARE_PACKAGE", "referenceId": "LAB_AND_CONSULT"})
    step("it cannot be paid for twice", s == 409, b)
    s, b = call("GET", "/api/admin/pipeline", admin)
    step("the team's list has them: paid, blood test not booked", any(x["patientId"] == str(oid) for x in b["data"]["paidNoTest"]), b["data"]["paidNoTest"][:3])
    s, b = call("GET", f"/api/admin/patients/{oid}/lab", admin)
    step("and a time booked for them now would cost nothing", b["data"]["credit"] is True, b)
    s, b = call("DELETE", f"/api/admin/patients/{oid}/lab/credit", admin)
    step("a refund takes the payment back out", s == 200 and call("GET", "/api/eligibility", other)[1]["data"]["labCredit"] is False, b)

    # ---------------------------------------------------------------- the operations team: one desk, only its work
    s, b = call("POST", "/api/admin/team", admin, {"fullName": f"Test Desk {RUN}", "mobile": OPS, "desks": ["BLOOD_TESTS"]})
    step("admin adds someone to the blood test desk", s == 200, b)
    ops_id = next(x["id"] for x in b["data"] if x["mobile"] == OPS)
    ops, _, role = sign_in(OPS)
    step("their role is OPS", role == "OPS", role)
    s, b = call("GET", "/api/admin/pipeline", ops)
    step("the blood test desk sees its own lists, and none of the others", s == 200 and b["data"]["plan"] == [] and b["data"]["consultation"] == []
         and b["data"]["coach"] == [], {k: len(v) for k, v in b["data"].items()})
    s, b = call("GET", f"/api/admin/patients/{pid}/lab", ops)
    step("and opens a patient's blood test bookings", s == 200, b)
    ok, bad = refused(ops, [("GET", "/api/admin/calls"), ("GET", "/api/admin/medicine/orders"), ("GET", "/api/admin/payments"),
                            ("GET", "/api/admin/medicine/tasks"), ("PUT", f"/api/admin/medicine/patients/{pid}/plan"),
                            ("POST", f"/api/admin/medicine/patients/{pid}/consultations"), ("GET", "/api/admin/team"), ("POST", "/api/admin/coaches"),
                            ("GET", "/api/admin/reviews"), ("PATCH", "/api/admin/plans/1")] + sales_only + coach_only + doctor_only + patient_only)
    step("but nothing of the other desks, of admin's, of sales', a coach's, a doctor's or a patient's", ok, bad)
    s, b = call("PATCH", f"/api/admin/team/{ops_id}", admin, {"desks": []})
    step("admin takes them off the team", s == 200, b)
    s, b = call("GET", "/api/admin/pipeline", ops)
    step("and they are signed out at once", s == 401, b)
    s, b = call("POST", "/api/admin/coaches", admin, {"fullName": f"Test Fitness {RUN}", "mobile": FITNESS, "kind": "FITNESS"})
    step("admin adds a fitness coach", s == 200 and b["data"]["kind"] == "FITNESS", b)
    s, b = call("GET", f"/api/admin/patients/{pid}/lab", admin)
    step("admin opens what booking a blood test for the patient needs", s == 200 and b["data"]["bookings"] == [] and b["data"]["priceRupees"], b)

    # ---------------------------------------------------------------- a customer is assigned
    s, b = call("GET", f"/api/sales/patients/{pid}", seller)
    step("a salesperson cannot open a patient who is not theirs", s == 404, b)
    s, b = call("PATCH", f"/api/admin/medicine/patients/{pid}/salesperson", admin, {"salespersonId": sid})
    step("admin assigns the patient to the salesperson", s == 200, b)
    s, b = call("GET", "/api/sales/patients", seller)
    step("the salesperson sees their customer, and only them", s == 200 and [p["id"] for p in b["data"]] == [str(pid)], b)
    s, b = call("GET", f"/api/sales/patients/{pid}", seller)
    step("and opens them: where they stand, no plan, no links", s == 200 and b["data"]["lead"]["planName"] is None
         and b["data"]["lead"]["stage"] in ("NEW", "PAID") and b["data"]["links"] == [] and b["data"]["sale"] is None, b)
    s, b = call("POST", f"/api/sales/patients/{pid}/updates", seller, {})
    step("a call note needs something in it", s == 400, b)
    tomorrow = (datetime.now(IST) + timedelta(days=1)).date().isoformat()
    s, b = call("POST", f"/api/sales/patients/{pid}/updates", seller, {"callStatus": "CALL_BACK", "remark": "Asked to call after 6", "followUpOn": tomorrow})
    step("the salesperson notes a call and when to call again", s == 200, b)
    lead = call("GET", "/api/sales/patients", seller)[1]["data"][0]
    step("the lead shows the note", lead["callStatus"] == "CALL_BACK" and lead["followUpOn"] == tomorrow and lead["remark"] == "Asked to call after 6", lead)
    s, b = call("POST", f"/api/sales/patients/{pid}/updates", seller2, {"remark": "x"})
    step("another salesperson cannot write on the lead", s == 404, b)
    s, b = call("PUT", f"/api/sales/patients/{pid}/sale-form", seller, {"condition": "Obesity"})
    step("the sales form waits for the payment", s == 409, b)
    s, b = call("GET", f"/api/sales/patients/{pid}", seller2)
    step("another salesperson cannot", s == 404, b)

    # ---------------------------------------------------------------- the payment link
    s, plans = call("GET", "/api/admin/plans", admin)
    plan = plans["data"][0]
    was = plan["maxDiscountPercent"]
    s, b = call("PATCH", f"/api/admin/plans/{plan['id']}", admin, {"maxDiscountPercent": 10})
    step("admin lets salespeople take up to 10% off the plan", s == 200 and b["data"][0]["maxDiscountPercent"] == 10, b)
    s, b = call("GET", "/api/sales/plans", seller)
    on_sale = next(p for p in b["data"] if p["id"] == plan["id"])
    step("the salesperson sees the plan, what it includes and their limit", on_sale["maxDiscountPercent"] == 10 and on_sale["doctorConsults"] == plan["months"]
         and on_sale["coachCalls"] == plan["months"] * 4, on_sale)
    form = {"planId": plan["id"], "discountPercent": 20, "coachPreference": "Hindi, evenings", "note": "Wants to start next week"}
    s, b = call("POST", f"/api/sales/patients/{pid}/payment-links", seller, form)
    step("a discount over the limit is refused", s == 400, b)
    s, b = call("POST", f"/api/sales/patients/{pid}/payment-links", seller, {**form, "discountPercent": 10})
    price = round(plan["priceRupees"] * 0.9)
    step("the salesperson makes a payment link at 10% off", s == 200 and b["data"]["url"].startswith("http") and b["data"]["amountRupees"] == price
         and b["data"]["texted"] is False, b)
    first = b["data"]["id"]
    s, b = call("GET", "/api/patient/next-step", patient)
    step("the app shows the patient the same link and price", s == 200 and b["data"]["stage"] == "PAYMENT_DUE" and b["data"].get("payUrl")
         and b["data"]["bill"]["totalPaise"] == price * 100, b["data"])
    s, b = call("POST", f"/api/sales/payment-links/{first}/check", seller2)
    step("another salesperson cannot touch the link", s == 404, b)
    s, b = call("POST", f"/api/sales/payment-links/{first}/check", seller)
    step("checking it: not paid yet", s == 200 and b["data"]["status"] == "CREATED", b)
    s, b = call("POST", f"/api/sales/patients/{pid}/payment-links", seller, {**form, "discountPercent": 0})
    step("a new link at the full price", s == 200 and b["data"]["amountRupees"] == plan["priceRupees"], b)
    link = b["data"]["id"]
    links = call("GET", f"/api/sales/patients/{pid}", seller)[1]["data"]["links"]
    step("replaces the last: one link waits", [l["status"] for l in links] == ["CREATED", "CANCELLED"] and links[0]["id"] == link, links)
    s, b = call("POST", f"/api/sales/patients/{pid}/sale", seller, {"planId": plan["id"], "paymentId": "pay_NotARealOne" + RUN})
    step("a payment ID Razorpay does not know starts nothing", s in (400, 409), b)
    s, b = call("POST", f"/api/admin/payment-links/{link}/simulate-paid", seller)
    step("only an admin can play a test payment", s == 403, b)

    # ---------------------------------------------------------------- paid: the plan starts by itself
    s, b = call("POST", f"/api/admin/payment-links/{link}/simulate-paid", admin)
    step("the link is paid (test)", s == 200, b)
    p = sheet()["patient"]
    sale = p["planSale"]
    step("the plan started, with the sale recorded from the link", p["plan"] == plan["name"] and sale["salesperson"] == names[SELLER]
         and sale["coachPreference"] == "Hindi, evenings" and sale["paid"]["where"] == "LINK" and sale["paid"]["amountRupees"] == plan["priceRupees"]
         and sale["paid"]["ref"].startswith("pay_"), p)
    step("a health coach and a fitness coach were assigned when the plan started; fitness starts three weeks in",
         p["coach"] is not None and p["fitnessCoach"] is not None and p["fitnessCoach"]["startsOn"] > datetime.now(IST).date().isoformat(), p)
    d = call("GET", f"/api/sales/patients/{pid}", seller)[1]["data"]
    step("the salesperson sees the sale, filled in from the payment, with the form to fill in",
         d["lead"]["stage"] == "ON_PLAN" and d["lead"]["formDue"] is True and d["sale"]["paymentId"].startswith("pay_")
         and d["sale"]["amountRupees"] == plan["priceRupees"] and d["sale"]["salesperson"] == names[SELLER] and d["sale"]["submittedAt"] is None, d["sale"])
    s, b = call("PUT", f"/api/sales/patients/{pid}/sale-form", seller,
                {"condition": "Obesity", "programme": "Weight care", "note": "Starts Monday"})
    step("the salesperson fills in the sales form", s == 200, b)
    d = call("GET", f"/api/sales/patients/{pid}", seller)[1]["data"]
    step("and it is kept with the sale", d["lead"]["formDue"] is False and d["sale"]["condition"] == "Obesity" and d["sale"]["programme"] == "Weight care"
         and d["sale"]["coachPreference"] == "Hindi, evenings" and d["sale"]["submittedBy"], d["sale"])
    s, b = call("GET", "/api/payments", patient)
    step("the patient has the payment, with an invoice number", s == 200 and any(x["id"] == link and x["invoiceNumber"] for x in b["data"]), b)
    s, b = call("GET", "/api/patient/next-step", patient)
    step("and is no longer asked to pay", b["data"].get("stage") != "PAYMENT_DUE", b["data"])
    s, b = call("POST", f"/api/admin/payment-links/{link}/simulate-paid", admin)
    step("a paid link cannot be paid again", s == 409, b)
    s, b = call("POST", f"/api/sales/patients/{pid}/payment-links", seller, form)
    step("someone on a plan gets no new link", s in (400, 409), b)
    s, b = call("GET", "/api/admin/payments", admin)
    mine = next((l for l in b["data"]["links"] if l["id"] == link), None)
    step("admin's Payments shows who paid", mine and mine["status"] == "PAID" and mine["patientMobile"] == PATIENT and mine["paymentId"], mine)
    s, b = call("GET", "/api/sales/me", seller)
    step("the sale counts for the salesperson", b["data"]["plansSold"] == 1 and b["data"]["patients"] == 1, b)

    # ---------------------------------------------------------------- the coach
    s, b = call("POST", "/api/admin/coaches", admin, {"fullName": f"Test Coach {RUN}", "mobile": COACH})
    step("admin adds a coach", s == 200, b)
    coach_id = b["data"]["id"]
    coach, _, _ = sign_in(COACH)
    s, b = call("GET", f"/api/coach/patients/{pid}", coach)
    step("a coach cannot open a patient who is not theirs", s == 404, b)
    call("PATCH", f"/api/admin/medicine/patients/{pid}/fitness-coach", admin, {"coachId": None})
    s, b = call("PATCH", f"/api/admin/medicine/patients/{pid}/coach", admin, {"coachId": coach_id})
    step("admin makes them the patient's health coach", s == 200, b)
    s, b = call("GET", "/api/coach/patients", coach)
    step("the coach sees their patient, and only them", s == 200 and [x["id"] for x in b["data"]] == [str(pid)] and b["data"][0]["asHealth"]
         and not b["data"][0]["asFitness"], b)
    s, b = call("PUT", f"/api/coach/patients/{pid}/plans/diet", coach, {"text": "Breakfast: two eggs and one roti.\nLunch: dal, sabzi, salad."})
    step("the health coach writes the diet chart", s == 200, b)
    s, b = call("PUT", f"/api/coach/patients/{pid}/plans/fitness", coach, {"text": "Walk 30 minutes every day."})
    step("but not the exercise plan: that is the fitness coach's", s == 403, b)
    s, b = call("POST", f"/api/coach/patients/{pid}/calls", coach, {"note": "First call: explained the chart"})
    step("the coach logs a call", s == 200, b)
    s, b = call("POST", f"/api/coach/patients/{pid}/calls", coach, {"calledOn": "2999-01-01"})
    step("a call cannot be logged ahead of time", s == 400, b)
    s, b = call("POST", f"/api/admin/medicine/patients/{pid}/remarks", coach, {"text": "Followed the chart on most days."})
    step("and writes a remark for the doctor", s == 200, b)
    s, b = call("GET", f"/api/coach/patients/{pid}", coach)
    d = b["data"]
    step("the coach's page: the plan and what it includes, the chart, the call counted, the remark",
         d["plan"]["coachCalls"] == plan["months"] * 4 and d["diet"]["versions"] == 1 and d["healthCallsMade"] == 1 and len(d["remarks"]) == 1
         and d["can"] == {"health": True, "fitness": False}, d)
    s, b = call("GET", f"/api/admin/medicine/patients/{pid}", coach)
    step("a coach never sees the sale", s == 200 and b["data"]["patient"]["planSale"] is None and b["data"]["patient"]["salesperson"] is None
         and b["data"]["links"] == [], b["data"]["patient"])
    ok, bad = refused(coach, sales_only + doctor_only + patient_only + [r for r in admin_only if "/medicine/patients" not in r[1]]
                      + [("GET", f"/api/coach/patients/{oid}"), ("POST", f"/api/admin/medicine/patients/{pid}/payment-links")])
    step("a coach reaches nothing of sales', a doctor's, a patient's or admin's, nor another patient", ok, bad)
    s, b = call("GET", "/api/care/coach-plans", patient)
    step("the patient reads the diet chart in the app", s == 200 and b["data"]["diet"]["by"] == f"Test Coach {RUN}" and b["data"]["fitness"] is None, b)
    call("PUT", f"/api/admin/medicine/patients/{pid}/doctors/{doctor_id}", admin)
    s, b = call("GET", f"/api/doctor/patients/{pid}/page", doctor)
    step("the doctor reads the chart, the calls and the remark", s == 200 and b["data"]["coach"]["diet"]["text"].startswith("Breakfast")
         and b["data"]["coach"]["healthCallsMade"] == 1 and len(b["data"]["coachRemarks"]) == 1, b["data"].get("coach"))
    inc = sheet()["included"]
    step("admin sees what the plan includes against what has happened", inc["coachCalls"] == plan["months"] * 4 and inc["coachCallsMade"] == 1
         and inc["doctorConsults"] == plan["months"], inc)

    # ---------------------------------------------------------------- one month at most, on a plan too
    rx = f"/api/doctor/patients/{pid}/prescription"
    line = {"key": "a", "medicineId": None, "name": "Test Vitamin D 60000 IU", "dose": "1 capsule", "frequency": "WEEKLY",
            "frequencyOther": "", "durationValue": 2, "durationUnit": "MONTHS", "intake": "WITH_FOOD"}
    call("PUT", rx, doctor, {"diagnosis": "Obesity", "patientHistory": "", "remarks": "", "advice": "", "medicines": [line]})
    s, b = call("POST", f"{rx}/pdf", doctor)
    step("a two-month line is refused for a patient on a plan: every prescription is one month", s >= 400 and "one month" in (b or {}).get("message", ""), b)
    call("DELETE", rx, doctor)

    # ---------------------------------------------------------------- the calls admin schedules
    free = []
    for n in range(1, 8):
        day = (datetime.now(IST) + timedelta(days=n)).date().isoformat()
        s, b = call("GET", f"/api/schedule/slots/{doctor_id}/{day}", admin)
        free = [x for x in (b.get("data") or []) if x["Status"] == "Available"] if s == 200 else []
        if free:
            break
    if not free:
        print("SKIP the calls (the test doctor has no free times in the next week)")
    else:
        s, b = call("POST", f"/api/admin/medicine/patients/{pid}/consultations", admin, {"slotId": free[0]["SlotId"], "salespersonId": sid2})
        step("admin books a consultation and names the salesperson on it", s == 200, b)
        cid = b["data"]["appointmentId"]
        step("the patient is now that salesperson's", sheet()["patient"]["salespersonId"] == sid2)
        s, b = call("GET", "/api/admin/calls", admin)
        row = next((a for a in b["data"]["upcoming"] if a["id"] == cid), None)
        step("the call is on admin's list, with the doctor and the salesperson", row and row["salesperson"] == names[SELLER2]
             and row["patientMobile"] == PATIENT, row)
        s, b = call("GET", f"/api/admin/consultations/{cid}/links", admin)
        step("admin gets the video links for the patient, the doctor and the salesperson", s == 200 and b["data"]["patient"].startswith("http")
             and b["data"]["doctor"].startswith("http") and b["data"]["sales"].startswith("http")
             and len({b["data"]["patient"].split("?")[0], b["data"]["doctor"].split("?")[0]}) == 2, b)
        s, b = call("GET", f"/api/admin/consultations/{cid}/links", seller2)
        step("only an admin gets every link", s == 403, b)
        s, b = call("GET", f"/api/sales/consultations/{cid}/join", seller2)
        step("the salesperson joins their customer's call", s == 200 and b["data"]["url"].startswith("http"), b)
        s, b = call("GET", f"/api/sales/consultations/{cid}/join", seller)
        step("the earlier salesperson cannot", s == 404, b)
        s, b = call("GET", f"/api/sales/patients/{pid}", seller2)
        step("the call is on the salesperson's customer page", s == 200 and any(a["id"] == cid and a["joinable"] for a in b["data"]["consultations"]), b)
        s, b = call("POST", f"/api/admin/consultations/{cid}/cancel", admin, {"reason": "Test: sales and coach journey"})
        step("admin cancels it", s == 200, b)

    # ---------------------------------------------------------------- off the team: signed out at once
    s, b = call("PATCH", f"/api/admin/salespeople/{sid}", admin, {"active": False})
    step("admin takes the first salesperson off the team", s == 200, b)
    s, b = call("GET", "/api/sales/me", seller)
    step("their session ends at once", s == 401, b)
    token, _, _ = sign_in(SELLER)
    s, b = call("GET", "/api/sales/patients", token)
    step("and a new sign-in opens nothing", s == 403, b)

    # ---------------------------------------------------------------- tidy
    call("PATCH", f"/api/admin/plans/{plan['id']}", admin, {"maxDiscountPercent": was})
    call("PATCH", f"/api/admin/salespeople/{sid2}", admin, {"active": False})
    call("DELETE", f"/api/admin/medicine/patients/{pid}/doctors/{doctor_id}", admin)
    print(f"\n{passed} steps passed. Test patient {PATIENT} (id {pid}), salespeople {SELLER} and {SELLER2}, coach {COACH}.")


if __name__ == "__main__":
    main()
