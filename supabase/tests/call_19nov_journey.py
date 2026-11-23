"""What the 19 Nov 2026 client call asked for, against the DEPLOYED API (built 23 Nov 2026).

Usage: OTP=<TEST_OTP> ADMIN=<a test admin's mobile> python3 supabase/tests/call_19nov_journey.py
Signs in a new test patient and a new test coach (98000...), a test admin and the pilot's first test doctor
(9000000001). It pays nothing. It leaves the test patient (on a plan started "outside the app"), the coach and a
cancelled consultation; remove them when the pilot is cleaned.

  the page      the doctor's page for a patient opens from the patient list, with no consultation
  prescription  written with no consultation -> "With food" -> PDF -> sent -> edited (a new version) -> the old
                version is read, never downloaded (doctor, patient) -> the patient's list has one PDF
  coaches       a fitness coach beside the health coach; the coach sees the patient and writes a remark; the
                doctor reads it
  sales form    the coach asked for and a note; then paid outside the app: the plan starts at once
  admin         books a consultation for the patient, moves it, cancels it
  recording     the patient's yes on the Join screen is kept, and taken back
"""
import json, os, sys, time, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

BASE = os.environ.get("BASE", "https://wcsglsrjixfrobujchen.supabase.co/functions/v1").rstrip("/")
OTP = os.environ["OTP"]
ADMIN = os.environ["ADMIN"]
RUN = str(int(time.time()))[-4:]
PATIENT, COACH = f"980007{RUN}", f"980008{RUN}"
IST = timezone(timedelta(hours=5, minutes=30))
passed = 0


def call(method, path, token=None, body=None, raw=False):
    h = {"Accept": "application/json"}
    data = None
    if body is not None:
        data, h["Content-Type"] = json.dumps(body).encode(), "application/json"
    if token:
        h["Authorization"] = f"Bearer {token}"
    try:
        with urllib.request.urlopen(urllib.request.Request(BASE + path, data=data, method=method, headers=h), timeout=120) as r:
            return (r.status, r.headers.get("Content-Type", "")) if raw else (r.status, json.loads(r.read() or b"null"))
    except urllib.error.HTTPError as e:
        return (e.code, "") if raw else (e.code, json.loads(e.read() or b"null"))


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
    return b["data"]["accessToken"], b["data"]["user"]["id"]


def main():
    admin, _ = sign_in(ADMIN)
    doctor, doctor_id = sign_in("9000000001")
    patient, pid = sign_in(PATIENT)
    page = lambda: call("GET", f"/api/doctor/patients/{pid}/page", doctor)
    sheet = lambda: call("GET", f"/api/admin/medicine/patients/{pid}", admin)[1]["data"]
    rx = f"/api/doctor/patients/{pid}/prescription"

    # ---------------------------------------------------------------- the page, with no consultation
    s, b = page()
    step("a doctor who does not treat the patient cannot open their page", s == 404, b)
    s, b = call("PUT", f"/api/admin/medicine/patients/{pid}/doctors/{doctor_id}", admin)
    step("admin puts the doctor on the care team", s == 200, b)
    s, b = page()
    d = b.get("data") or {}
    step("the page opens from the patient list: no consultation, nothing written, a prescription goes to the patient alone",
         s == 200 and d["consultation"] is None and d["prescriptions"] == [] and d["draft"] is None
         and d["write"] == {"kind": "patient", "id": str(pid)} and d["coachRemarks"] == [], d)

    # ---------------------------------------------------------------- a prescription with no consultation
    line = {"key": "a", "medicineId": None, "name": "Test Vitamin D 60000 IU", "dose": "1 capsule", "frequency": "WEEKLY",
            "frequencyOther": "", "durationValue": 4, "durationUnit": "WEEKS", "intake": "WITH_FOOD"}
    s, b = call("PUT", rx, doctor, {"diagnosis": "Obesity", "patientHistory": "", "remarks": "", "advice": "Walk 30 minutes a day", "medicines": [line]})
    step("the draft saves, with 'With food'", s == 200 and b["data"]["status"] == "DRAFT"
         and b["data"]["medicines"][0]["intakeWords"] == "With food", b)
    s, b = call("POST", f"{rx}/pdf", doctor)
    step("a PDF needs the diagnosis and the lines complete (it is made)", s == 200 and b["data"]["pdf"], b)
    # advice only from here: a medicine typed by hand would open a task in the real queue when sent
    s, b = call("PUT", rx, doctor, {"medicines": []})
    step("an edit makes the PDF stale", s == 200 and b["data"]["pdf"] is None, b)
    s, b = call("POST", f"{rx}/send", doctor)
    step("a stale PDF is not sent", s == 409, b)
    s, b = call("POST", f"{rx}/pdf", doctor)
    v1 = b["data"]["id"]
    s, ctype = call("GET", f"/api/files/prescriptions/{v1}", doctor, raw=True)
    step("the doctor sees the PDF before sending", s == 200 and "pdf" in ctype, ctype)
    s, b = call("POST", f"{rx}/send", doctor)
    step("sent to the patient, with no consultation", s == 200 and b["data"]["status"] == "SENT", b)
    d = page()[1]["data"]
    one = d["prescriptions"][0]
    step("the page lists it: current, mine, no consultation, who sent it; the diagnosis is at the top",
         len(d["prescriptions"]) == 1 and one["current"] and one["mine"] and one["appointmentId"] is None and one["pdf"]
         and one["doctorName"] and one["sentAt"] and d["patient"]["diagnosis"] == "Obesity" and d["draft"] is None, d["prescriptions"])

    # ---------------------------------------------------------------- an edit is a new version; the old one is read, never downloaded
    s, b = call("POST", f"{rx}/revise", doctor)
    step("Edit and send new version opens a copy", s == 200 and b["data"]["status"] == "DRAFT" and b["data"]["revising"]
         and b["data"]["diagnosis"] == "Obesity", b)
    call("PUT", rx, doctor, {"advice": "Walk 45 minutes a day"})
    call("POST", f"{rx}/pdf", doctor)
    s, b = call("POST", f"{rx}/send", doctor)
    step("the new version is sent", s == 200, b)
    d = page()[1]["data"]
    new, old = d["prescriptions"]
    step("two versions: the new one current and marked edited, the old one replaced with no PDF",
         new["current"] and new["edited"] and new["pdf"] and not old["current"] and old["pdf"] is None and old["id"] == v1, d["prescriptions"])
    for who, token in (("the doctor", doctor), ("the patient", patient)):
        s, _ = call("GET", f"/api/files/prescriptions/{v1}", token, raw=True)
        step(f"{who} cannot open the replaced prescription as a PDF", s == 409, s)
    s, ctype = call("GET", f"/api/files/prescriptions/{new['id']}", patient, raw=True)
    step("the patient opens the current one", s == 200 and "pdf" in ctype, ctype)
    s, b = call("GET", "/api/care/prescriptions", patient)
    mine = b["data"]["prescriptions"]
    step("the patient's list: one PDF, the replaced one to read only", [bool(x["pdf"]) for x in mine] == [True, False], mine)
    s, b = call("POST", f"{rx}/resend", doctor)
    step("Send again", s == 200 and b["data"]["resentAt"], b)

    # ---------------------------------------------------------------- the coaches and the coach's remarks
    s, b = call("POST", "/api/admin/coaches", admin, {"fullName": f"Test Coach {RUN}", "mobile": COACH})
    step("a coach is added", s == 200, b)
    coach_id = b["data"]["id"]
    coach, _ = sign_in(COACH)
    s, b = call("GET", f"/api/admin/medicine/patients/{pid}", coach)
    step("the coach cannot open a patient who is not theirs", s == 404, b)
    s, b = call("PATCH", f"/api/admin/medicine/patients/{pid}/fitness-coach", admin, {"coachId": coach_id})
    step("admin makes them the fitness coach", s == 200, b)
    s, b = call("POST", f"/api/admin/medicine/patients/{pid}/remarks", coach, {"text": "Walked most days.\nMissed two weekly doses."})
    step("the coach writes a remark", s == 200, b)
    s, b = call("POST", f"/api/admin/medicine/patients/{pid}/remarks", coach, {"text": " "})
    step("an empty remark is refused", s == 400, b)
    d = page()[1]["data"]
    step("the doctor reads it, and sees the fitness coach", d["coachRemarks"][0]["text"].startswith("Walked most days")
         and d["coachRemarks"][0]["by"] == f"Test Coach {RUN}" and d["patient"]["fitnessCoachName"] == f"Test Coach {RUN}", d["coachRemarks"])
    sh = sheet()
    step("admin sees the remark, the fitness coach and both prescriptions with who sent them",
         sh["remarks"][0]["by"] == f"Test Coach {RUN}" and sh["patient"]["fitnessCoach"]["id"] == coach_id
         and [x["current"] for x in sh["prescriptions"]] == [True, False] and sh["prescriptions"][0]["doctorName"], sh["prescriptions"])

    # ---------------------------------------------------------------- the sales form
    s, plans = call("GET", "/api/subscriptions/plans")
    plan = next(p for p in plans["data"] if p.get("IsActive", True) and (p.get("Price") or 0) > 0)
    form = {"planId": str(plan["PlanId"]), "salespersonId": None, "coachPreference": "Hindi, evenings", "note": "Wants a woman coach"}
    s, b = call("PUT", f"/api/admin/medicine/patients/{pid}/plan", admin, form)
    step("the sales form: the plan waits for payment in the app", s == 200 and not b["data"]["started"], b)
    a = sheet()["patient"]["assignedPlan"]
    step("with the coach asked for and the note", a["coachPreference"] == "Hindi, evenings" and a["note"] == "Wants a woman coach", a)
    s, b = call("PUT", f"/api/admin/medicine/patients/{pid}/plan", admin, {**form, "paidOutside": {"amountRupees": 0, "paymentRef": ""}})
    step("paid outside needs the amount and the payment ID", s == 400, b)
    s, b = call("PUT", f"/api/admin/medicine/patients/{pid}/plan", admin, {**form, "paidOutside": {"amountRupees": plan["Price"], "paymentRef": "pay_TEST" + RUN}})
    step("paid outside the app: the plan starts at once", s == 200 and b["data"]["started"], b)
    p = sheet()["patient"]
    step("admin sees the plan, how it was paid and the form", p["plan"] == plan["PlanName"] and p["assignedPlan"] is None
         and p["planSale"]["paid"] == {"where": "OUTSIDE", "ref": "pay_TEST" + RUN, "at": p["planSale"]["startedAt"], "amountRupees": plan["Price"]}
         and p["planSale"]["coachPreference"] == "Hindi, evenings", p)
    s, b = call("GET", "/api/patient/next-step", patient)
    step("the app does not ask the patient to pay for it", s == 200 and b["data"].get("stage") != "PAYMENT_DUE", b["data"])
    d = page()[1]["data"]
    step("the doctor sees the plan as active", d["activePlan"] and d["activePlan"]["planName"] == plan["PlanName"] and d["patient"]["onPlan"], d["activePlan"])
    s, b = call("PUT", f"/api/admin/medicine/patients/{pid}/plan", admin, form)
    step("someone on a plan cannot be put on another", s == 409, b)

    # ---------------------------------------------------------------- admin books, moves and cancels a consultation
    free = []
    for n in range(1, 8):
        day = (datetime.now(IST) + timedelta(days=n)).date().isoformat()
        s, b = call("GET", f"/api/schedule/slots/{doctor_id}/{day}", admin)
        free = [x for x in (b.get("data") or []) if x["Status"] == "Available"] if s == 200 else []
        if len(free) >= 2:
            break
    if len(free) < 2:
        print("SKIP admin's booking and the recording choice (the test doctor has no free times in the next week)")
    else:
        s, b = call("POST", f"/api/admin/medicine/patients/{pid}/consultations", admin, {"slotId": free[0]["SlotId"]})
        step("admin books a consultation for the patient", s == 200, b)
        cid = b["data"]["appointmentId"]
        s, b = call("POST", f"/api/admin/medicine/patients/{pid}/consultations", admin, {"slotId": free[0]["SlotId"]})
        step("a time that is taken is refused", s == 409, b)
        c = next(x for x in sheet()["consultations"] if x["id"] == cid)
        step("it is on the patient's sheet: booked, to come, no recording", c["status"] == "Booked" and c["upcoming"] and c["recording"] == "NOT_AGREED", c)
        d = page()[1]["data"]
        step("the doctor's page shows the consultation to come; a prescription written now still needs no consultation",
             d["consultation"] and d["consultation"]["id"] == cid and d["write"]["kind"] == "patient", d["consultation"])
        s, b = call("GET", f"/api/doctor/consultations/{cid}", doctor)
        step("opened from the consultation, a prescription is written for it", s == 200 and b["data"]["write"] == {"kind": "consultation", "id": cid}
             and len(b["data"]["prescriptions"]) == 2, b["data"].get("write"))
        s, b = call("POST", f"/api/admin/consultations/{cid}/move", admin, {"slotId": free[1]["SlotId"]})
        step("admin moves it", s == 200, b)
        c = next(x for x in sheet()["consultations"] if x["id"] == cid)
        step("to the new time", c["startsAt"][11:16] == free[1]["StartTime"], c)

        # the patient's yes to recording, on their Join screen
        s, b = call("GET", f"/api/video/appointments/{cid}/join?record=1", patient)
        step("the patient joins and agrees to recording", s == 200 and b["data"]["recording"] is True, b)
        c = next(x for x in sheet()["consultations"] if x["id"] == cid)
        step("admin sees the yes, and what came of it", c["recording"] in ("AGREED", "RECORDED", "FAILED"), c)
        print(f"     recording: {c['recording']}" + (f" ({c['recordingProblem']})" if c.get("recordingProblem") else ""))
        s, b = call("GET", f"/api/admin/consultations/{cid}/recording", doctor)
        step("only an admin can ask for a recording", s == 403, b)
        s, b = call("GET", f"/api/video/appointments/{cid}/join?record=0", patient)
        step("the patient takes the yes back", s == 200 and b["data"]["recording"] is False, b)
        c = next(x for x in sheet()["consultations"] if x["id"] == cid)
        step("and it shows as not agreed", c["recording"] == "NOT_AGREED", c)

        s, b = call("POST", f"/api/admin/consultations/{cid}/cancel", admin, {"reason": ""})
        step("a cancel needs its reason", s == 400, b)
        s, b = call("POST", f"/api/admin/consultations/{cid}/cancel", admin, {"reason": "Test: booked by mistake"})
        step("admin cancels it", s == 200, b)
        c = next(x for x in sheet()["consultations"] if x["id"] == cid)
        step("it is cancelled", c["status"] == "Cancelled", c)
        s, b = call("GET", f"/api/schedule/slots/{doctor_id}/{day}", admin)
        step("and its time is free again", any(x["SlotId"] == free[1]["SlotId"] and x["Status"] == "Available" for x in b["data"]), b)

    # ---------------------------------------------------------------- tidy
    call("PATCH", f"/api/admin/medicine/patients/{pid}/fitness-coach", admin, {"coachId": None})
    call("DELETE", f"/api/admin/medicine/patients/{pid}/doctors/{doctor_id}", admin)
    print(f"\n{passed} steps passed. Test patient {PATIENT} (id {pid}), test coach {COACH}.")


if __name__ == "__main__":
    main()
