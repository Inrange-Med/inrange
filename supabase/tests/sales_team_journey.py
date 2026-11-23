"""The sales team, the patient's doctors and the plan on show (23 Nov 2026), against the DEPLOYED API.

Usage: OTP=<TEST_OTP> ADMIN=<a test admin's mobile> python3 supabase/tests/sales_team_journey.py
Signs in a new test patient (98000...), a test admin and the pilot's first test doctor (9000000001). It books
nothing and pays nothing. It leaves the test patient and two salespeople ("Test Seller ...", off the team); remove
them by hand when the pilot is cleaned.

  sales team  add two, ranked in the order added; move the second to number 1; rename; a name twice is refused;
              off the team: no rank, and cannot be given a patient
  patient     the salesperson from the list; the plan with who sold it; the doctor's chart shows both
  doctors     no doctor yet -> admin adds two -> the first is the main one -> the doctor sees the patient in their
              list and opens the chart -> one removed: that doctor no longer has the patient
"""
import json, os, sys, time, urllib.request, urllib.error

BASE = os.environ.get("BASE", "https://wcsglsrjixfrobujchen.supabase.co/functions/v1").rstrip("/")
OTP = os.environ["OTP"]
ADMIN = os.environ["ADMIN"]
RUN = str(int(time.time()))[-5:]
PATIENT = f"980009{RUN[-4:]}"
passed = 0


def call(method, path, token=None, body=None):
    h = {"Accept": "application/json"}
    data = None
    if body is not None:
        data, h["Content-Type"] = json.dumps(body).encode(), "application/json"
    if token:
        h["Authorization"] = f"Bearer {token}"
    try:
        with urllib.request.urlopen(urllib.request.Request(BASE + path, data=data, method=method, headers=h), timeout=90) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def step(name, cond, detail=""):
    global passed
    print(("PASS " if cond else "FAIL ") + name + (f"  [{json.dumps(detail, default=str)[:700]}]" if not cond else ""))
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
    _, pid = sign_in(PATIENT)
    team = lambda: {p["fullName"]: p for p in call("GET", "/api/admin/salespeople", admin)[1]["data"]}
    a, b_ = f"Test Seller A{RUN}", f"Test Seller B{RUN}"

    # ---------------------------------------------------------------- the sales team
    s, b = call("POST", "/api/admin/salespeople", admin, {"fullName": a, "mobile": f"980000{RUN[-4:]}"})
    step("a salesperson is added", s == 200, b)
    s, b = call("POST", "/api/admin/salespeople", admin, {"fullName": b_})
    step("a second, without a mobile", s == 200, b)
    t = team()
    step("ranked in the order added, the new ones last", t[a]["rank"] + 1 == t[b_]["rank"] == max(p["rank"] or 0 for p in t.values()), t)
    s, b = call("POST", "/api/admin/salespeople", admin, {"fullName": a.upper()})
    step("the same name twice is refused", s == 409, b)
    s, b = call("POST", "/api/admin/salespeople", admin, {"fullName": "X", "mobile": "123"})
    step("a bad name or number is refused", s == 400, b)
    s, b = call("PATCH", f"/api/admin/salespeople/{t[b_]['id']}", admin, {"rank": 1})
    t = team()
    ranks = sorted(p["rank"] for p in t.values() if p["active"])
    step("moved to number 1; the ranks stay 1, 2, 3 ...", s == 200 and t[b_]["rank"] == 1 and ranks == list(range(1, len(ranks) + 1)), t)
    s, b = call("PATCH", f"/api/admin/salespeople/{t[a]['id']}", admin, {"rank": 999})
    step("a rank past the end is the last place", s == 200 and team()[a]["rank"] == len(ranks), b)
    s, b = call("GET", "/api/admin/salespeople", doctor)
    step("only an admin sees the sales team", s == 403, b)

    # ---------------------------------------------------------------- the patient's salesperson and plan
    s, b = call("PATCH", f"/api/admin/medicine/patients/{pid}/salesperson", admin, {"salespersonId": t[a]["id"]})
    step("the patient gets a salesperson from the list", s == 200 and b["data"]["salesperson"] == a, b)
    a2 = a + " R"
    s, b = call("PATCH", f"/api/admin/salespeople/{t[a]['id']}", admin, {"fullName": a2, "mobile": ""})
    t = team()
    step("renamed, the number cleared, one patient counted", s == 200 and t[a2]["mobile"] is None and t[a2]["patients"] == 1, t.get(a2))
    s, b = call("GET", f"/api/admin/medicine/patients/{pid}", admin)
    pa = b["data"]["patient"]
    step("the patient's page follows the new name", pa["salesperson"] == a2 and pa["salespersonId"] == t[a2]["id"] and pa["doctors"] == [], pa)
    s, plans = call("GET", "/api/subscriptions/plans", admin)
    plan = next((p for p in (plans.get("data") or []) if p.get("IsActive", True) and (p.get("Price") or 0) > 0), None) if s == 200 else None
    if plan:
        plan_id = str(plan["PlanId"])
        s, b = call("PUT", f"/api/admin/medicine/patients/{pid}/plan", admin, {"planId": plan_id, "salespersonId": t[b_]["id"]})
        step("put on a plan, sold by the other salesperson", s == 200, b)
        s, b = call("GET", f"/api/admin/medicine/patients/{pid}", admin)
        pa = b["data"]["patient"]
        step("the plan waits for payment with who sold it; the seller is now their salesperson",
             pa["assignedPlan"]["salespersonId"] == t[b_]["id"] and pa["salesperson"] == b_, pa)
        step("the seller has a plan waiting for payment", team()[b_]["plansWaiting"] == 1, team()[b_])
    else:
        print("SKIP the plan (the plans list did not load)", s)
    s, b = call("PATCH", f"/api/admin/salespeople/{t[a2]['id']}", admin, {"active": False})
    step("off the team: no rank", s == 200 and team()[a2]["rank"] is None and not team()[a2]["active"], b)
    s, b = call("PATCH", f"/api/admin/medicine/patients/{pid}/salesperson", admin, {"salespersonId": t[a2]["id"]})
    step("someone off the team cannot be given a patient", s == 400, b)

    # ---------------------------------------------------------------- the patient's doctors
    mine = lambda: [str(p["id"]) for p in call("GET", "/api/doctor/patients", doctor)[1]["data"]]
    step("the doctor does not have the patient yet", str(pid) not in mine())
    s, b = call("GET", f"/api/doctor/patients/{pid}/record", doctor)
    step("and cannot open their chart", s in (403, 404), b)
    s, docs = call("GET", "/api/admin/doctors", admin)
    other = next(d["id"] for d in docs["data"] if d["active"] and d["id"] != doctor_id)
    s, b = call("PUT", f"/api/admin/medicine/patients/{pid}/doctors/{other}", admin)
    step("admin adds a doctor", s == 200, b)
    s, b = call("PUT", f"/api/admin/medicine/patients/{pid}/doctors/{doctor_id}", admin)
    s2, b2 = call("PUT", f"/api/admin/medicine/patients/{pid}/doctors/{doctor_id}", admin)
    step("and a second (adding twice changes nothing)", s == 200 and s2 == 200, b2)
    s, b = call("GET", f"/api/admin/medicine/patients/{pid}", admin)
    step("both are on the care team, the first added first", [d["id"] for d in b["data"]["patient"]["doctors"]] == [str(other), str(doctor_id)], b["data"]["patient"]["doctors"])
    step("the doctor now has the patient in their list", str(pid) in mine())
    s, b = call("GET", f"/api/doctor/patients/{pid}/record", doctor)
    r = b["data"]
    step("the chart shows the doctors, the salesperson and the plan", s == 200 and len(r["doctors"]) == 2
         and (not plan or (r["planRecommendation"] and r["salesperson"] == b_)), {k: r.get(k) for k in ("doctors", "salesperson", "planRecommendation")})
    s, b = call("DELETE", f"/api/admin/medicine/patients/{pid}/doctors/{doctor_id}", admin)
    step("admin removes a doctor", s == 200, b)
    s, b = call("DELETE", f"/api/admin/medicine/patients/{pid}/doctors/{doctor_id}", admin)
    step("removing someone not on the team is refused", s == 404, b)
    step("that doctor no longer has the patient", str(pid) not in mine())
    s, b = call("PUT", f"/api/admin/medicine/patients/{pid}/doctors/999999", admin)
    step("an unknown doctor is refused", s == 400, b)

    # ---------------------------------------------------------------- tidy: nothing of the test stays in use
    if plan:
        call("PUT", f"/api/admin/medicine/patients/{pid}/plan", admin, {"planId": None})
    call("PATCH", f"/api/admin/medicine/patients/{pid}/salesperson", admin, {"salespersonId": None})
    call("DELETE", f"/api/admin/medicine/patients/{pid}/doctors/{other}", admin)
    call("PATCH", f"/api/admin/salespeople/{t[b_]['id']}", admin, {"active": False})
    print(f"\n{passed} steps passed. Test patient {PATIENT} (id {pid}); salespeople {a2!r} and {b_!r} are off the team.")


if __name__ == "__main__":
    main()
