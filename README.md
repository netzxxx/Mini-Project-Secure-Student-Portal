# Secure Student Portal

Mini project for **Mobile and Web Application Security — Quiz 2, Part 2**
(Track 2: *Secure Student Portal & Access Control*), Narxoz University.

A small student portal with three roles (**Student, Teacher, Admin**). We built it with
deliberate access-control and data-protection bugs, tested them, fixed them in our own code
and retested. Both versions are kept in Git:

| Git tag | What it is |
|---|---|
| `v1-vulnerable` | **BEFORE** — the original build with 6 security problems |
| `v2-fixed` | **AFTER** — every problem fixed, plus automated regression tests and a DevSecOps CI pipeline |

> All accounts, names and grades are made up. The vulnerable build listens on `127.0.0.1` only.
> Never deploy `v1-vulnerable` to a public server.

## Team

| Member | Responsibility |
|---|---|
| **Nietkali Nurmanov** | Backend (Spring Boot, Spring Security, JWT, database). Tests and fixes **T1** (IDOR), **T3** (data exposure), **T5** (brute force). CI pipeline. |
| **Damir Panzhazov** | Frontend (login, dashboards, role-based UI). Tests and fixes **T2** (admin API from Student role), **T4** (mass assignment), **T6** (misconfiguration). Python attack script, README. |

## Stack

- **Backend:** Java 21, Spring Boot 3.3, Spring Security 6 (JWT resource server, BCrypt), Spring Data JPA, H2 in-memory DB
- **Frontend:** HTML, CSS, plain JavaScript (mobile-friendly, no build step), served by Spring Boot
- **Security testing:** browser DevTools / Reqable / Postman, `security-tests/attack.py` (Python, standard library only), JUnit + MockMvc regression tests
- **CI (GitHub Actions):** build + tests, Semgrep (SAST), Trivy (SCA), OWASP ZAP baseline (DAST)

## Run locally

You need **Java 21** (Maven is downloaded automatically by the wrapper).

```bash
git clone https://github.com/netzxxx/Mini-Project-Secure-Student-Portal.git
cd Mini-Project-Secure-Student-Portal

# choose the version
git checkout v1-vulnerable     # BEFORE
# git checkout v2-fixed        # AFTER

./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run
```

Open <http://localhost:8080>. The badge at the top shows which build is running.

Other options:
- **IntelliJ IDEA:** open the folder, wait for Maven import, run `PortalApplication`.
- **Docker:** `docker compose up --build` (published on `127.0.0.1:8080` only).

### Demo accounts

| Username | Password | Role |
|---|---|---|
| `student_a` (Aliya) | `Student#2026` | Student |
| `student_b` (Bolat) | `Student#2026` | Student |
| `student_c` (Dana) | `Student#2026` | Student |
| `teacher_timur` | `Teacher#2026` | Teacher (CS-301, CS-310) |
| `teacher_saule` | `Teacher#2026` | Teacher (NET-210) |
| `admin` | `Admin#2026` | Admin |

These are dummy demo passwords for a local in-memory database.

## Run the security tests

With the app running:

```bash
python3 security-tests/attack.py
```

On `v1-vulnerable` all 6 checks print **VULNERABLE**; on `v2-fixed` all print **SECURE**.
On `v2-fixed` the JUnit regression tests run with `./mvnw test`.

## The six security tests

| # | Test | OWASP | v1 result (BEFORE) | Fix | v2 result (AFTER) |
|---|---|---|---|---|---|
| **T1** | Student A requests `GET /api/students/{B}/grades` | A01 Broken Access Control / API1 BOLA | 200, B's grades returned | Ownership check on the server | **403**, own grades still 200 |
| **T2** | Student calls `/api/admin/**` (Admin tab is only hidden in the UI) | A01 / API5 Broken Function Level Authorization | 200, user list + role change work | `hasRole('ADMIN')` in the filter chain **and** `@PreAuthorize` on the controller | **403**, admin still 200 |
| **T3** | Login, `/api/me`, `/api/users/{id}` return `passwordHash`, `iin` | API3 Excessive Data Exposure | hashes and IIN visible in DevTools | Response DTOs, `@JsonIgnore`, object-level check on `/api/users/{id}` | no sensitive fields |
| **T4** | Student sends `PATCH /api/me {"role":"ADMIN"}` | API3 Mass Assignment | student becomes ADMIN | Request DTO with a whitelist of 3 fields; unknown fields rejected | **400**, role unchanged |
| **T5** | 8 wrong passwords in a row | A07 Identification and Authentication Failures | all 401, no limit | Lockout after 5 failures (429 + `Retry-After`) | **429** |
| **T6** | `/h2-console`, error stack traces, missing headers | A05 Security Misconfiguration | DB console open, stack trace leaked, no headers | Console off, no stack traces, CSP / X-Frame-Options / nosniff / Referrer-Policy | console closed, generic errors, headers present |

T1 and T2 are the two required tests for Track 2; T3–T6 are extra.

## API

| Method | Path | Who should be allowed |
|---|---|---|
| POST | `/api/auth/login` | everyone |
| GET | `/api/info` | everyone (shows build label) |
| GET / PATCH | `/api/me` | logged-in user, own profile |
| GET | `/api/students/{id}/grades` | that student, teachers (own courses), admin |
| GET | `/api/users/{id}` | that user, teacher, admin |
| GET | `/api/teacher/courses` | teacher (own courses), admin (all) |
| PUT | `/api/grades/{id}` | teacher of the course, admin |
| GET | `/api/admin/users`, `/api/admin/audit` | admin |
| PUT | `/api/admin/users/{id}/role` | admin |

## Project structure

```
src/main/java/kz/narxoz/portal
├── config/       SecurityConfig (filter chain, JWT), DataSeeder (demo data)
├── domain/       User, Course, Grade, AuditLog, Role
├── repo/         Spring Data repositories
├── service/      TokenService (JWT), CurrentUserService, AuditService, LoginAttemptService (v2)
└── web/          REST controllers + dto/
src/main/resources/static   frontend (index.html, app.html, js/, css/)
security-tests/attack.py    automated BEFORE/AFTER checks
docs/                       report material, demo script
```

## Safety rules we followed

- Only our own app on `localhost`; made-up users and grades; no real passwords or keys in the repo.
- The JWT key is read from the `JWT_SECRET` environment variable; the default value is for local demos only.
