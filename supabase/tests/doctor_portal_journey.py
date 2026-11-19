"""Doctor portal v2, end to end (docs/backend/doctor-portal-v2.md): the consultation, the prescription and the
patient's one next step, against a local API (supabase/tests/local/README.md) or the deployed pilot with BASE set.
Same environment as medicine_flow_journey.py (BASE, PSQL_URL, OTP, JOBS_SECRET). Writes only test users
(mobile 98000...) and one test item on the master list (sku TEST-...); clean up with cleanup_test_patients.sql.

Walks:
  patient  no blood test yet -> approved -> a consultation booked for now: the call is open on both sides
  doctor   Today shows it under "Do this now" -> the consultation page (vitals filled in, weight change, reports)
           -> the master list (forgiving search, "Did you mean") -> autosave with a listed and a hand-typed medicine
           -> Create PDF needs a diagnosis -> the PDF (the doctor sees it, the patient does not yet) -> an edit
           makes it stale -> made again -> Send (WhatsApp, the cart, the match task) -> Send again -> Edit and send
           new version (the first one superseded) -> History finds it -> the hour-later reminder is dropped
  admin    matches the hand-typed medicine to the list: the line joins the order, the task closes
  patient  the new version carries a plan: one bill (the plan and the medicines) at once -> the prescriptions list
           and the PDF -> one payment -> the plan active, medicines on the way
"""
import os, sys, time, uuid
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from medicine_flow_journey import call, step, sql, one, sign_in, tick, JOBS, RUN  # noqa: E402

PATIENT, ADMIN = (f"98000{n}{RUN}" for n in "56")


def file_status(path, token):
    """A file route answers a PDF, not JSON: only its status (and that it is a PDF) matters here."""
    import urllib.request, urllib.error
    from medicine_flow_journey import BASE
    req = urllib.request.Request(BASE + path, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status if r.read(5) == b"%PDF-" else -1
    except urllib.error.HTTPError as e:
        return e.code


def main():
    s, b = call("GET", "/api/health")
    step("API up, WhatsApp in mock mode", s == 200 and b["data"]["integrations"].get("whatsapp") == "mock", b)
    # the deployed pilot: Razorpay runs on real test keys (a made-up payment cannot verify; pay in the browser with
    # the test card) and the tick needs JOBS_SECRET; those steps are skipped there, and said so
    live_pay = b["data"]["integrations"].get("razorpay") == "live"

    patient, pid = sign_in(PATIENT)
    _, admin_id = sign_in(ADMIN)
    sql(f"update users set role = 'ADMIN', full_name = 'Test Admin' where id = {admin_id} and mobile like '98000%'")
    admin, _ = sign_in(ADMIN)
    doctor, doc_id = sign_in("9000000001")
    sql(f"""update users set full_name = 'Riya Test', onboarding_completed = true where id = {pid} and mobile like '98000%';
            insert into patient_profiles (user_id, first_name, last_name, gender, age_years, height_cm, weight_kg)
              values ({pid}, 'Riya', 'Test', 'Female', 34, 162, 84) on conflict (user_id) do nothing;
            insert into weight_logs (user_id, weight_kg, logged_at, source) values
              ({pid}, 84, now() - interval '35 days', 'APP'), ({pid}, 82.6, now() - interval '1 day', 'APP');
            insert into patient_clinical (patient_id, allergies) values ({pid}, 'None known') on conflict (patient_id) do nothing;
            insert into addresses (user_id, label, full_name, line1, city, state, pincode, is_default)
              values ({pid}, 'Home', 'Riya Test', '14 Test Lane', 'Gurugram', 'Haryana', '122001', true);
            insert into reports (user_id, source, title, file_path, file_name, mime_type)
              values ({pid}, 'LAB', 'Blood test, 82 markers', '{pid}/test-report.pdf', 'report.pdf', 'application/pdf');""")

    s, b = call("PUT", "/api/doctor/whatsapp", doctor, {"on": True})
    step("doctor: WhatsApp alerts on", s == 200, b)
    s, b = call("PATCH", "/api/patient/reminders", patient, {"remindersEnabled": True, "whatsappReminders": True, "emailReminders": False})
    step("patient: WhatsApp on", s == 200, b)

    # ---------------------------------------------------------------- the patient before the call
    s, b = call("GET", "/api/patient/next-step", patient)
    step("patient: no blood test yet", s == 200 and b["data"]["stage"] == "BLOOD_TEST_NEEDED", b)
    sql(f"insert into eligibility (user_id, path, stage) values ({pid}, 'LAB_TEST', 'APPROVED') on conflict (user_id) do update set stage = 'APPROVED'")
    s, b = call("GET", "/api/patient/next-step", patient)
    step("patient: approved, book the consultation", b["data"]["stage"] == "BOOK_CONSULTATION", b)
    # a consultation starting in five minutes (as the booking team or the patient would book it)
    appt = one(f"""with slot as (
        insert into doctor_slots (doctor_id, slot_date, start_time, end_time, status)
        select {doc_id}, (now() at time zone 'Asia/Kolkata')::date + d, t, t + interval '30 minutes', 'Booked'
        from (select ((now() at time zone 'Asia/Kolkata') + interval '5 minutes')::time(0) as t,
                     (((now() at time zone 'Asia/Kolkata') + interval '5 minutes')::date - (now() at time zone 'Asia/Kolkata')::date) as d) x
        on conflict (doctor_id, slot_date, start_time) do update set status = 'Booked' returning id)
      insert into appointments (patient_id, doctor_id, slot_id, status, visit_type, reason)
      select {pid}, {doc_id}, id, 'Booked', 'FIRST', 'Weight and sugar' from slot returning id""")
    s, b = call("GET", "/api/patient/next-step", patient)
    step("patient: the call is open (Join from 10 minutes before)", b["data"]["stage"] == "CALL_OPEN" and b["data"]["appointment"]["id"] == appt, b)

    # ---------------------------------------------------------------- the doctor's Today and the page
    s, b = call("GET", "/api/doctor/consultations", doctor)
    mine = [r for r in b["data"]["day"] if r["id"] == appt]
    step("doctor: today's list has it, call open", s == 200 and mine and mine[0]["state"] == "CALL_OPEN", b)
    step("doctor: an open call leads Do this now", b["data"]["waiting"][0]["state"] == "CALL_OPEN", b["data"]["waiting"][:2])
    step("doctor: no phone number in the rows", "mobile" not in str(b).lower() and PATIENT not in str(b))
    s, page = call("GET", f"/api/doctor/consultations/{appt}", doctor)
    d = page["data"]
    step("doctor: the page fills in age, sex, height, weight, BMI and allergies",
         s == 200 and d["patient"]["age"] == 34 and d["patient"]["heightCm"] == 162 and d["patient"]["weightKg"] == 82.6
         and d["patient"]["bmi"] == 31.5 and d["patient"]["allergies"] == "None known", d["patient"])
    step("doctor: weight change over the last month", d["patient"]["monthChangeKg"] == -1.4, d["patient"])
    step("doctor: the reports are on the page", len(d["reports"]) == 1 and d["reports"][0]["file"].startswith("/api/files/reports/"), d["reports"])
    step("doctor: nothing written yet", d["prescription"] is None and d["lastPrescription"] is None, d)
    s, b = call("GET", f"/api/doctor/consultations/{appt}", patient)
    step("a patient cannot open the doctor's page", s in (401, 403), b)

    # ---------------------------------------------------------------- the master list
    s, b = call("GET", "/api/medicines/search?q=MOUNJARO%202.5", doctor)
    step("search: case and spaces do not matter", s == 200 and b["data"]["matches"][0]["name"] == "Mounjaro KwikPen 2.5 mg", b)
    mounjaro = b["data"]["matches"][0]
    step("search: a listed pen comes with its dose and is orderable", mounjaro["dose"] == "1 injection" and mounjaro["orderable"], mounjaro)
    s, b = call("GET", "/api/medicines/search?q=monjaro", doctor)
    step("search: did you mean", not b["data"]["matches"] and b["data"]["didYouMean"][0]["brand"] == "Mounjaro KwikPen", b)

    # ---------------------------------------------------------------- writing
    lines = [
        {"key": "a", "medicineId": mounjaro["id"], "name": mounjaro["name"], "dose": "1 injection", "frequency": "WEEKLY",
         "durationValue": 1, "durationUnit": "MONTHS", "intake": ""},
        {"key": "b", "medicineId": None, "name": f"Glycomet Test{RUN} 500 mg", "dose": "1 tablet", "frequency": "1-0-1",
         "durationValue": 30, "durationUnit": "DAYS", "intake": "AFTER_FOOD"},
    ]
    s, b = call("PUT", f"/api/doctor/consultations/{appt}/prescription", doctor, {"medicines": lines, "patientHistory": "Weight gain since 2020."})
    step("autosave: the draft is created", s == 200 and b["data"]["status"] == "DRAFT" and b["data"]["savedAt"], b)
    step("autosave: a hand-typed medicine is marked", [m["unlisted"] for m in b["data"]["medicines"]] == [False, True], b["data"]["medicines"])
    step("autosave: tap choices become words", b["data"]["medicines"][1]["frequencyWords"].startswith("Twice a day")
         and b["data"]["medicines"][1]["intakeWords"] == "After food", b["data"]["medicines"][1])
    s, b = call("POST", f"/api/doctor/consultations/{appt}/prescription/pdf", doctor)
    step("Create PDF asks for the diagnosis first", s == 422 and "diagnosis" in b.get("message", "").lower(), b)
    s, b = call("PUT", f"/api/doctor/consultations/{appt}/prescription", doctor, {"diagnosis": "Obesity, class 1. Prediabetes.", "advice": "Walk 30 minutes a day."})
    step("autosave: diagnosis and advice", s == 200 and b["data"]["diagnosis"].startswith("Obesity") and b["data"]["medicines"][0]["name"], b)
    s, b = call("POST", f"/api/doctor/consultations/{appt}/prescription/pdf", doctor)
    step("Create PDF", s == 200 and b["data"]["pdf"] and b["data"]["pdfMadeAt"], b)
    rx = b["data"]["id"]
    s = file_status(f"/api/files/prescriptions/{rx}", doctor)
    step("the doctor sees the PDF on the page", s == 200)
    s = file_status(f"/api/files/prescriptions/{rx}", patient)
    step("the patient does not see it before it is sent", s == 404)

    s, b = call("POST", f"/api/video/appointments/{appt}/end", doctor)
    step("the call ends", s == 200, b)
    s, b = call("GET", "/api/doctor/consultations", doctor)
    row = next(r for r in b["data"]["waiting"] if r["id"] == appt)
    step("Do this now: not sent to patient yet", row["state"] == "TO_SEND", row)

    s, b = call("PUT", f"/api/doctor/consultations/{appt}/prescription", doctor, {"remarks": "Review sugar next month."})
    step("an edit after the PDF takes it away", b["data"]["pdf"] is None and b["data"]["pdfMadeAt"] is None, b)
    s, b = call("POST", f"/api/doctor/consultations/{appt}/prescription/send", doctor)
    step("Send refuses a stale PDF", s == 409, b)
    s, b = call("GET", "/api/doctor/consultations", doctor)
    step("Do this now: back to write prescription", next(r for r in b["data"]["waiting"] if r["id"] == appt)["state"] == "TO_WRITE")
    s, b = call("POST", f"/api/doctor/consultations/{appt}/prescription/pdf", doctor)
    step("the PDF is made again after an edit (a new file; storage never overwrites)", s == 200 and b["data"]["pdf"], b)
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(2) as pool:
        both = list(pool.map(lambda _: call("POST", f"/api/doctor/consultations/{appt}/prescription/send", doctor), range(2)))
    codes = sorted(r[0] for r in both)
    step("two presses of Send at once: one sends, the other is told it was sent", codes == [200, 409], codes)
    s, b = next(r for r in both if r[0] == 200)
    step("Send to patient", b["data"]["status"] == "SENT" and b["data"]["sentAt"], b)
    m = sql(f"select kind, status from patient_messages where patient_id = {pid} and kind = 'RX_READY'")
    step("the patient got it on WhatsApp", m == [["RX_READY", "SENT"]], m)
    k = sql(f"select lines, available_at <= now() from medicine_carts where patient_id = {pid} and status = 'OPEN'")
    step("the cart holds only the listed pen, open at once (first consultation, no plan)",
         len(k) == 1 and f'"medicineId": {mounjaro["id"]}' in k[0][0] and k[0][0].count("medicineId") == 1 and k[0][1] == "t", k)
    t = sql(f"select id, status, priority from ops_tasks where patient_id = {pid} and kind = 'MATCH_MEDICINE'")
    step("admin is asked to match the hand-typed medicine", t and t[0][1] == "OPEN" and t[0][2] == "HIGH", t)
    s, b = call("GET", "/api/doctor/consultations", doctor)
    step("sent: off Do this now, SENT in the day", all(r["id"] != appt for r in b["data"]["waiting"])
         and next(r for r in b["data"]["day"] if r["id"] == appt)["state"] == "SENT", b)

    s, b = call("POST", f"/api/doctor/consultations/{appt}/prescription/resend", doctor)
    step("Send again", s == 200 and b["data"]["resentAt"] and one(f"select count(*) from patient_messages where patient_id = {pid} and kind = 'RX_READY'") == "2", b)

    # ---------------------------------------------------------------- a new version
    s, b = call("POST", f"/api/doctor/consultations/{appt}/prescription/revise", doctor)
    step("Edit and send new version opens a copy", s == 200 and b["data"]["status"] == "DRAFT" and b["data"]["version"] == 2
         and b["data"]["diagnosis"].startswith("Obesity") and len(b["data"]["medicines"]) == 2, b)
    lines[0]["durationValue"] = 3
    call("PUT", f"/api/doctor/consultations/{appt}/prescription", doctor, {"medicines": lines})
    s, b = call("POST", f"/api/doctor/consultations/{appt}/prescription/pdf", doctor)
    step("no plan: a line longer than a month is refused, in words", s == 422 and "one month" in b.get("message", ""), b)
    lines[0]["durationValue"] = 1
    # the plan goes in the prescription, so the patient buys it with the medicines in one payment
    plan_id = one("select id from plans where active and price_rupees > 0 order by duration_months limit 1")
    s, b = call("PUT", f"/api/doctor/consultations/{appt}/prescription", doctor,
                {"medicines": lines, "remarks": "Review sugar in a month.", "planId": plan_id})
    step("the plan is part of the prescription", s == 200 and b["data"]["planId"] == plan_id, b)
    s, b = call("GET", "/api/doctor/consultations", doctor)
    row = next(r for r in b["data"]["waiting"] if r["id"] == appt)
    step("Do this now: the new version to write", row["state"] == "TO_WRITE" and row["revising"], row)
    call("POST", f"/api/doctor/consultations/{appt}/prescription/pdf", doctor)
    s, b = call("POST", f"/api/doctor/consultations/{appt}/prescription/send", doctor)
    step("the new version is sent", s == 200 and b["data"]["version"] == 2, b)
    v = sql(f"select version, status from prescriptions where patient_id = {pid} order by version")
    step("the first version is superseded", v == [["1", "SUPERSEDED"], ["2", "SIGNED"]], v)
    step("one open cart, for the new version", one(f"select count(*) from medicine_carts where patient_id = {pid} and status = 'OPEN'") == "1")
    m = sql(f"select status from ops_tasks where patient_id = {pid} and kind = 'MATCH_MEDICINE' order by id")
    step("the replaced version's match task closes; the new version has its own", m == [["DONE"], ["OPEN"]], m)

    s, b = call("GET", "/api/doctor/consultations/history?q=riya", doctor)
    step("History finds it by name", s == 200 and any(r["id"] == appt and r["state"] == "SENT" for r in b["data"]["consultations"]), b)
    # the hour-later reminder to finish the prescription is dropped once it is sent
    if JOBS:
        sql(f"update patient_messages set send_after = now() - interval '1 minute' where kind = 'DR_NOTE_TO_SIGN' and appointment_id = {appt}")
        tick()
        r = sql(f"select status, coalesce(skip_reason, '') from patient_messages where kind = 'DR_NOTE_TO_SIGN' and appointment_id = {appt}")
        step("the doctor's reminder is skipped: sent already", r and r[0][0] == "SKIPPED" and "Sent" in r[0][1], r)
    else:
        print("SKIP the doctor's reminder (no JOBS_SECRET, so no tick)")

    # ---------------------------------------------------------------- admin matches the hand-typed medicine
    task_id = one(f"select id from ops_tasks where patient_id = {pid} and kind = 'MATCH_MEDICINE' and status = 'OPEN' order by id desc limit 1")
    s, b = call("GET", f"/api/admin/medicine/tasks/{task_id}/unmatched", admin)
    step("admin: the line to match", s == 200 and len(b["data"]["lines"]) == 1 and b["data"]["lines"][0]["name"].startswith("Glycomet"), b)
    line = b["data"]["lines"][0]["index"]
    med = one(f"""insert into medicines (brand, molecule, form, strength, pack, pack_days, route, mrp_paise, sku, default_dose)
                  values ('Glycomet Test{RUN}', 'Metformin', 'Tablet', '500 mg', 'strip of 60 tablets', 30, 'By mouth', 9000, 'TEST-{RUN}', '1 tablet')
                  returning id""")
    s, b = call("POST", f"/api/admin/medicine/tasks/{task_id}/match", admin, {"line": line, "medicineId": med})
    step("admin: matched, the task closes", s == 200 and b["data"]["left"] == 0
         and one(f"select status from ops_tasks where id = {task_id}") == "DONE", b)
    step("the matched medicine joins the order", f'"medicineId": {med}' in one(f"select lines::text from medicine_carts where patient_id = {pid} and status = 'OPEN'"))

    # ---------------------------------------------------------------- the patient after the call
    s, b = call("GET", "/api/patient/next-step", patient)
    bill = b["data"].get("bill", {})
    step("patient: one bill at once, the plan and the medicines together", b["data"]["stage"] == "PAYMENT_DUE"
         and b["data"]["payFor"] == "MEDICINES" and b["data"].get("withPlan") and [l["key"] for l in bill.get("lines", [])][:1] == ["plan"]
         and len(bill["lines"]) == 3 and bill["totalPaise"] == sum(l["amountPaise"] for l in bill["lines"]), b)
    cart_ref = b["data"]["referenceId"]
    s, b = call("GET", "/api/care/prescriptions", patient)
    ps = b["data"]["prescriptions"]
    step("patient: both versions listed, the current first", s == 200 and [p["version"] for p in ps] == [2, 1] and ps[0]["current"] and not ps[1]["current"], ps)
    s = file_status(f"/api/files/prescriptions/{ps[0]['id']}", patient)
    step("patient: the PDF opens", s == 200)
    s, o = call("POST", "/api/payments/orders", patient, {"purpose": "MEDICINE_ORDER", "referenceId": cart_ref})
    step("patient: one payment for the bill's total, the plan in it", s == 200 and o["data"]["amountPaise"] == bill["totalPaise"]
         and o["data"]["lineItems"][0]["label"] == bill["lines"][0]["label"], o)
    if live_pay:
        print("SKIP paying, and a new version after paying (Razorpay is live here: pay in the browser)")
        newest = ps[0]["id"]
    else:
        s, v = call("POST", "/api/payments/verify", patient, {"orderId": o["data"].get("orderId") or o["data"]["id"], "razorpayPaymentId": "pay_mock_" + uuid.uuid4().hex[:10]})
        step("patient: paid (mock)", s == 200, v)
        step("the one payment started the plan", one(f"select count(*) from subscriptions where user_id = {pid} and status = 'Active'") == "1")
        s, b = call("GET", "/api/patient/next-step", patient)
        step("patient: medicines on the way", b["data"]["stage"] == "ON_THE_WAY", b)

        # ---------------------------------------------------------------- a new version after paying
        call("POST", f"/api/doctor/consultations/{appt}/prescription/revise", doctor)
        call("PUT", f"/api/doctor/consultations/{appt}/prescription", doctor, {"advice": "Walk 40 minutes a day."})
        call("POST", f"/api/doctor/consultations/{appt}/prescription/pdf", doctor)
        s, b = call("POST", f"/api/doctor/consultations/{appt}/prescription/send", doctor)
        step("a new version after paying is sent", s == 200, b)
        newest = b["data"]["id"]
        step("nothing to pay again for what was bought", one(f"select count(*) from medicine_carts where patient_id = {pid} and status = 'OPEN'") == "0")
        step("the paid order follows the new version (refills keep working)",
             one(f"select count(*) from medicine_orders where patient_id = {pid} and prescription_id = {newest}") == "1")
        s, b = call("GET", "/api/patient/next-step", patient)
        step("patient: still medicines on the way", b["data"]["stage"] == "ON_THE_WAY", b)

    # ---------------------------------------------------------------- an abandoned new version, and when one may go
    call("POST", f"/api/doctor/consultations/{appt}/prescription/revise", doctor)
    s, b = call("GET", "/api/doctor/consultations", doctor)
    step("a new version waits on the doctor", any(r["id"] == appt and r["revising"] for r in b["data"]["waiting"]), b["data"]["waiting"])
    s, b = call("POST", f"/api/doctor/consultations/{appt}/prescription/discard", doctor)
    step("Keep the version already sent: the new one goes", s == 200 and b["data"]["status"] == "SENT" and b["data"]["id"] == newest, b)
    s, b = call("GET", "/api/doctor/consultations", doctor)
    step("kept: off Do this now", all(r["id"] != appt for r in b["data"]["waiting"]), b["data"]["waiting"])
    s, b = call("GET", f"/api/doctor/consultations/{appt}", doctor)
    step("the page knows the call ended", b["data"]["consultation"]["callOpen"] is False, b["data"]["consultation"])

    def booked(day, at):
        return one(f"""with slot as (
            insert into doctor_slots (doctor_id, slot_date, start_time, end_time, status)
            values ({doc_id}, {day}, '{at}'::time, '{at}'::time + interval '30 minutes', 'Booked')
            on conflict (doctor_id, slot_date, start_time) do update set status = 'Booked' returning id)
          insert into appointments (patient_id, doctor_id, slot_id, status, visit_type, reason)
          select {pid}, {doc_id}, id, 'Booked', 'FOLLOW_UP', 'Review' from slot returning id""")
    early = f"06:{int(RUN) % 60:02d}"  # outside working hours: never a real patient's slot, which cleanup would free
    later = booked("(now() at time zone 'Asia/Kolkata')::date + 2", early)
    call("PUT", f"/api/doctor/consultations/{later}/prescription", doctor, {"diagnosis": "Written ahead."})
    s, b = call("POST", f"/api/doctor/consultations/{later}/prescription/pdf", doctor)
    step("written ahead: no PDF before the call opens", s == 409 and "call opens" in b.get("message", ""), b)
    older = booked("(now() at time zone 'Asia/Kolkata')::date - 3", early)
    call("PUT", f"/api/doctor/consultations/{older}/prescription", doctor, {"diagnosis": "Left unsent."})
    s, b = call("POST", f"/api/doctor/consultations/{older}/prescription/pdf", doctor)
    step("an older consultation's PDF can still be made", s == 200, b)
    s, b = call("GET", "/api/doctor/consultations", doctor)
    step("one a later consultation replaced is off Do this now", all(r["id"] != older for r in b["data"]["waiting"]), b["data"]["waiting"])
    s, b = call("POST", f"/api/doctor/consultations/{older}/prescription/send", doctor)
    step("it cannot replace the newer prescription", s == 409 and "newer prescription" in b.get("message", ""), b)

    print(f"\nALL {__import__('medicine_flow_journey').passed} CHECKS PASSED")


if __name__ == "__main__":
    t0 = time.time()
    main()
    print(f"({time.time() - t0:.0f}s)")
