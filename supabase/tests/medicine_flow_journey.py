"""The medicine flow after a prescription, end to end (docs/backend/medicine-flow.md).

Runs against a local API by default (supabase/tests/local/README.md), or the deployed pilot with BASE set.
  BASE         the API base (default http://127.0.0.1:8000; deployed: https://<ref>.supabase.co/functions/v1)
  PSQL_URL     staging SQL through psql (local); unset, it goes through `supabase db query --remote`
  OTP          the sign-in code (default 123456, the pilot code while SMS is mocked)
  JOBS_SECRET, RAZORPAY_WEBHOOK_SECRET, WHATSAPP_APP_SECRET   the API's own values, to call the tick and sign webhooks
WhatsApp must be in mock mode (no WHATSAPP_TOKEN): replies are played through the admin panel's route and
the signed webhook. Time is moved with SQL (next_at, available_at, delivered_at, due_at), never by waiting.
Writes only test users (mobile 98000...). Clean up with supabase/tests/cleanup_test_patients.sql.

Walks:
  nano plan  sign (prescription message, cart held) -> the cart opens -> check-in 1 -> "Need more time" ->
             check-in 2 -> "I have questions" (task) -> no reply -> call task -> pay (follow-up and tasks close,
             order confirmation) -> pack, dispatch (needs tracking), out for delivery, deliver -> feedback
             "Something is wrong" (urgent task) -> renewal (one-month prescription) -> STOP on WhatsApp
  plan       sign (order ready at once) -> reminder -> pay -> deliver -> weekly dose schedule -> reminder ->
             "Skip this one" -> "Side effects" (task for the coach) -> day and time changed in the app ->
             refill order opens a week before running out -> payment failed webhook -> cancel and refund
  team       a coach sees only their own patient and cannot run the pharmacy; the measures; a second tick
             changes nothing
"""
import hashlib, hmac, json, os, subprocess, sys, time, uuid, urllib.request, urllib.error

BASE = os.environ.get("BASE", "http://127.0.0.1:8000").rstrip("/")
OTP = os.environ.get("OTP", "123456")
JOBS = os.environ.get("JOBS_SECRET", "")
RZP_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
WA_SECRET = os.environ.get("WHATSAPP_APP_SECRET", "")
PSQL = os.environ.get("PSQL_URL", "")
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUN = str(int(time.time()))[-4:]
NANO, PLAN, ADMIN, COACH = (f"98000{n}{RUN}" for n in "1234")
passed = 0


def call(method, path, token=None, body=None, headers=None, raw=None):
    data, h = None, {"Accept": "application/json", "x-region": "ap-south-1", **(headers or {})}
    if raw is not None:
        data, h["Content-Type"] = raw.encode(), "application/json"
    elif body is not None:
        data, h["Content-Type"] = json.dumps(body).encode(), "application/json"
    if token:
        h["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def step(name, cond, detail=""):
    global passed
    print(("PASS " if cond else "FAIL ") + name + (f"  [{json.dumps(detail, default=str)[:700]}]" if detail and not cond else ""))
    if not cond:
        sys.exit(1)
    passed += 1


def sql(q):
    """Staging and checks. Only ever touches test users (mobile 98000...): every statement names a test user,
    a test patient's id or a job; on the deployed project a change without a where clause is refused."""
    if not PSQL:
        assert all(" where " in s.lower() or not s.strip().lower().startswith(("update", "delete")) for s in q.split(";")), q
    if PSQL:
        r = subprocess.run(["psql", PSQL, "-tA", "-F", "\t", "-c", q], capture_output=True, text=True)
        if r.returncode:
            print(r.stderr); sys.exit(1)
        return [line.split("\t") for line in r.stdout.strip().splitlines() if line]
    r = subprocess.run(["supabase", "db", "query", "--remote", "--yes", "-o", "json", q], cwd=REPO, capture_output=True, text=True)
    if r.returncode:
        print(r.stdout, r.stderr); sys.exit(1)
    return [list(map(str, row.values())) for row in json.loads(r.stdout or "[]")]


def one(q):
    rows = sql(q)
    return rows[0][0] if rows and rows[0] else None


def sign_in(mobile):
    s, b = call("POST", "/api/auth/send-otp", body={"mobile": mobile})
    if s == 429:
        time.sleep(31); s, b = call("POST", "/api/auth/send-otp", body={"mobile": mobile})
    s, b = call("POST", "/api/auth/verify-otp", body={"mobile": mobile, "otp": OTP})
    step(f"signed in {mobile}", s == 200, b)
    return b["data"]["accessToken"], b["data"]["user"]["id"]


def tick():
    s, b = call("POST", "/api/jobs/tick", headers={"x-jobs-secret": JOBS})
    step("tick", s == 200 and all("error" not in (v if isinstance(v, dict) else {}) for v in b["data"]["steps"].values()), b)
    return b["data"]["steps"]


def messages(pid):
    return sql(f"select id, kind, status, coalesce(skip_reason, '') from patient_messages where patient_id = {pid} order by id")


def last(pid, kind):
    return one(f"select id from patient_messages where patient_id = {pid} and kind = '{kind}' order by id desc limit 1")


def reply(admin_token, message_id, code=None, text=None):
    s, b = call("POST", f"/api/admin/medicine/messages/{message_id}/reply", admin_token, {"code": code, "text": text})
    step(f"reply {code or text!r} on message {message_id}", s == 200, b)
    return b["data"]["outcome"]


def task(pid, kind):
    return sql(f"select id, priority, status, coalesce(assigned_to::text, '') from ops_tasks where patient_id = {pid} and kind = '{kind}' order by id desc limit 1")


def stage_patient(token, pid, first):
    """What onboarding and the first consultation leave behind, written as those routes write it."""
    sql(f"""update users set full_name = '{first} Test', onboarding_completed = true where id = {pid} and mobile like '98000%';
            insert into patient_profiles (user_id, first_name, last_name, gender, age_years, height_cm, weight_kg)
              values ({pid}, '{first}', 'Test', 'Female', 41, 162, 82) on conflict (user_id) do update set first_name = excluded.first_name;
            insert into addresses (user_id, label, full_name, line1, city, state, pincode, is_default)
              select {pid}, 'Home', '{first} Test', '14 Test Lane', 'Gurugram', 'Haryana', '122001', true
              where not exists (select 1 from addresses where user_id = {pid});
            insert into appointments (patient_id, doctor_id, status, visit_type) values ({pid}, 1, 'Completed', 'FIRST');""")
    # WhatsApp on, through the profile switch (records the consent)
    s, b = call("PATCH", "/api/patient/reminders", token, {"remindersEnabled": True, "whatsappReminders": True, "emailReminders": False})
    step(f"{first}: WhatsApp on", s == 200 and one(f"select count(*) from consents where user_id = {pid} and consent_type = 'WHATSAPP' and revoked_at is null") == "1", b)


def sign(doctor_token, pid, months=1, packs=1):
    """A draft with a stocked weekly pen, signed by the doctor (the fallback sign route the record uses)."""
    rx = one(f"""insert into prescriptions (patient_id, doctor_id, status, items) values ({pid}, 1, 'DRAFT',
      '[{{"medicineId": 1, "medicineName": "Wegovy FlexTouch", "genericName": "Semaglutide", "form": "Pen injection", "strength": "0.25 mg",
          "dose": "", "frequency": "Once a week, same day each week", "route": "Under the skin", "quantity": {packs}}}]') returning id""")
    s, b = call("POST", f"/api/doctor/patients/{pid}/prescriptions/{rx}/sign", doctor_token, {"months": months})
    step(f"signed prescription {rx}", s == 200 and b["data"]["status"] == "SIGNED", b)
    return int(rx), b["data"]


def pay(token, pid):
    cart = one(f"select id from medicine_carts where patient_id = {pid} and status = 'OPEN' order by id desc limit 1")
    s, b = call("POST", "/api/payments/orders", token, {"purpose": "MEDICINE_ORDER", "referenceId": cart})
    step("medicines order priced by the server", s == 200, b)
    s, b2 = call("POST", "/api/payments/verify", token, {"orderId": b["data"]["orderId"] if "orderId" in b["data"] else b["data"]["id"], "razorpayPaymentId": "pay_mock_" + uuid.uuid4().hex[:10]})
    step("paid (mock)", s == 200, b2)
    return int(cart), one(f"select id from medicine_orders where patient_id = {pid} order by id desc limit 1")


def move(admin_token, order, to, **extra):
    return call("POST", f"/api/admin/medicine/orders/{order}/move", admin_token, {"to": to, **extra})


def main():
    for name, value in (("JOBS_SECRET", JOBS), ("RAZORPAY_WEBHOOK_SECRET", RZP_SECRET), ("WHATSAPP_APP_SECRET", WA_SECRET)):
        if not value:
            print(f"Set {name} to the API's value."); sys.exit(2)
    s, b = call("GET", "/api/health")
    step("API up, WhatsApp in mock mode", s == 200 and b["data"]["integrations"].get("whatsapp") == "mock", b)

    # ---------------------------------------------------------------- people
    nano, nano_id = sign_in(NANO)
    plan, plan_id = sign_in(PLAN)
    _, admin_id = sign_in(ADMIN)
    sql(f"update users set role = 'ADMIN', full_name = 'Test Admin' where id = {admin_id} and mobile like '98000%'")
    admin, _ = sign_in(ADMIN)
    doctor, _ = sign_in("9000000001")
    stage_patient(nano, nano_id, "Asha")
    stage_patient(plan, plan_id, "Ravi")

    # ---------------------------------------------------------------- nano plan
    rx, signed = sign(doctor, nano_id)
    step("nano: the order is held (cartAvailableAt in the future)", signed["cartAvailableAt"] is not None, signed)
    m = messages(nano_id)
    step("nano: prescription sent on WhatsApp with no purchase link", [r[1] for r in m] == ["RX_READY"] and m[0][2] == "SENT", m)
    f = sql(f"select stage, next_at > now() + interval '40 hours' from medicine_followups where patient_id = {nano_id}")
    step("nano: first check-in waits for the order to open (48 h)", f == [["WAITING", "t"]], f)
    s, b = call("GET", "/api/care/cart", nano)
    step("nano: the app shows when the order opens", s == 200 and b["data"] is None and b.get("availableAt"), b)

    # the order opens: time moves on
    sql(f"update medicine_carts set available_at = now() - interval '1 minute' where patient_id = {nano_id}; update medicine_followups set next_at = now() - interval '1 minute' where patient_id = {nano_id}")
    tick()
    c1 = last(nano_id, "CHECK_IN_1")
    step("nano: first check-in sent", c1 is not None and one(f"select status from patient_messages where id = {c1}") == "SENT")
    reply(admin, c1, "LATER")
    step("nano: 'Need more time' moves the next check-in a day on",
         one(f"select next_at > now() + interval '23 hours' from medicine_followups where patient_id = {nano_id}") == "t")
    step("nano: the patient got a plain reply", one(f"select count(*) from patient_messages where patient_id = {nano_id} and kind = 'REPLY'") == "1")
    sql(f"update medicine_followups set next_at = now() - interval '1 minute' where patient_id = {nano_id}")
    tick()
    c2 = last(nano_id, "CHECK_IN_2")
    step("nano: second check-in sent", c2 is not None)
    reply(admin, c2, "QUESTIONS")
    t = task(nano_id, "QUESTIONS")
    step("nano: 'I have questions' opens a high-priority call-back", t and t[0][1] == "HIGH" and t[0][2] == "OPEN", t)
    sql(f"update medicine_followups set next_at = now() - interval '1 minute' where patient_id = {nano_id}")
    tick()
    t = task(nano_id, "NO_REPLY")
    step("nano: no order after both check-ins opens a call task", t and t[0][2] == "OPEN", t)
    s, b = call("POST", f"/api/admin/medicine/tasks/{t[0][0]}/done", admin, {"outcome": "WILL_PAY", "note": ""})
    step("a task cannot close without a note", s == 400, b)

    cart, order = pay(nano, nano_id)
    step("nano: paying closes the follow-up", one(f"select closed_reason from medicine_followups where cart_id = {cart}") == "PAID")
    step("nano: paying closes the call task", one(f"select outcome from ops_tasks where id = {t[0][0]}") == "PAID")
    step("nano: order confirmed on WhatsApp", one(f"select status from patient_messages where medicine_order_id = {order} and kind = 'ORDER_CONFIRMED'") == "SENT")
    step("nano: supply worked out (one 28-day pack)", one(f"select supply_days from medicine_orders where id = {order}") == "28")

    s, b = move(admin, order, "PACKED")
    step("pharmacy: packed", s == 200, b)
    s, b = move(admin, order, "DISPATCHED")
    step("pharmacy: dispatch refused without the courier and tracking", s == 400, b)
    s, b = move(admin, order, "DISPATCHED", courier="Delhivery", trackingUrl="https://www.delhivery.com/track/package/123", expectedAt=None)
    step("pharmacy: dispatched", s == 200, b)
    s, b = move(admin, order, "PACKED")
    step("pharmacy: an order never moves back", s == 400, b)
    move(admin, order, "OUT_FOR_DELIVERY")
    s, b = move(admin, order, "DELIVERED")
    step("pharmacy: delivered", s == 200, b)
    kinds = [r[1] for r in messages(nano_id) if r[2] in ("SENT", "QUEUED")]
    for k in ("ORDER_PACKED", "ORDER_DISPATCHED", "ORDER_OUT_FOR_DELIVERY", "ORDER_DELIVERED", "ORDER_FEEDBACK"):
        step(f"nano: {k} on WhatsApp", k in kinds, kinds)
    step("nano: the feedback question waits two hours", one(f"select status || (send_after > now() + interval '100 minutes')::text from patient_messages where medicine_order_id = {order} and kind = 'ORDER_FEEDBACK'") == "QUEUEDtrue")
    step("nano: no dose schedule for the nano plan (PRD: plan patients only)", one(f"select count(*) from dose_schedules where patient_id = {nano_id}") == "0")
    s, b = call("GET", "/api/care/medicine-orders", nano)
    o = b["data"][0]
    step("app: the order shows number, courier, run-out date and the feedback question",
         o["orderNumber"].startswith("MED-") and o["courier"] == "Delhivery" and o["runOutOn"] and o["canGiveFeedback"], o)
    s, b = call("POST", f"/api/care/medicine-orders/{order}/feedback", nano, {"rating": "ISSUE", "note": "The seal was broken"})
    step("app: 'Something is wrong' answers with when the team calls", s == 200 and b["data"]["callBy"], b)
    t = task(nano_id, "DELIVERY_ISSUE")
    step("nano: delivery problem is a critical task", t and t[0][1] == "CRITICAL", t)
    step("nano: the queued feedback question is not sent once answered in the app", True)
    sql(f"update patient_messages set send_after = now() - interval '1 minute' where medicine_order_id = {order} and kind = 'ORDER_FEEDBACK'")
    tick()
    step("nano: ... it is skipped, not sent", one(f"select status from patient_messages where medicine_order_id = {order} and kind = 'ORDER_FEEDBACK'") == "SKIPPED")

    # renewal: a one-month prescription does not cover another supply
    sql(f"update medicine_orders set delivered_at = now() - interval '22 days' where id = {order}; delete from job_runs where name = 'refills'")
    tick()
    step("nano: a week before running out, the doctor's review is due (renewal)",
         last(nano_id, "RENEWAL_DUE") is not None and task(nano_id, "RENEWAL"))

    # STOP on WhatsApp, through the signed webhook
    payload = json.dumps({"entry": [{"changes": [{"value": {"messages": [{"id": f"wamid.{uuid.uuid4().hex}", "from": f"91{NANO}", "type": "text", "text": {"body": "STOP"}}]}}]}]})
    sig = "sha256=" + hmac.new(WA_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    s, b = call("POST", "/api/webhooks/whatsapp", raw=payload, headers={"X-Hub-Signature-256": "sha256=" + "0" * 64})
    step("webhook: a bad signature is refused", s == 401, b)
    s, b = call("POST", "/api/webhooks/whatsapp", raw=payload, headers={"X-Hub-Signature-256": sig})
    step("webhook: STOP accepted", s == 200, b)
    step("nano: STOP revokes the WhatsApp consent",
         one(f"select count(*) from consents where user_id = {nano_id} and consent_type = 'WHATSAPP' and revoked_at is null") == "0")
    s, b = call("POST", "/api/webhooks/whatsapp", raw=payload, headers={"X-Hub-Signature-256": sig})
    step("webhook: the same event again does nothing", s == 200 and one(f"select count(*) from patient_message_replies where patient_id = {nano_id} and text = 'STOP'") == "1")
    s, b = call("GET", "/api/patient/profile", nano)
    step("app: the profile switch shows WhatsApp off", s == 200 and b["data"]["whatsappReminders"] is False, b)

    # ---------------------------------------------------------------- plan patient
    sql(f"insert into subscriptions (user_id, plan_id, status, starts_at, ends_at) values ({plan_id}, 3, 'Active', now(), now() + interval '6 months')")
    rx2, signed = sign(doctor, plan_id, months=3, packs=3)
    step("plan: three months, the order ready at once", signed["months"] == 3, signed)
    s, b = call("PATCH", "/api/care/cart", plan, {"lines": [{"medicineId": "1", "quantity": 1}]})
    step("plan: buys one pack of the three prescribed", s == 200 and b["data"]["lines"][0]["quantity"] == 1, b)
    step("plan: prescription sent with the order link", [r[1] for r in messages(plan_id)] == ["RX_READY_ORDER"])
    sql(f"update medicine_followups set next_at = now() - interval '1 minute' where patient_id = {plan_id}")
    tick()
    step("plan: a reminder a day later", last(plan_id, "PLAN_REMINDER") is not None)

    # a failed payment first (signed Razorpay webhook), then the real one
    cart2 = one(f"select id from medicine_carts where patient_id = {plan_id} and status = 'OPEN'")
    s, b = call("POST", "/api/payments/orders", plan, {"purpose": "MEDICINE_ORDER", "referenceId": cart2})
    porder = b["data"].get("orderId") or b["data"].get("id")
    event = json.dumps({"event": "payment.failed", "payload": {"payment": {"entity": {"order_id": porder, "error_description": "Bank declined"}}}})
    sig = hmac.new(RZP_SECRET.encode(), event.encode(), hashlib.sha256).hexdigest()
    s, b = call("POST", "/api/webhooks/razorpay", raw=event, headers={"X-Razorpay-Signature": sig, "X-Razorpay-Event-Id": f"evt_{uuid.uuid4().hex[:12]}"})
    step("plan: payment failed webhook accepted", s == 200, b)
    step("plan: the patient is told how to try again", last(plan_id, "PAYMENT_FAILED") is not None)
    step("plan: the team gets a payment task", task(plan_id, "PAYMENT_FAILED"))
    cart2, order2 = pay(plan, plan_id)
    step("plan: paying closes the payment task", one(f"select status from ops_tasks where patient_id = {plan_id} and kind = 'PAYMENT_FAILED'") == "DONE")
    move(admin, order2, "DISPATCHED", courier="Our rider", trackingNo="IR-7731")
    move(admin, order2, "DELIVERED")
    sched = sql(f"select id, cadence, weekday is not null, array_to_string(times, ',') from dose_schedules where patient_id = {plan_id}")
    step("plan: delivery starts a weekly dose reminder", sched and sched[0][1] == "WEEKLY" and sched[0][2] == "t", sched)

    # a dose due now
    sql(f"""insert into dose_events (schedule_id, patient_id, due_at) values ({sched[0][0]}, {plan_id}, now() - interval '5 minutes')""")
    tick()
    dr = last(plan_id, "DOSE_REMINDER")
    step("plan: dose reminder sent", dr is not None)
    reply(admin, dr, "SKIP")
    lst = one(f"select id from patient_messages where patient_id = {plan_id} and kind = 'REPLY' order by id desc limit 1")
    step("plan: 'Skip this one' asks why (a list)", one(f"select (vars->'rows') is not null from patient_messages where id = {lst}") == "t")
    reply(admin, lst, "SKIP_SIDE_EFFECTS")
    t = task(plan_id, "ADHERENCE")
    step("plan: side effects open a high-priority task", t and t[0][1] == "HIGH", t)

    # the app: doses listed; a new day and time
    s, b = call("GET", "/api/care/doses", plan)
    step("app: doses listed", s == 200 and len(b["data"]["schedules"]) == 1 and b["data"]["events"], b)
    s, b = call("PATCH", f"/api/care/doses/{sched[0][0]}", plan, {"weekday": 7, "time": "20:30"})
    step("app: reminder moved to Sunday 8:30 pm", s == 200 and b["data"]["weekday"] == 7 and b["data"]["times"] == ["20:30"], b)
    s, b = call("PATCH", f"/api/care/doses/{sched[0][0]}", plan, {"time": "25:00"})
    step("app: a time that does not exist is refused", s == 400, b)

    # refill: three months prescribed, one pack bought, a week before it runs out
    sql(f"update medicine_orders set delivered_at = now() - interval '22 days' where id = {order2}; delete from job_runs where name = 'refills'")
    tick()
    refill = sql(f"select id, kind, status from medicine_carts where patient_id = {plan_id} and kind = 'REFILL'")
    step("plan: a refill order opens, covered by the prescription", refill and refill[0][2] == "OPEN", refill)
    step("plan: refill reminder sent", last(plan_id, "REFILL_DUE") is not None)
    s, b = call("GET", "/api/care/cart", plan)
    step("app: the cart is the refill, two packs left on the prescription",
         s == 200 and b["data"]["kind"] == "REFILL" and b["data"]["lines"][0]["prescribed"] == 2, b)

    # cancel and refund the delivered order (a damaged pack)
    s, b = call("POST", f"/api/admin/medicine/orders/{order2}/cancel", admin, {"reason": ""})
    step("cancel needs a reason", s == 400, b)
    s, b = call("POST", f"/api/admin/medicine/orders/{order2}/cancel", admin, {"reason": "Pack damaged in transit"})
    step("cancelled and refunded", s == 200 and b["data"]["refundId"], b)
    step("plan: told about the refund", last(plan_id, "ORDER_CANCELLED") is not None)
    step("plan: upcoming doses from that order removed",
         one(f"select count(*) from dose_events e join dose_schedules s on s.id = e.schedule_id where s.medicine_order_id = {order2} and e.status = 'DUE' and e.due_at > now()") == "0")

    # ---------------------------------------------------------------- the team
    s, b = call("POST", "/api/admin/coaches", admin, {"fullName": "Test Coach", "mobile": COACH})
    step("coach added", s == 200, b)
    coach_id = b["data"]["id"]
    s, b = call("PATCH", f"/api/admin/medicine/patients/{plan_id}/coach", admin, {"coachId": coach_id})
    step("coach assigned to the plan patient", s == 200, b)
    step("the coach takes over the patient's open adherence task", task(plan_id, "ADHERENCE")[0][3] == str(coach_id))
    coach, _ = sign_in(COACH)
    s, b = call("GET", "/api/admin/medicine/patients", coach)
    ids = [p["id"] for p in b["data"]]
    step("coach sees their patient and not the other", str(plan_id) in ids and str(nano_id) not in ids, ids)
    s, b = call("GET", f"/api/admin/medicine/patients/{nano_id}", coach)
    step("coach cannot open another coach's patient", s == 404, b)
    s, b = call("GET", f"/api/admin/medicine/patients/{plan_id}", coach)
    step("coach sees the patient's doses and messages", s == 200 and b["data"]["doses"]["schedules"] and b["data"]["messages"], b)
    step("opening a record is logged", one(f"select count(*) from audit_log where patient_id = {plan_id} and action like 'Viewed medicines (coach)%'") == "1")
    s, b = move(coach, order2, "DELIVERED")
    step("coach cannot run the pharmacy", s == 403, b)
    s, b = call("GET", "/api/admin/medicine/tasks", coach)
    step("coach's queue holds only their patient's tasks", s == 200 and all(t["patientId"] == str(plan_id) for t in b["data"]), b)

    s, b = call("GET", "/api/admin/medicine/numbers?days=30", admin)
    step("the measures", s == 200 and len(b["data"]["measures"]) >= 10, b)
    s, b = call("GET", "/api/admin/medicine/summary", admin)
    step("the summary", s == 200 and b["data"]["tasks"]["open"] >= 1, b)

    before = one(f"select count(*) from patient_messages where patient_id in ({nano_id}, {plan_id})")
    tasks_before = one(f"select count(*) from ops_tasks where patient_id in ({nano_id}, {plan_id})")
    tick(); tick()
    step("two more ticks change nothing (idempotent)",
         one(f"select count(*) from patient_messages where patient_id in ({nano_id}, {plan_id})") == before
         and one(f"select count(*) from ops_tasks where patient_id in ({nano_id}, {plan_id})") == tasks_before)
    s, b = call("POST", "/api/jobs/tick", headers={"x-jobs-secret": "wrong"})
    step("the tick refuses a wrong secret", s == 401, b)

    print(f"\n{passed} checks passed. Clean up: supabase/tests/cleanup_test_patients.sql")


if __name__ == "__main__":
    main()
