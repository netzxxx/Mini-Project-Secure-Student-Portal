#!/usr/bin/env python3
"""
Automated security checks for the Secure Student Portal (localhost only).

Runs the same 6 tests against the running app and prints VULNERABLE / SECURE
for each one. Run it once on the v1-vulnerable build (BEFORE) and once on the
v2-fixed build (AFTER) to get the retest evidence.

Usage:
    python3 security-tests/attack.py                      # http://localhost:8080
    python3 security-tests/attack.py --base http://127.0.0.1:8080
    python3 security-tests/attack.py --only T1 T2

Only the Python standard library is used. Use it ONLY against your own local app.
"""
import argparse
import json
import sys
import urllib.error
import urllib.request

DEMO = {
    "student_a": "Student#2026",
    "student_b": "Student#2026",
    "student_c": "Student#2026",
    "admin": "Admin#2026",
}
SENSITIVE_FIELDS = ("passwordHash", "iin")

RED, GREEN, YELLOW, BOLD, RESET = "\033[31m", "\033[32m", "\033[33m", "\033[1m", "\033[0m"


class Resp:
    def __init__(self, status, headers, body):
        self.status = status
        self.headers = {k.lower(): v for k, v in headers.items()}
        self.text = body
        try:
            self.json = json.loads(body) if body else None
        except ValueError:
            self.json = None


class Client:
    def __init__(self, base):
        self.base = base.rstrip("/")

    def call(self, method, path, token=None, body=None, accept="application/json"):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header("Accept", accept)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", "Bearer " + token)
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return Resp(r.status, dict(r.headers), r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            return Resp(e.code, dict(e.headers), e.read().decode("utf-8", "replace"))

    def login(self, username, password=None):
        r = self.call("POST", "/api/auth/login", body={"username": username, "password": password or DEMO[username]})
        if r.status != 200:
            raise RuntimeError(f"login {username} failed: HTTP {r.status} {r.text[:120]}")
        return r.json["token"], r.json["user"], r


def leaked(resp):
    return [f for f in SENSITIVE_FIELDS if f'"{f}"' in resp.text]


# ---------------------------------------------------------------- tests
def t1_idor(c):
    """Student A requests the grades of Student B."""
    tok_a, user_a, _ = c.login("student_a")
    _, user_b, _ = c.login("student_b")
    own = c.call("GET", f"/api/students/{user_a['id']}/grades", tok_a)
    other = c.call("GET", f"/api/students/{user_b['id']}/grades", tok_a)
    evidence = [
        f"GET /api/students/{user_a['id']}/grades as student_a (own)   -> {own.status}",
        f"GET /api/students/{user_b['id']}/grades as student_a (B's)   -> {other.status}",
    ]
    vulnerable = other.status == 200 and bool(other.json)
    if vulnerable:
        evidence.append(f"leaked: {len(other.json)} grades of {other.json[0]['studentName']}")
    return vulnerable, own.status == 200, evidence


def t2_admin_as_student(c):
    """Student calls admin-only API although the Admin tab is hidden in the UI."""
    tok_a, user_a, _ = c.login("student_a")
    tok_admin, _, _ = c.login("admin")
    users = c.call("GET", "/api/admin/users", tok_a)
    audit = c.call("GET", "/api/admin/audit", tok_a)
    role = c.call("PUT", f"/api/admin/users/{user_a['id']}/role", tok_a, {"role": "STUDENT"})
    admin_ok = c.call("GET", "/api/admin/users", tok_admin)
    evidence = [
        f"GET /api/admin/users as student_a             -> {users.status}",
        f"GET /api/admin/audit as student_a             -> {audit.status}",
        f"PUT /api/admin/users/{user_a['id']}/role as student_a       -> {role.status}",
        f"GET /api/admin/users as admin (control)       -> {admin_ok.status}",
    ]
    vulnerable = 200 in (users.status, audit.status, role.status)
    return vulnerable, admin_ok.status == 200, evidence


def t3_data_exposure(c):
    """API responses contain fields the client never needs (passwordHash, IIN)."""
    tok_a, _, login_resp = c.login("student_a")
    _, user_b, _ = c.login("student_b")
    me = c.call("GET", "/api/me", tok_a)
    other = c.call("GET", f"/api/users/{user_b['id']}", tok_a)
    evidence = [
        f"POST /api/auth/login        -> sensitive fields: {leaked(login_resp) or 'none'}",
        f"GET  /api/me                -> {me.status}, sensitive fields: {leaked(me) or 'none'}",
        f"GET  /api/users/{user_b['id']} (B) as A -> {other.status}, sensitive fields: {leaked(other) or 'none'}",
    ]
    vulnerable = bool(leaked(login_resp) or leaked(me) or (other.status == 200 and leaked(other)))
    return vulnerable, me.status == 200, evidence


def t4_mass_assignment(c):
    """Student sends {"role":"ADMIN"} in the profile update."""
    tok_c, user_c, _ = c.login("student_c")
    patch = c.call("PATCH", "/api/me", tok_c, {"fullName": "Dana Student", "role": "ADMIN"})
    tok_c2, _, _ = c.login("student_c")
    role_after = (c.call("GET", "/api/me", tok_c2).json or {}).get("role")
    normal = c.call("PATCH", "/api/me", tok_c2, {"fullName": "Dana Student"})
    evidence = [
        f'PATCH /api/me {{"role":"ADMIN"}} as student_c -> {patch.status}',
        f"role of student_c after re-login              -> {role_after}",
        f"normal profile update (control)               -> {normal.status}",
    ]
    vulnerable = role_after == "ADMIN"
    if vulnerable:  # undo, so the demo data stays clean
        tok_admin, _, _ = c.login("admin")
        c.call("PUT", f"/api/admin/users/{user_c['id']}/role", tok_admin, {"role": "STUDENT"})
        evidence.append("(role reverted to STUDENT by admin after the test)")
    return vulnerable, normal.status == 200, evidence


def t5_bruteforce(c, attempts=8):
    """Many wrong passwords in a row for one account (teacher_saule)."""
    codes = [c.call("POST", "/api/auth/login", body={"username": "teacher_saule", "password": f"guess{i}"}).status
             for i in range(attempts)]
    evidence = [f"{attempts} wrong passwords for teacher_saule -> {codes}"]
    vulnerable = 429 not in codes
    return vulnerable, True, evidence


def t6_misconfiguration(c):
    """H2 console open, stack traces in errors, missing security headers."""
    tok_a, _, _ = c.login("student_a")
    console = c.call("GET", "/h2-console/", accept="text/html")
    bad = c.call("GET", "/api/students/abc/grades", tok_a)
    home = c.call("GET", "/", accept="text/html")
    wanted = ["x-content-type-options", "x-frame-options", "content-security-policy"]
    missing = [h for h in wanted if h not in home.headers]
    trace = '"trace"' in bad.text or "at org.springframework" in bad.text
    evidence = [
        f"GET /h2-console/ (no login)            -> {console.status}",
        f"GET /api/students/abc/grades           -> {bad.status}, stack trace in body: {trace}",
        f"GET / missing security headers         -> {missing or 'none'}",
    ]
    vulnerable = console.status == 200 or trace or bool(missing)
    return vulnerable, home.status == 200, evidence


TESTS = [
    ("T1", "IDOR: student reads another student's grades", t1_idor),
    ("T2", "Admin API callable from Student role", t2_admin_as_student),
    ("T3", "Excessive data exposure (passwordHash, IIN)", t3_data_exposure),
    ("T4", "Mass assignment: student sets own role", t4_mass_assignment),
    ("T6", "Security misconfiguration (console, errors, headers)", t6_misconfiguration),
    ("T5", "Login brute force without limit", t5_bruteforce),  # last: it may lock an account
]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default="http://localhost:8080")
    ap.add_argument("--only", nargs="*", help="run only these tests, e.g. T1 T2")
    ap.add_argument("--no-color", action="store_true")
    args = ap.parse_args()
    if args.no_color or not sys.stdout.isatty():
        global RED, GREEN, YELLOW, BOLD, RESET
        RED = GREEN = YELLOW = BOLD = RESET = ""

    c = Client(args.base)
    info = c.call("GET", "/api/info")
    build = info.json.get("build") if info.json else "unknown"
    print(f"{BOLD}Secure Student Portal - security checks{RESET}")
    print(f"target: {args.base}   build: {build}\n")

    vulnerable_count = 0
    for code, title, fn in TESTS:
        if args.only and code not in args.only:
            continue
        try:
            vulnerable, works, evidence = fn(c)
        except Exception as e:  # noqa: BLE001
            print(f"{YELLOW}[{code}] ERROR{RESET} {title}: {e}\n")
            continue
        status = f"{RED}VULNERABLE{RESET}" if vulnerable else f"{GREEN}SECURE{RESET}"
        vulnerable_count += vulnerable
        print(f"[{code}] {status}  {title}")
        for line in evidence:
            print("      " + line)
        if not works:
            print(f"      {YELLOW}warning: normal (allowed) use did not work{RESET}")
        print()

    print(f"{BOLD}Result: {vulnerable_count} vulnerable{RESET}")
    sys.exit(1 if vulnerable_count else 0)


if __name__ == "__main__":
    main()
