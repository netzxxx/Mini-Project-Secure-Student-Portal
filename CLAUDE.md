# CLAUDE.md — Secure Student Portal

Context for Claude Code (or any new session) working in this repo.

## What this is
University mini project: **Mobile and Web Application Security, Quiz 2 Part 2, Track 2
"Secure Student Portal & Access Control"** (Narxoz University, Week 13–14).
Team of two: **Nietkali Nurmanov** (backend, T1/T3/T5, CI) and **Damir Panzhazov**
(frontend, T2/T4/T6, attack script, README).

Assignment requirements (graded, 5 points):
1. Working small app + clear team contribution (1.0)
2. Two meaningful security tests with evidence (1.0) — ours: T1 IDOR, T2 admin API as student
3. Explanation of risks and causes (0.75)
4. Implemented fix + successful retest (1.25)
5. 3–5 page PDF report + 5–7 min team demo, each member explains own part (1.0)
Rules: test only our own app on localhost, dummy data only, no real passwords/keys in the repo.

## Versions
- Tag `v1-vulnerable` = BEFORE (6 deliberate bugs). **Never rewrite this tag.**
- Tag `v2-fixed` = AFTER. One commit per fix: `fix(T1)` … `fix(T6)`.
- Code comments mark the spots: `VULNERABLE (Test N)` in v1, `FIX (Test N)` in v2.

## Run / test
```bash
./mvnw spring-boot:run                 # http://localhost:8080 (binds 127.0.0.1)
./mvnw test                            # JUnit security regression tests (v2)
python3 security-tests/attack.py       # BEFORE/AFTER attack script, stdlib only
```
Demo logins: student_a / student_b / student_c `Student#2026`, teacher_timur / teacher_saule
`Teacher#2026`, admin `Admin#2026`. H2 in-memory DB is re-seeded on every start.
T5 locks `teacher_saule` for 5 minutes after the attack script runs — restart the app to reset.

## Layout
- `config/SecurityConfig` — filter chain, JWT (HS256 via Nimbus), headers, role rules
- `config/DataSeeder` — made-up users, courses, grades
- `service/` — TokenService, CurrentUserService, AuditService (REQUIRES_NEW), LoginAttemptService
- `web/` — controllers; `web/dto/` — response/request records (never return entities)
- `src/main/resources/static/` — plain HTML/CSS/JS frontend; must stay CSP-compatible
  (no inline `<script>`, no `style=""` attributes, build DOM with `textContent` via `el()`)
- `security-tests/attack.py`, `src/test/.../SecurityRegressionTest.java`
- `.github/workflows/ci.yml` — build+tests, Semgrep, Trivy, ZAP baseline
- `docs/` — demo script and report material

## Conventions
- Java 21, Spring Boot 3.3, keep it simple and readable (students must explain every line).
- Authorization is checked on the server: filter chain for URL/role rules, plus object-level
  checks in controllers. Denied attempts go to the audit log.
- Commit messages: Conventional Commits, English.
