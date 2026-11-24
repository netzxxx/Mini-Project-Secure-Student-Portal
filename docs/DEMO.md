# Demo script (Week 14, 5–7 minutes)

Preparation: two terminals, browser with DevTools (F12 → Network), Reqable or Postman optional.

```bash
git checkout v1-vulnerable && ./mvnw spring-boot:run     # terminal 1
python3 security-tests/attack.py                         # terminal 2
```

## 0:00 – 1:00 · Damir — the app
- Login page, demo accounts, badge "v1 · vulnerable build".
- Student view (grades, profile), teacher view (edit grades), admin view (roles, audit log).
- Architecture in one sentence: browser → REST API with JWT → Spring Security → H2 database.

## 1:00 – 2:30 · Nietkali — T1 IDOR (required test 1)
- As `student_a` open DevTools → Network → request `GET /api/students/4/grades`.
- Change 4 → 5 (Reqable / "Copy as fetch" in console) → **200, Bolat's grades**.
- Risk: confidentiality of grades, OWASP A01 / API1 BOLA. Cause: id from the URL is trusted.
- Show the fix commit `fix(T1)`: ownership check in `GradeController`.
- Bonus in one line each: T3 (passwordHash in `/api/me`), T5 (unlimited logins).

## 2:30 – 4:00 · Damir — T2 admin API as Student (required test 2)
- As `student_a` there is no Admin tab ("hidden button").
- Send `GET /api/admin/users` with the student token → **200, list of all users**;
  `PUT /api/admin/users/4/role {"role":"ADMIN"}` → works.
- Risk: privilege escalation, OWASP A01 / API5. Cause: only the UI hides the button.
- Show the fix commit `fix(T2)`: `hasRole("ADMIN")` + `@PreAuthorize`.
- Bonus in one line each: T4 (mass assignment), T6 (H2 console + stack trace).

## 4:00 – 5:30 · Both — retest
```bash
# Ctrl+C in terminal 1
git checkout v2-fixed && ./mvnw spring-boot:run
python3 security-tests/attack.py      # all SECURE
./mvnw test                           # 7 JUnit tests green
```
- Same requests in the browser now give **403**; `student_a` still sees own grades; admin still works.
- Admin → audit log shows the DENIED attempts.

## 5:30 – 6:30 · Conclusion + limitations
- Security must be enforced on the server; the UI is only convenience.
- Remaining limitations: no HTTPS locally, in-memory lockout (resets on restart, can be abused to lock
  a victim's account), default JWT secret for local demo, H2 instead of a real DB.
- CI pipeline (Semgrep, Trivy, ZAP) checks every push.

## Likely questions
- *Why 403 and not 404?* 403 is honest and easy to debug; 404 hides that the record exists — both are
  acceptable per the assignment. We chose 403 and log it.
- *Why is hiding the button not enough?* The API can be called directly (DevTools, curl, Reqable).
- *What is IDOR?* Access to an object by changing its id, because the server does not check ownership.
- *Why DTOs?* The response contains only what the screen needs; new entity fields never leak by accident.
- *How does JWT work here?* Signed HS256 token with `sub`, `uid`, `roles`, 60 min expiry; server
  verifies the signature on every request; no session cookie, so no CSRF.
