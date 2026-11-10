#!/usr/bin/env python3
"""
SunRey dashboard acceptance: real customer journey against a running Consumer BFF.

Usage:
  python3 -I scripts/dashboard-acceptance.py --api http://127.0.0.1:8443 --phase journey --state /tmp/state.json
  # restart the BFF process, then:
  python3 -I scripts/dashboard-acceptance.py --api http://127.0.0.1:8443 --phase after-restart --state /tmp/state.json

Phase "journey" registers a fresh customer, enrolls TOTP, steps up to STRONG,
opens a sandbox USD account through the Compliance Kernel, funds it from the
sandbox faucet, proves idempotent replay, proves cross-customer isolation,
proves logout, and records what it created in --state.

Phase "after-restart" logs in again (new process), steps up, and verifies the
customer, account and balance recorded in --state are still there.

Sandbox only. It never calls a live provider and every amount is simulated.
Exit code 0 only if every check passes. Standard library only.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import secrets
import struct
import sys
import time
import urllib.error
import urllib.request

RESULTS: list[dict] = []


def totp(secret_b32: str, at: float | None = None) -> str:
    s = secret_b32.upper() + "=" * ((8 - len(secret_b32) % 8) % 8)
    key = base64.b32decode(s)
    counter = int(at if at is not None else time.time()) // 30
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 15
    code = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{code:06d}"


class Api:
    def __init__(self, base: str, origin: str | None):
        self.base = base.rstrip("/") + "/api/v1"
        self.origin = origin

    def call(self, method: str, path: str, body: dict | None = None, token: str | None = None,
             idem: str | None = None) -> tuple[int, dict, dict]:
        headers = {"accept": "application/json"}
        if body is not None:
            headers["content-type"] = "application/json"
        if token:
            headers["authorization"] = f"Bearer {token}"
        if idem:
            headers["idempotency-key"] = idem
        if self.origin:
            headers["origin"] = self.origin
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode() or "{}"
                return resp.status, json.loads(raw), dict(resp.headers)
        except urllib.error.HTTPError as err:
            raw = err.read().decode() or "{}"
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                payload = {"raw": raw[:200]}
            return err.code, payload, dict(err.headers)


def check(name: str, ok: bool, evidence: object) -> bool:
    RESULTS.append({"check": name, "ok": bool(ok), "evidence": evidence})
    print(("PASS " if ok else "FAIL ") + name + "  " + json.dumps(evidence, default=str)[:300])
    return ok


def strong_session(api: Api, email: str, password: str, secret: str) -> str:
    status, login, _ = api.call("POST", "/auth/login", {"email": email, "password": password})
    if status != 200:
        raise SystemExit(f"login failed: {status} {login}")
    token = login.get("accessToken")
    if login.get("kind") == "MFA_REQUIRED":
        status, verified, _ = api.call("POST", "/auth/mfa/verify", {"mfaToken": login["mfaToken"], "code": totp(secret)})
        if status != 200:
            raise SystemExit(f"mfa login failed: {status} {verified}")
        token = verified["accessToken"]
    status, step, _ = api.call("POST", "/auth/mfa/step-up", {}, token)
    if status != 200:
        raise SystemExit(f"step-up begin failed: {status} {step}")
    status, elevated, _ = api.call("POST", "/auth/mfa/verify", {"mfaToken": step["mfaToken"], "code": totp(secret)})
    if status != 200:
        raise SystemExit(f"step-up verify failed: {status} {elevated}")
    return elevated["accessToken"]


def account_balance_minor(account: dict) -> str | None:
    balance = account.get("balance") or {}
    value = balance.get("value") or {}
    for key in ("available", "posted", "ledger"):
        node = value.get(key)
        if isinstance(node, dict) and "minorUnits" in node:
            return str(node["minorUnits"])
    return None


def journey(api: Api, state_path: str) -> None:
    run = secrets.token_hex(4)
    email = f"acceptance+{run}@example.com"
    password = f"acceptance-{secrets.token_hex(8)}"
    terms = "sunrey-sandbox-terms-2026-11"

    status, reg, _ = api.call("POST", "/auth/register", {"email": email, "password": password, "termsVersion": terms})
    check("register creates customer", status == 201 and reg.get("kind") == "REGISTERED",
          {"status": status, "verification": reg.get("verification"), "production": reg.get("production")})
    customer_id = reg.get("customerId")

    status, dup, _ = api.call("POST", "/auth/register", {"email": email, "password": password, "termsVersion": terms})
    check("duplicate registration refused", status in (400, 409, 422), {"status": status, "code": dup.get("errorCode")})

    status, bad, _ = api.call("POST", "/auth/login", {"email": email, "password": "wrong-password-123"})
    check("wrong password refused", status == 401, {"status": status, "code": bad.get("errorCode")})

    status, login, _ = api.call("POST", "/auth/login", {"email": email, "password": password})
    low = login.get("accessToken")
    check("login issues LOW session", status == 200 and login.get("authenticationStrength") == "LOW",
          {"status": status, "strength": login.get("authenticationStrength")})

    status, session, _ = api.call("GET", "/auth/session", token=low)
    check("session bound to own customer", status == 200 and session.get("customerId") == customer_id
          and session.get("sandboxPersona") is None, {"status": status, "customerId": session.get("customerId")})

    status, refused, _ = api.call("POST", "/accounts", {"currency": "USD", "accountType": "CASH"}, low, idem=f"open-low-{run}")
    check("Kernel refuses account opening at LOW assurance", status in (401, 403, 409, 422) and status != 201,
          {"status": status, "code": refused.get("errorCode")})

    status, enroll, _ = api.call("POST", "/auth/mfa/enroll", {}, low)
    secret = enroll.get("secretBase32", "")
    status2, confirm, _ = api.call("POST", "/auth/mfa/enroll/confirm",
                                   {"enrollToken": enroll.get("enrollToken"), "code": totp(secret)}, low)
    check("TOTP enrollment with real wall-clock code", status == 200 and status2 == 200 and confirm.get("enrolled") is True,
          {"enroll": status, "confirm": status2})

    status, wrong_code, _ = api.call("POST", "/auth/mfa/step-up", {}, low)
    status_w, w, _ = api.call("POST", "/auth/mfa/verify", {"mfaToken": wrong_code.get("mfaToken"), "code": "000000"})
    check("wrong TOTP code refused", status_w == 401, {"status": status_w, "code": w.get("errorCode")})

    strong = strong_session(api, email, password, secret)
    status, mfa, _ = api.call("GET", "/auth/mfa/status", token=strong)
    check("step-up yields STRONG session", status == 200 and mfa.get("authenticationStrength") == "STRONG", mfa)

    idem_open = f"open-usd-{run}"
    status, opened, headers = api.call("POST", "/accounts", {"currency": "USD", "accountType": "CASH"}, strong, idem=idem_open)
    account_id = (opened.get("account") or {}).get("id") or opened.get("accountId") or opened.get("id")
    check("Kernel opens USD account at STRONG assurance", status == 201 and bool(account_id),
          {"status": status, "accountId": account_id, "authority": headers.get("x-sunrey-authority")})

    status, replay, headers = api.call("POST", "/accounts", {"currency": "USD", "accountType": "CASH"}, strong, idem=idem_open)
    replay_id = (replay.get("account") or {}).get("id") or replay.get("accountId") or replay.get("id")
    check("account opening is idempotent", status == 200 and replay_id == account_id
          and headers.get("x-sunrey-idempotent-replay") == "true", {"status": status, "replay": headers.get("x-sunrey-idempotent-replay")})

    idem_fund = f"fund-{run}"
    fund_body = {"accountId": account_id, "amountMinorUnits": "50000", "currency": "USD"}
    status, funded, _ = api.call("POST", "/sandbox/funding", fund_body, strong, idem=idem_fund)
    check("sandbox funding posts through Kernel", status in (200, 201), {"status": status, "body": {k: funded.get(k) for k in list(funded)[:6]}})
    status, refund, _ = api.call("POST", "/sandbox/funding", fund_body, strong, idem=idem_fund)
    check("duplicate funding submission replays", status in (200, 201), {"status": status})

    status, detail, _ = api.call("GET", f"/accounts/{account_id}", token=strong)
    balance = account_balance_minor(detail)
    check("ledger-derived balance equals one funding (no double credit)", status == 200 and balance == "50000",
          {"status": status, "balanceMinor": balance, "availability": (detail.get("balance") or {}).get("availability")})

    # Cross-customer isolation: a second customer must not read the first one's account.
    other_email = f"acceptance-other+{run}@example.com"
    api.call("POST", "/auth/register", {"email": other_email, "password": password, "termsVersion": terms})
    _, other_login, _ = api.call("POST", "/auth/login", {"email": other_email, "password": password})
    other = other_login.get("accessToken")
    status, peek, _ = api.call("GET", f"/accounts/{account_id}", token=other)
    check("other customer cannot read this account", status in (403, 404), {"status": status, "code": peek.get("errorCode")})
    status, other_list, _ = api.call("GET", "/accounts", token=other)
    check("other customer sees only own (empty) accounts", status == 200 and other_list.get("items") == [], {"status": status})

    status, out, _ = api.call("POST", "/auth/logout", {}, strong)
    status2, after, _ = api.call("GET", "/auth/session", token=strong)
    check("logout revokes the session", status == 200 and status2 == 401, {"logout": status, "after": status2, "code": after.get("errorCode")})

    with open(state_path, "w") as fh:
        json.dump({"email": email, "password": password, "secret": secret, "customerId": customer_id,
                   "accountId": account_id, "expectedBalanceMinor": "50000"}, fh)


def after_restart(api: Api, state_path: str) -> None:
    with open(state_path) as fh:
        state = json.load(fh)
    strong = strong_session(api, state["email"], state["password"], state["secret"])
    check("credentials and TOTP survive restart", bool(strong), {"customerId": state["customerId"]})
    status, session, _ = api.call("GET", "/auth/session", token=strong)
    check("customer binding survives restart", status == 200 and session.get("customerId") == state["customerId"],
          {"status": status, "customerId": session.get("customerId")})
    status, detail, _ = api.call("GET", f"/accounts/{state['accountId']}", token=strong)
    balance = account_balance_minor(detail)
    check("account and ledger balance survive restart", status == 200 and balance == state["expectedBalanceMinor"],
          {"status": status, "balanceMinor": balance})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", required=True)
    parser.add_argument("--origin", default=None, help="Origin header to send (exercises CORS allowlist)")
    parser.add_argument("--phase", choices=["journey", "after-restart"], required=True)
    parser.add_argument("--state", required=True)
    parser.add_argument("--report", default=None)
    args = parser.parse_args()
    api = Api(args.api, args.origin)
    (journey if args.phase == "journey" else after_restart)(api, args.state)
    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\n{passed}/{len(RESULTS)} checks passed")
    if args.report:
        with open(args.report, "w") as fh:
            json.dump({"phase": args.phase, "api": args.api, "results": RESULTS}, fh, indent=2)
    return 0 if passed == len(RESULTS) else 1


if __name__ == "__main__":
    sys.exit(main())
