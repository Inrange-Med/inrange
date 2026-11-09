"""End-to-end pilot journey against the DEPLOYED InRange API (no local server).

Usage: python3 supabase/tests/journey.py [patient_mobile]
Walks: patient sign-in -> onboarding -> eligibility report -> pay + book first consultation ->
doctor sees it -> video links -> chat both ways -> doctor ends the call -> draft note -> sign note
with a medicine in the plan -> sign the prescription -> patient sees prescription and delivery ->
patient buys a plan -> invoices. Prints PASS/FAIL per step; exits 1 on the first failure.
Needs the pilot OTP (123456, SMS mocked). With Razorpay live (test keys) a payment needs the checkout
window, so the journey checks the live order and that an unsigned payment is refused, then stops: pay
in the browser instead (test card 4100 2800 0000 1007).
"""
import json, sys, time, uuid, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

BASE = "https://wcsglsrjixfrobujchen.supabase.co/functions/v1"
PATIENT = sys.argv[1] if len(sys.argv) > 1 else "98000099" + str(int(time.time()) % 100).zfill(2)
IST = timezone(timedelta(hours=5, minutes=30))


def call(method, path, token=None, body=None, raw=None, ctype=None):
    data, headers = None, {"Accept": "application/json"}
    if body is not None:
        data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
    if raw is not None:
        data, headers["Content-Type"] = raw, ctype
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def step(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        sys.exit(1)


def sign_in(mobile):
    s, b = call("POST", "/api/auth/send-otp", body={"mobile": mobile})
    if s == 429:
        time.sleep(31)
        s, b = call("POST", "/api/auth/send-otp", body={"mobile": mobile})
    step(f"send-otp {mobile}", s == 200 and b["data"]["mock"] is True, b)
    s, b = call("POST", "/api/auth/verify-otp", body={"mobile": mobile, "otp": "123456"})
    step(f"verify-otp {mobile}", s == 200 and b["data"]["accessToken"], b)
    return b["data"]["accessToken"], b["data"]


def tiny_pdf():
    return (b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
            b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")


# --- patient: sign in + onboarding -------------------------------------------------------------
pt, info = sign_in(PATIENT)
step("new patient goes to onboarding", info["nextScreen"] == "ONBOARDING", info)
s, b = call("GET", "/api/onboarding/config", pt); step("onboarding config", s == 200 and b["data"]["consents"], b)
version = b["data"]["consentVersion"]
steps = [
    {"step": 1, "fullName": "Pilot Journey", "firstName": "Pilot", "lastName": "Journey", "email": "pilot@example.com"},
    {"step": 2, "gender": "Female"}, {"step": 3, "ageYears": 41}, {"step": 4, "heightCm": 165.1},
    {"step": 5, "weightKg": 82.6}, {"step": 6, "weightLossExperience": ["SELF_DIET"]},
    {"step": 7, "noConditions": False, "conditions": [{"code": "T2D"}]},
    {"step": 8, "consents": [{"type": t, "version": version, "accepted": True}
                             for t in ["TERMS", "PRIVACY", "HEALTH_DATA", "TELECONSULT"]]},
]
for body in steps:
    s, b = call("PATCH", "/api/onboarding/step", pt, {**body, "mobile": PATIENT})
    step(f"onboarding step {body['step']}", s == 200, b)
s, b = call("POST", "/api/onboarding/complete", pt, {"mobile": PATIENT, "fullName": "Pilot Journey", "email": "pilot@example.com",
                                                      "gender": "Female", "ageYears": 41, "heightCm": 165.1, "weightKg": 82.6})
step("onboarding complete (BMI)", s == 200 and b["data"]["bmi"], b)

# --- eligibility by own report -----------------------------------------------------------------
boundary = uuid.uuid4().hex
today = datetime.now(IST).date().isoformat()
form = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"purpose\"\r\n\r\nELIGIBILITY\r\n"
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"reportDate\"\r\n\r\n{today}\r\n"
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"report.pdf\"\r\nContent-Type: application/pdf\r\n\r\n").encode() \
       + tiny_pdf() + f"\r\n--{boundary}--\r\n".encode()
s, b = call("POST", "/api/reports", pt, raw=form, ctype=f"multipart/form-data; boundary={boundary}")
step("upload eligibility report", s in (200, 201), b)
s, b = call("GET", "/api/eligibility", pt); step("eligibility approved (pilot)", b["data"]["stage"] == "APPROVED", b)

# --- pay for and book the first consultation ---------------------------------------------------
slot = None
for d in range(1, 8):
    day = (datetime.now(IST) + timedelta(days=d)).date().isoformat()
    s, b = call("GET", f"/api/schedule/available-slots?date={day}", pt)
    if s == 200 and b["data"]:
        slot = b["data"][0]; break
step("available slots", slot is not None)
s, b = call("POST", "/api/payments/orders", pt, {"purpose": "CONSULTATION_FEE", "referenceId": str(slot["SlotId"]), "reason": "Pilot journey check"})
step("consultation order", s == 200 and b["data"]["amountPaise"] > 0, b)
order = b["data"]["orderId"]
if b["data"]["razorpayKeyId"] != "rzp_mock":
    step("live Razorpay order", b["data"]["razorpayKeyId"].startswith("rzp_") and order.startswith("order_"), b)
    s, b = call("POST", "/api/payments/verify", pt, {"orderId": order, "razorpayPaymentId": "pay_forged", "razorpaySignature": "forged"})
    step("unsigned payment refused", s == 400, b)
    print(f"\nSTOP  Razorpay is live: finish the journey in the browser as {PATIENT} (code 123456).")
    sys.exit(0)
s, b = call("POST", "/api/payments/verify", pt, {"orderId": order, "razorpayPaymentId": "pay_mock_journey", "razorpaySignature": "mock"})
step("payment verified", s == 200 and b["data"]["status"] == "PAID", b)
s, b = call("GET", "/api/appointments/patient", pt)
appts = b["data"] if isinstance(b["data"], list) else b["data"].get("appointments", [])
step("appointment booked", len(appts) == 1, b)
appt_id = appts[0].get("AppointmentId") or appts[0].get("appointmentId") or appts[0].get("id")

# --- doctor side ---------------------------------------------------------------------------------
def has_appt(rows):
    return any(str(r.get("AppointmentId") or r.get("appointmentId") or r.get("id")) == str(appt_id) for r in rows)
dt = None
for mobile in ["9000000001", "9000000002", "9000000003"]:  # open slots merge across doctors: find the owner
    tok, _ = sign_in(mobile)
    s, b = call("GET", "/api/appointments/doctor", tok)
    rows = b["data"] if isinstance(b["data"], list) else b["data"].get("appointments", [])
    if s == 200 and has_appt(rows):
        dt = tok; break
step("doctor sees the appointment", dt is not None)
s, b = call("GET", f"/api/video/appointments/{appt_id}/join", dt); step("doctor video link", s == 200 and b["data"]["role"] == "doctor", b)
s, b = call("GET", f"/api/video/appointments/{appt_id}/join", pt); step("patient video link", s == 200 and b["data"]["role"] == "patient", b)
patient_id = info["user"]["id"]
s, b = call("POST", "/api/chat/init", dt, {"patientId": patient_id}); step("doctor opens chat", s == 200 and b["sessionId"], b)
sid = b["sessionId"]
s, b = call("POST", f"/api/chat/sessions/{sid}/messages", pt, {"messageText": "Hello doctor"}); step("patient sends message", s in (200, 201), b)
s, b = call("GET", f"/api/chat/sessions/{sid}/messages?afterId=0", dt); step("doctor receives it", "Hello doctor" in json.dumps(b), b)
s, b = call("POST", f"/api/video/appointments/{appt_id}/end", dt); step("doctor ends the call", s == 200, b)
s, b = call("GET", "/api/care-team", pt); step("care team set", s == 200 and b["data"]["doctor"], b)

# --- note -> prescription ---------------------------------------------------------------------
s, b = call("GET", "/api/doctor/notes", dt)
notes = b["data"] if isinstance(b["data"], list) else b["data"].get("notes", [])
mine = [n for n in notes if str(n.get("patientId")) == str(patient_id)]
step("draft note created", len(mine) == 1, b)
nid = mine[0]["id"]
s, b = call("GET", f"/api/doctor/notes/{nid}", dt); step("open note", s == 200, b)
note = b["data"]
def sentence(t): return {"id": uuid.uuid4().hex[:8], "text": t, "evidence": [], "by": "doctor", "flag": None}
for sec in note["sections"]:
    if sec["key"] == "summary": sec["current"] = [sentence("Discussed eating pattern and activity.")]
    if sec["key"] == "plan": sec["current"] = [sentence("Start Metformin 500 mg, twice a day after meals.")]
    sec["checked"] = True
# exactly what the note screen's "Add a medicine" sheet appends (noteEdits.addMedicine)
note["medicines"].append({"id": "added-" + uuid.uuid4().hex[:8], "action": "START", "name": "Vitamin D3", "strength": "60000 IU",
                          "detail": "once a week after lunch", "was": None, "evidence": [], "include": True})
change = {k: note[k] for k in ["sections", "medicines", "followUps", "recordUpdates", "checks"]}
s, b = call("PUT", f"/api/doctor/notes/{nid}", dt, {**change, "change": "Wrote the summary and plan"}); step("save note", s == 200, b)
s, b = call("GET", f"/api/doctor/notes/{nid}", dt)
step("plan sentence became a medicine", any("Metformin" in json.dumps(m) for m in b["data"]["medicines"]), b["data"]["medicines"])
s, b = call("POST", f"/api/doctor/notes/{nid}/sign", dt, {"sendToApp": True}); step("sign note", s == 200, b)
s, b = call("GET", f"/api/doctor/patients/{patient_id}/record", dt); step("patient record loads", s == 200, b)
rx = [p for p in b["data"].get("prescriptions", []) if p.get("status") in ("DRAFT", "PENDING", "UNSIGNED") or not p.get("signedAt")]
step("draft prescription waiting", len(rx) >= 1, b["data"].get("prescriptions"))
s, b = call("POST", f"/api/doctor/patients/{patient_id}/prescriptions/{rx[0]['id']}/sign", dt); step("sign prescription", s == 200, b)
s, b = call("GET", "/api/care/prescription/current", pt); step("patient sees prescription + PDF", b["data"] and b["data"]["pdfUrl"], b)
names = json.dumps(b["data"]["items"])
step("prescription has the added and the plan medicine", "Vitamin D3" in names and "Metformin" in names, b["data"]["items"])
s, b = call("GET", "/api/care/medicine-orders", pt); step("patient sees delivery", len(b["data"]) >= 1, b)

# --- plan purchase -------------------------------------------------------------------------------
s, b = call("GET", "/api/subscriptions/plans"); plan = b["data"][0]
s, b = call("POST", "/api/payments/orders", pt, {"purpose": "PLAN", "referenceId": str(plan["PlanId"])}); step("plan order", s == 200, b)
s, b = call("POST", "/api/payments/verify", pt, {"orderId": b["data"]["orderId"], "razorpayPaymentId": "pay_mock_plan", "razorpaySignature": "mock"})
step("plan paid", s == 200 and b["data"]["status"] == "PAID", b)
s, b = call("GET", "/api/patient/profile", pt); step("profile shows plan Active", "active" in json.dumps(b).lower(), b)
s, b = call("GET", "/api/payments", pt); step("two invoices", len(b["data"]) == 2, b)
print(f"\nJOURNEY OK  patient={PATIENT} (user {patient_id}) appointment={appt_id}")
