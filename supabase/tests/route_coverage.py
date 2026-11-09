"""Calls EVERY route the `api` function registers, against the DEPLOYED API, and reports each one.

Usage: python3 supabase/tests/route_coverage.py
PASS = 2xx, or the documented refusal for that route (listed in EXPECTED with the reason).
FAIL = 404 "not available yet", any 5xx, or a route never reached. Exits 1 on any FAIL.
Creates one test patient (mobile 98000 prefix); remove with supabase/tests/cleanup_test_patients.sql.
"""
import json, re, sys, time, uuid, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = "https://wcsglsrjixfrobujchen.supabase.co/functions/v1"
IST = timezone(timedelta(hours=5, minutes=30))
HERE = Path(__file__).resolve().parent
ROUTES_DIR = HERE.parent / "functions" / "api" / "routes"
PATIENT = "98000140" + str(int(time.time()) % 100).zfill(2)

# every registered route, read from the router files
ROUTES = []
for f in ROUTES_DIR.glob("*.ts"):
    for m in re.finditer(r'^\s*(auth|\w+Routes)\.(get|post|put|patch|delete)\("([^"]+)"', f.read_text(), re.M):
        path = ("/api/auth" if m.group(1) == "auth" else "/api") + m.group(3)
        ROUTES.append((m.group(2).upper(), path))
PATTERNS = [(meth, tpl, re.compile("^" + re.sub(r":\w+", r"[^/]+", tpl) + "$")) for meth, tpl in ROUTES]
# literal routes win over parameterised ones (e.g. /doctor/patients/snapshots vs /:patientId)
PATTERNS.sort(key=lambda p: p[1].count(":"))

# routes where a refusal IS the correct answer in this setup
EXPECTED = {
    ("GET", "/api/doctor/patients/:patientId/photos"): (403, "the patient has not shared progress photos"),
    ("POST", "/api/doctor/patients/:patientId/symptoms/:symptomId/acknowledgement"): (None, "no symptom exists; must refuse with a sentence (4xx)"),
    ("DELETE", "/api/doctor/patients/:patientId/symptoms/:symptomId/acknowledgement"): (None, "no symptom exists; must refuse with a sentence (4xx)"),
    ("POST", "/api/webhooks/razorpay"): (400, "unsigned body while RAZORPAY_WEBHOOK_SECRET is unset: rejected"),
    ("POST", "/api/webhooks/redcliffe"): (401, "no x-redcliffe-secret: rejected"),
}
hits = {}


def template_of(method, path):
    path = path.split("?")[0]
    for meth, tpl, rx in PATTERNS:
        if meth == method and rx.match(path):
            return tpl
    return None


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
        with urllib.request.urlopen(req, timeout=40) as r:
            status, out = r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        status, out = e.code, json.loads(e.read() or b"null")
    tpl = template_of(method, path)
    if tpl:
        hits.setdefault((method, tpl), []).append((status, (out or {}).get("message", "") if isinstance(out, dict) else ""))
    return status, (out or {}).get("data") if isinstance(out, dict) else out, out


def sign_in(mobile):
    s, _, _ = call("POST", "/api/auth/send-otp", body={"mobile": mobile})
    if s == 429:
        time.sleep(31); call("POST", "/api/auth/send-otp", body={"mobile": mobile})
    return call("POST", "/api/auth/verify-otp", body={"mobile": mobile, "otp": "123456"})[1]


def day(n):
    return (datetime.now(IST) + timedelta(days=n)).date().isoformat()


def pdf():
    return (b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
            b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")


# ---------------- patient: account, onboarding, profile ----------------
pt_s = sign_in(PATIENT); pt = pt_s["accessToken"]; pid = pt_s["user"]["id"]
call("GET", "/api/auth/me", pt)
cfg = call("GET", "/api/onboarding/config", pt)[1]
call("GET", "/api/onboarding/status", pt)
for b in [{"step": 1, "fullName": "Route Check", "firstName": "Route", "lastName": "Check", "email": "route@example.com"}, {"step": 2, "gender": "Female"},
          {"step": 3, "ageYears": 44}, {"step": 4, "heightCm": 162.4}, {"step": 5, "weightKg": 84.1}, {"step": 6, "weightLossExperience": ["SELF_DIET"]},
          {"step": 7, "noConditions": False, "conditions": [{"code": "T2D"}]},
          {"step": 8, "consents": [{"type": t, "version": cfg["consentVersion"], "accepted": True} for t in ["TERMS", "PRIVACY", "HEALTH_DATA", "TELECONSULT"]]}]:
    call("PATCH", "/api/onboarding/step", pt, {**b, "mobile": PATIENT})
call("POST", "/api/onboarding/complete", pt, {"mobile": PATIENT, "fullName": "Route Check", "email": "route@example.com", "gender": "Female", "ageYears": 44, "heightCm": 162.4, "weightKg": 84.1})
bd = uuid.uuid4().hex
form = (f"--{bd}\r\nContent-Disposition: form-data; name=\"purpose\"\r\n\r\nELIGIBILITY\r\n--{bd}\r\nContent-Disposition: form-data; name=\"reportDate\"\r\n\r\n{day(0)}\r\n"
        f"--{bd}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"r.pdf\"\r\nContent-Type: application/pdf\r\n\r\n").encode() + pdf() + f"\r\n--{bd}--\r\n".encode()
call("POST", "/api/reports", pt, raw=form, ctype=f"multipart/form-data; boundary={bd}")
call("GET", "/api/reports", pt); call("GET", "/api/eligibility", pt)
call("GET", "/api/patient/profile", pt)
call("PATCH", "/api/patient/profile", pt, {"fullName": "Route Check", "email": "route2@example.com"})
call("PATCH", "/api/patient/health-profile", pt, {"height": 162.4, "weight": 84.0, "conditions": ["Type 2 diabetes"]})
call("PATCH", "/api/patient/reminders", pt, {"medicationReminders": True, "appointmentReminders": True, "healthTips": False})
call("PATCH", "/api/patient/privacy", pt, {"consentGiven": True})
call("POST", "/api/patient/support", pt, {"subject": "Route check", "message": "Checking the support route."})
w = call("POST", "/api/trackers/weight", pt, {"weightKg": 83.9})[1]
call("GET", "/api/trackers/weight", pt); call("DELETE", f"/api/trackers/weight/{w['id']}", pt)
call("GET", "/api/subscriptions/plans"); call("GET", "/api/subscriptions/status", pt); call("GET", "/api/subscriptions/recommended", pt)
call("GET", "/api/care-packages", pt)

# ---------------- labs ----------------
pkgs = call("GET", "/api/labs/packages", pt)[1]
call("GET", f"/api/labs/packages/{pkgs[1]['code']}", pt)
place = call("GET", "/api/labs/locations/search?query=Gurugram", pt)[1][0]
loc = call("GET", f"/api/labs/locations/{place['eloc']}", pt)[1] or {}
lat, lng = loc.get("latitude", 28.42), loc.get("longitude", 77.1)
call("GET", f"/api/labs/serviceability?latitude={lat}&longitude={lng}", pt)
call("GET", f"/api/labs/locations/reverse?latitude={lat}&longitude={lng}", pt)
addr = {"addressLine": "House 7, Sector 56", "landmark": "Near the park", "city": "Gurugram", "state": "Haryana", "pincode": "122011", "latitude": lat, "longitude": lng, "label": "Home", "isPrimary": True}
home = call("POST", "/api/address/add", pt, addr)[1]["addressId"]
work = call("POST", "/api/address/add", pt, {**addr, "addressLine": "Office 3, Cyber City", "label": "Work", "isPrimary": False})[1]["addressId"]
call("GET", "/api/address/my-addresses", pt)
call("DELETE", f"/api/address/{work}", pt)

def lab_slots(n):
    s = call("GET", f"/api/labs/slots?date={day(n)}&addressId={home}", pt)[1]
    return s if isinstance(s, list) else [x for v in (s or {}).values() for x in v]
def book_lab(n, i=0):
    sl = lab_slots(n)[i]
    return call("POST", "/api/labs/bookings", pt, {"packageCode": pkgs[1]["code"], "addressId": int(home), "collectionDate": day(n), "slotId": str(sl["slotId"]),
                 "patient": {"name": "Route Check", "age": 44, "gender": "Female", "mobile": PATIENT, "email": "route@example.com"}})[1]
lab = book_lab(1)
o = call("POST", "/api/payments/orders", pt, {"purpose": "LAB_BOOKING", "referenceId": lab["id"]})[1]
call("POST", "/api/payments/verify", pt, {"orderId": o["orderId"], "razorpayPaymentId": "pay_mock_rc_lab", "razorpaySignature": "mock"})
call("GET", "/api/labs/bookings", pt); call("GET", f"/api/labs/bookings/{lab['id']}", pt)
call("POST", f"/api/labs/bookings/{lab['id']}/reschedule", pt, {"collectionDate": day(2), "slotId": str(lab_slots(2)[1]["slotId"])})
call("POST", f"/api/labs/bookings/{lab['id']}/simulate", pt, {"event": "SAMPLE_COLLECTED"})
call("POST", f"/api/labs/bookings/{lab['id']}/simulate", pt, {"event": "REPORT_READY"})
call("GET", f"/api/labs/bookings/{lab['id']}/report", pt)
lab2 = book_lab(3)
call("POST", f"/api/labs/bookings/{lab2['id']}/cancel", pt, {"reason": "Route check"})

# ---------------- first consultation ----------------
slot = next(s for n in range(1, 8) for s in (call("GET", f"/api/schedule/available-slots?date={day(n)}", pt)[1] or [])[:1])
o = call("POST", "/api/payments/orders", pt, {"purpose": "CONSULTATION_FEE", "referenceId": str(slot["SlotId"]), "reason": "Route check"})[1]
call("POST", "/api/payments/verify", pt, {"orderId": o["orderId"], "razorpayPaymentId": "pay_mock_rc", "razorpaySignature": "mock"})
appt = call("GET", "/api/appointments/patient", pt)[1][0]
aid, did = appt["AppointmentId"], appt["DoctorId"]
for n in range(1, 8):
    free = [s for s in (call("GET", f"/api/schedule/slots/{did}/{day(n)}")[1] or []) if s.get("Status") == "Available" and s["SlotId"] != slot["SlotId"]]
    if free:
        call("PATCH", f"/api/appointments/{aid}/reschedule", pt, {"slotId": free[0]["SlotId"]}); break

# ---------------- doctor ----------------
doc = next(s for s in (sign_in(m) for m in ["9000000001", "9000000002", "9000000003"]) if s["user"]["id"] == did)
dt = doc["accessToken"]
call("GET", "/api/doctor/me", dt); call("GET", "/api/appointments/doctor", dt); call("GET", f"/api/appointments/doctor?date={day(1)}", dt)
call("GET", "/api/doctor/patients", dt); call("GET", "/api/doctor/patients/snapshots", dt)
call("GET", "/api/doctor/queue", dt); call("GET", "/api/doctor/work-counts", dt)
rec = call("GET", f"/api/doctor/patients/{pid}/record", dt)[1]
call("GET", f"/api/doctor/patients/{pid}/photos", dt)
call("POST", f"/api/doctor/patients/{pid}/photos/viewed", dt, {})
labs = rec.get("labs") or []
if labs:
    call("POST", f"/api/doctor/patients/{pid}/labs/{labs[0]['id']}/review", dt, {"comment": "Reviewed in the route check."})
call("POST", f"/api/doctor/patients/{pid}/private-notes", dt, {"text": "Route check private note."})
call("POST", f"/api/doctor/patients/{pid}/symptoms/999999/acknowledgement", dt, {})
call("DELETE", f"/api/doctor/patients/{pid}/symptoms/999999/acknowledgement", dt)
plans = call("GET", "/api/subscriptions/plans")[1]
call("POST", f"/api/doctor/patients/{pid}/plan-recommendation", dt, {"planId": plans[1]["PlanId"], "note": "Route check."})
call("GET", "/api/subscriptions/recommended", pt)
call("DELETE", f"/api/doctor/patients/{pid}/plan-recommendation", dt)
call("GET", f"/api/video/appointments/{aid}/join", dt); call("GET", f"/api/video/appointments/{aid}/join", pt)
sid = call("POST", "/api/chat/init", pt, {"doctorId": did})[2]["sessionId"]
call("POST", f"/api/chat/sessions/{sid}/messages", pt, {"messageText": "Route check message"})
call("GET", f"/api/chat/sessions/{sid}/messages?afterId=0", dt)
call("GET", "/api/chat/doctor/sessions", dt); call("POST", f"/api/chat/sessions/{sid}/read", dt)
call("POST", f"/api/chat/sessions/{sid}/no-reply-needed", dt); call("DELETE", f"/api/chat/sessions/{sid}/no-reply-needed", dt)
call("POST", f"/api/video/appointments/{aid}/end", dt)
call("GET", "/api/care-team", pt)
notes = call("GET", "/api/doctor/notes", dt)[1]
note_id = next(n["id"] for n in (notes if isinstance(notes, list) else notes["notes"]) if str(n["patientId"]) == str(pid))
note = call("GET", f"/api/doctor/notes/{note_id}", dt)[1]
sen = lambda t: {"id": uuid.uuid4().hex[:8], "text": t, "evidence": [], "by": "doctor", "flag": None}
for sec in note["sections"]:
    sec["current"] = [sen("Reviewed readings.")] if sec["key"] in ("summary", "plan") else sec["current"]; sec["checked"] = True
note["medicines"].append({"id": "added-rc", "action": "START", "name": "Metformin", "strength": "500 mg", "detail": "twice a day", "was": None, "evidence": [], "include": True})
call("PUT", f"/api/doctor/notes/{note_id}", dt, {**{k: note[k] for k in ["sections", "medicines", "followUps", "recordUpdates", "checks"]}, "change": "Route check"})
call("POST", f"/api/doctor/notes/{note_id}/sign", dt, {"sendToApp": True})
call("POST", f"/api/doctor/notes/{note_id}/addenda", dt, {"text": "Route check addendum."})
rx = [p for p in call("GET", f"/api/doctor/patients/{pid}/record", dt)[1]["prescriptions"] if not p.get("signedAt")]
call("POST", f"/api/doctor/patients/{pid}/prescriptions/{rx[0]['id']}/sign", dt)
call("GET", "/api/care/prescription/current", pt); call("GET", "/api/care/medicine-orders", pt)

# ---------------- plan, follow-up, invoices ----------------
o = call("POST", "/api/payments/orders", pt, {"purpose": "PLAN", "referenceId": str(plans[1]["PlanId"])})[1]
call("POST", "/api/payments/verify", pt, {"orderId": o["orderId"], "razorpayPaymentId": "pay_mock_rc_plan", "razorpaySignature": "mock"})
call("GET", "/api/payments", pt)
fslot = next(s for n in range(1, 10) for s in (call("GET", f"/api/schedule/available-slots?date={day(n)}", pt)[1] or [])[:1])
call("PUT", "/api/schedule/book", pt, {"slotId": fslot["SlotId"], "consultationType": "Virtual", "reason": "Follow-up route check"})

# ---------------- webhooks, sign-out ----------------
call("POST", "/api/webhooks/razorpay", None, {"event": "payment.captured"})
call("POST", "/api/webhooks/redcliffe", None, {"booking_id": "x"})
call("POST", "/api/auth/logout", pt)

# ---------------- report ----------------
fails = 0
for meth, tpl in sorted(set(ROUTES), key=lambda r: (r[1], r[0])):
    got = hits.get((meth, tpl))
    exp = EXPECTED.get((meth, tpl))
    if not got:
        ok, note_txt = False, "NEVER CALLED"
    else:
        codes = [s for s, _ in got]
        bad = [f"{s} {m}" for s, m in got if s >= 500 or (s == 404 and "not available yet" in m.lower())]
        if exp:
            want = exp[0]
            ok = not bad and all((s == want) if want else (400 <= s < 500 and s != 404 or "not" in m.lower()) for s, m in got)
            note_txt = f"{codes} expected: {exp[1]}"
        else:
            ok = not bad and any(200 <= s < 300 for s in codes)
            note_txt = f"{codes}" + (f"  {got[-1][1][:90]}" if not ok else "")
    fails += not ok
    print(f"{'PASS' if ok else 'FAIL'} {meth:6} {tpl:62} {note_txt}")
print(f"\n{len(set(ROUTES)) - fails}/{len(set(ROUTES))} routes OK   (patient {PATIENT})")
sys.exit(1 if fails else 0)
