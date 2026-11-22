from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import smtplib
import sqlite3
import time
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "TALVORA API"
    environment: str = "development"
    database_path: str = "./talvora.db"
    jwt_secret: str = "development-only-change-me"
    jwt_expire_minutes: int = 1440
    # `null` supports the current local file:// preview only; remove it in production.
    frontend_origins: str = "http://localhost:4173,http://127.0.0.1:4173,http://localhost:4174,http://127.0.0.1:4174,http://localhost:3000,null"
    admin_email: EmailStr = "admin@talvora.com"
    admin_password: str = "change-this-immediately"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "no-reply@talvora.com"
    smtp_from_name: str = "TALVORA"
    default_currency: str = "USD"
    payment_mode: str = "disabled"
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_webhook_id: str = ""
    mpesa_consumer_key: str = ""
    mpesa_consumer_secret: str = ""
    mpesa_shortcode: str = ""
    bank_payout_provider_url: str = ""
    bank_payout_provider_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
app = FastAPI(title=settings.app_name, version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.frontend_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
bearer = HTTPBearer(auto_error=False)


def db_path() -> str:
    path = Path(settings.database_path)
    if not path.is_absolute():
        path = Path(__file__).resolve().parent / path
    path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)


def connection() -> sqlite3.Connection:
    db = sqlite3.connect(db_path(), timeout=30)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def init_db() -> None:
    with connection() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
            portal TEXT NOT NULL CHECK (portal IN ('employer','employee','admin')),
            first_name TEXT NOT NULL, last_name TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id),
            code TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS company_members (
            company_id TEXT NOT NULL REFERENCES companies(id), user_id TEXT NOT NULL REFERENCES users(id),
            role TEXT NOT NULL DEFAULT 'member', PRIMARY KEY(company_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS invitations (
            id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), email TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY, channel TEXT NOT NULL CHECK(channel IN ('admin','workplace')),
            sender_id TEXT NOT NULL REFERENCES users(id), text TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
            title TEXT NOT NULL, reference TEXT, employment_type TEXT NOT NULL,
            department TEXT, work_mode TEXT, location_id TEXT, category TEXT,
            vacancies INTEGER NOT NULL DEFAULT 1, salary_currency TEXT NOT NULL DEFAULT 'USD',
            salary_min REAL, salary_max REAL, application_deadline TEXT,
            description TEXT NOT NULL, requirements TEXT, status TEXT NOT NULL DEFAULT 'draft',
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_channel_created ON chat_messages(channel, created_at);
        CREATE TABLE IF NOT EXISTS payment_transactions (
            id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), company_id TEXT REFERENCES companies(id),
            direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
            transaction_type TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
            currency TEXT NOT NULL DEFAULT 'USD', provider TEXT NOT NULL DEFAULT 'internal',
            provider_reference TEXT, status TEXT NOT NULL DEFAULT 'pending', description TEXT,
            idempotency_key TEXT UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ledger_entries (
            id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES payment_transactions(id),
            account TEXT NOT NULL, entry_type TEXT NOT NULL CHECK(entry_type IN ('debit','credit')),
            amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0), currency TEXT NOT NULL DEFAULT 'USD', created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS payout_requests (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), company_id TEXT REFERENCES companies(id),
            rail TEXT NOT NULL CHECK(rail IN ('paypal','mpesa','bank')), destination_reference TEXT NOT NULL,
            amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), currency TEXT NOT NULL DEFAULT 'USD',
            status TEXT NOT NULL DEFAULT 'pending', provider_reference TEXT, idempotency_key TEXT UNIQUE,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS webhook_events (
            id TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_event_id TEXT NOT NULL,
            payload_hash TEXT NOT NULL, processed_at TEXT, created_at TEXT NOT NULL,
            UNIQUE(provider, provider_event_id)
        );
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(created_at);
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_company ON payment_transactions(company_id, created_at);
        """)
        admin = db.execute("SELECT id FROM users WHERE email = ?", (str(settings.admin_email).lower(),)).fetchone()
        if not admin and settings.environment == "development":
            db.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, datetime('now'))", (
                "admin-development", str(settings.admin_email).lower(), hash_password(settings.admin_password),
                "admin", "Platform", "Admin"))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240_000)
    return base64.urlsafe_b64encode(salt + digest).decode()


def verify_password(password: str, encoded: str) -> bool:
    try:
        raw = base64.urlsafe_b64decode(encoded.encode())
        return hmac.compare_digest(hashlib.pbkdf2_hmac("sha256", password.encode(), raw[:16], 240_000), raw[16:])
    except (ValueError, TypeError):
        return False


def token_for(user: sqlite3.Row) -> str:
    header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({"sub": user["id"], "portal": user["portal"], "exp": int(time.time()) + settings.jwt_expire_minutes * 60}, separators=(",", ":")).encode()).decode().rstrip("=")
    body = f"{header}.{payload}"
    signature = base64.urlsafe_b64encode(hmac.new(settings.jwt_secret.encode(), body.encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return f"{body}.{signature}"


def public_user(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "email": row["email"], "portal": row["portal"], "firstName": row["first_name"], "lastName": row["last_name"]}


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> sqlite3.Row:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        header, payload, signature = credentials.credentials.split(".")
        body = f"{header}.{payload}"
        expected = base64.urlsafe_b64encode(hmac.new(settings.jwt_secret.encode(), body.encode(), hashlib.sha256).digest()).decode().rstrip("=")
        if not hmac.compare_digest(expected, signature):
            raise ValueError
        data = json.loads(base64.urlsafe_b64decode(payload + "=="))
        if int(data["exp"]) < int(time.time()):
            raise ValueError
    except (ValueError, KeyError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    with connection() as db:
        user = db.execute("SELECT * FROM users WHERE id = ?", (data["sub"],)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User account not found")
    return user


class AuthPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    firstName: str = Field(min_length=1, max_length=80)
    lastName: str = Field(min_length=1, max_length=80)
    companyName: str | None = Field(default=None, max_length=160)
    invitationCode: str | None = None


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class ChatPayload(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class InvitePayload(BaseModel):
    email: EmailStr


class PayoutPayload(BaseModel):
    rail: Literal["paypal", "mpesa", "bank"]
    destinationReference: str = Field(min_length=3, max_length=240)
    amount: float = Field(gt=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    idempotencyKey: str = Field(min_length=8, max_length=120)


def register(portal: Literal["employer", "employee"], payload: AuthPayload) -> dict[str, Any]:
    email = str(payload.email).lower()
    user_id = secrets.token_urlsafe(16)
    now = "datetime('now')"
    with connection() as db:
        if db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone():
            raise HTTPException(409, "An account with this email already exists")
        db.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, datetime('now'))", (user_id, email, hash_password(payload.password), portal, payload.firstName.strip(), payload.lastName.strip()))
        if portal == "employer":
            company_name = (payload.companyName or "").strip()
            if not company_name:
                raise HTTPException(422, "companyName is required for Employer registration")
            company_id = secrets.token_urlsafe(12)
            code = secrets.token_hex(4).upper()
            db.execute("INSERT INTO companies VALUES (?, ?, ?, ?, datetime('now'))", (company_id, company_name, user_id, code))
            db.execute("INSERT INTO company_members VALUES (?, ?, 'owner')", (company_id, user_id))
        elif payload.invitationCode:
            invite = db.execute("SELECT * FROM invitations WHERE token = ? AND status = 'pending'", (payload.invitationCode,)).fetchone()
            if invite:
                db.execute("INSERT OR IGNORE INTO company_members VALUES (?, ?, 'member')", (invite["company_id"], user_id))
                db.execute("UPDATE invitations SET status = 'accepted' WHERE id = ?", (invite["id"],))
        user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"accessToken": token_for(user), "user": public_user(user)}


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.get("/")
def api_root() -> dict[str, str]:
    """Make a directly opened API deployment self-describing instead of 404."""
    return {"service": settings.app_name, "status": "ok", "docs": "/docs", "health": "/health"}


def require_admin(credentials: HTTPAuthorizationCredentials | None) -> sqlite3.Row | None:
    if settings.environment == "development" and not credentials:
        return None
    user = current_user(credentials)
    if user["portal"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user


@app.get("/api/v1/auth/session")
def admin_compat_session(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    # The existing Admin directory pages use the v1 session contract. Local
    # development keeps those pages directly open; production requires a token.
    user = require_admin(credentials)
    if user is None:
        return {"authenticated": True, "user": {"id": "admin-development", "role": "super_admin", "displayName": "Super Admin"}, "csrfToken": None}
    return {"authenticated": True, "user": {"id": user["id"], "role": "super_admin", "displayName": f"{user['first_name']} {user['last_name']}"}, "csrfToken": None}


def admin_page(page: int, limit: int) -> tuple[int, int, int]:
    safe_page = max(1, page)
    safe_limit = min(100, max(1, limit))
    return safe_page, safe_limit, (safe_page - 1) * safe_limit


def company_for_user(company_id: str, user: sqlite3.Row) -> sqlite3.Row:
    with connection() as db:
        company = db.execute("SELECT c.* FROM companies c JOIN company_members m ON m.company_id=c.id WHERE c.id=? AND m.user_id=?", (company_id, user["id"])).fetchone()
    if not company:
        raise HTTPException(404, "Organization not found")
    return company


def cents_to_amount(cents: int | None) -> float:
    return round((int(cents or 0) / 100), 2)


def payment_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "reference": row["provider_reference"] or row["id"],
        "providerReference": row["provider_reference"],
        "direction": row["direction"],
        "type": row["transaction_type"],
        "description": row["description"] or row["transaction_type"].replace("_", " ").title(),
        "amount": cents_to_amount(row["amount_cents"]),
        "currency": row["currency"],
        "provider": row["provider"],
        "status": row["status"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "companyId": row["company_id"],
        "userId": row["user_id"],
    }


def payment_provider_configured() -> bool:
    return settings.payment_mode.lower() in {"sandbox", "live"} and bool(
        (settings.paypal_client_id and settings.paypal_client_secret)
        or (settings.mpesa_consumer_key and settings.mpesa_consumer_secret and settings.mpesa_shortcode)
        or (settings.bank_payout_provider_url and settings.bank_payout_provider_key)
    )


def require_provider() -> None:
    if not payment_provider_configured():
        raise HTTPException(503, "Payment provider is not configured. Add verified provider credentials before enabling money movement.")


def billing_company(company_id: str, user: sqlite3.Row) -> sqlite3.Row:
    if user["portal"] != "employer":
        raise HTTPException(403, "Employer access required")
    return company_for_user(company_id, user)


@app.get("/api/v1/admin/finance/overview")
def admin_finance_overview(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    require_admin(credentials)
    with connection() as db:
        gross = db.execute("SELECT COALESCE(SUM(amount_cents),0) AS value FROM payment_transactions WHERE direction='inbound' AND status='succeeded'").fetchone()["value"]
        refunds = db.execute("SELECT COALESCE(SUM(amount_cents),0) AS value FROM payment_transactions WHERE transaction_type='refund' AND status='succeeded'").fetchone()["value"]
        fees = db.execute("SELECT COALESCE(SUM(amount_cents),0) AS value FROM payment_transactions WHERE transaction_type IN ('platform_fee','revenue') AND status='succeeded'").fetchone()["value"]
        pending = db.execute("SELECT COALESCE(SUM(amount_cents),0) AS value FROM payment_transactions WHERE status IN ('pending','processing')").fetchone()["value"]
        count = db.execute("SELECT COUNT(*) AS value FROM payment_transactions").fetchone()["value"]
    currency = settings.default_currency.upper()
    return {"overview": {"currency": currency, "asOf": datetime.now(timezone.utc).isoformat(), "availableCurrencies": [currency], "availableTransactionTypes": ["charge", "transfer", "payout", "refund", "platform_fee", "revenue"], "metrics": {"grossRevenue": cents_to_amount(gross), "netRevenue": cents_to_amount(gross - refunds - fees), "pendingSettlements": cents_to_amount(pending), "refundsTotal": cents_to_amount(refunds), "platformFees": cents_to_amount(fees), "transactionCount": count}, "revenueTrend": [], "revenueBySource": [], "revenueByCountry": [], "paymentProviders": [{"name": "PayPal", "status": "configured" if settings.paypal_client_id else "not_configured"}, {"name": "M-PESA", "status": "configured" if settings.mpesa_consumer_key else "not_configured"}, {"name": "Bank payout provider", "status": "configured" if settings.bank_payout_provider_url else "not_configured"}]}}


@app.get("/api/v1/admin/finance/transactions")
def admin_finance_transactions(page: int = 1, pageSize: int = 25, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    require_admin(credentials)
    page, limit, offset = admin_page(page, pageSize)
    with connection() as db:
        total = db.execute("SELECT COUNT(*) AS total FROM payment_transactions").fetchone()["total"]
        rows = db.execute("SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)).fetchall()
    return {"items": [payment_row(row) for row in rows], "pagination": {"page": page, "pageSize": limit, "total": total, "totalPages": max(1, (total + limit - 1) // limit)}}


@app.get("/api/v1/admin/finance/invoices")
def admin_finance_invoices(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    require_admin(credentials)
    return {"items": [], "pagination": {"page": 1, "pageSize": 25, "total": 0, "totalPages": 1}}


@app.get("/api/v1/admin/finance/refunds")
def admin_finance_refunds(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    require_admin(credentials)
    with connection() as db:
        rows = db.execute("SELECT * FROM payment_transactions WHERE transaction_type='refund' ORDER BY created_at DESC").fetchall()
    return {"items": [payment_row(row) for row in rows], "pagination": {"page": 1, "pageSize": 25, "total": len(rows), "totalPages": 1}}


@app.get("/api/v1/admin/finance/reconciliation/runs")
def admin_finance_reconciliation(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    require_admin(credentials)
    return {"items": [], "pagination": {"page": 1, "pageSize": 25, "total": 0, "totalPages": 1}}


@app.get("/api/v1/admin/finance/reports")
def admin_finance_reports(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    require_admin(credentials)
    return {"items": [], "reports": [], "currency": settings.default_currency.upper()}


@app.get("/api/employer/companies/{company_id}/billing/invoices")
def employer_billing_invoices(company_id: str, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    billing_company(company_id, user)
    return {"data": {"invoices": []}}


@app.get("/api/employer/companies/{company_id}/billing/transactions")
def employer_billing_transactions(company_id: str, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    billing_company(company_id, user)
    with connection() as db:
        rows = db.execute("SELECT * FROM payment_transactions WHERE company_id=? ORDER BY created_at DESC", (company_id,)).fetchall()
    return {"data": {"transactions": [payment_row(row) for row in rows]}}


@app.get("/api/employer/companies/{company_id}/billing/payment-methods")
def employer_payment_methods(company_id: str, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    billing_company(company_id, user)
    return {"data": {"paymentMethods": []}}


@app.get("/api/employer/companies/{company_id}/billing/subscription")
def employer_subscription(company_id: str, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    billing_company(company_id, user)
    return {"data": {"subscription": {"status": "not_configured", "currency": settings.default_currency.upper()}}}


@app.get("/api/employer/companies/{company_id}/billing/account")
def employer_billing_account(company_id: str, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    company = billing_company(company_id, user)
    return {"data": {"account": {"legalName": company["name"], "billingEmail": user["email"], "country": "", "currency": settings.default_currency.upper()}}}


@app.post("/api/employer/companies/{company_id}/billing/invoices/{invoice_id}/checkout")
def employer_invoice_checkout(company_id: str, invoice_id: str, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    billing_company(company_id, user)
    require_provider()
    raise HTTPException(501, "Provider checkout adapter is not enabled yet")


@app.post("/api/employer/companies/{company_id}/billing/payment-methods/setup")
def employer_payment_method_setup(company_id: str, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    billing_company(company_id, user)
    require_provider()
    raise HTTPException(501, "Provider payment-method adapter is not enabled yet")


@app.post("/api/v1/admin/finance/payouts")
def request_admin_payout(payload: PayoutPayload, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    admin = require_admin(credentials)
    require_provider()
    currency = payload.currency.upper()
    if currency != settings.default_currency.upper():
        raise HTTPException(422, f"Only {settings.default_currency.upper()} payouts are enabled")
    amount_cents = round(payload.amount * 100)
    payout_id = secrets.token_urlsafe(14)
    now = datetime.now(timezone.utc).isoformat()
    with connection() as db:
        try:
            db.execute("INSERT INTO payout_requests VALUES (?, ?, NULL, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?)", (payout_id, admin["id"] if admin else "admin-development", payload.rail, payload.destinationReference, amount_cents, currency, payload.idempotencyKey, now, now))
        except sqlite3.IntegrityError:
            existing = db.execute("SELECT * FROM payout_requests WHERE idempotency_key=?", (payload.idempotencyKey,)).fetchone()
            if existing:
                return {"data": {"payout": dict(existing), "replayed": True}}
            raise HTTPException(409, "A payout with this idempotency key already exists")
    return {"data": {"payout": {"id": payout_id, "rail": payload.rail, "amount": payload.amount, "currency": currency, "status": "pending", "message": "Payout queued for provider verification"}}}


@app.post("/api/payments/webhooks/{provider}")
def payment_webhook(provider: str, payload: dict[str, Any]) -> dict[str, Any]:
    # Provider-specific signature verification and event mapping must be added
    # before enabling this endpoint in production. Never trust browser claims.
    if not payment_provider_configured():
        raise HTTPException(503, "Payment webhooks are disabled until a provider is configured")
    raise HTTPException(501, f"Webhook adapter for {provider} is not enabled")


@app.get("/api/employee/dashboard")
def employee_dashboard(user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    if user["portal"] != "employee":
        raise HTTPException(403, "Employee access required")
    profile = {"firstName": user["first_name"], "lastName": user["last_name"], "preferredName": user["first_name"], "lifecycleStatus": "Account active", "profileCompletion": 0}
    return {"profile": profile, "applications": [], "interviews": [], "offers": [], "jobs": [], "onboarding": [], "activity": [], "skillsCount": 0}


@app.get("/api/employer/companies/{company_id}/locations")
def employer_locations(company_id: str, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    if user["portal"] != "employer":
        raise HTTPException(403, "Employer access required")
    company_for_user(company_id, user)
    return {"data": {"locations": []}}


@app.get("/api/employer/companies/{company_id}/jobs")
def employer_jobs(company_id: str, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    if user["portal"] != "employer":
        raise HTTPException(403, "Employer access required")
    company_for_user(company_id, user)
    with connection() as db:
        rows = db.execute("SELECT * FROM jobs WHERE company_id=? ORDER BY created_at DESC", (company_id,)).fetchall()
    return {"data": {"jobs": [dict(row) for row in rows]}}


@app.post("/api/employer/companies/{company_id}/jobs")
def create_employer_job(company_id: str, payload: dict[str, Any], user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    if user["portal"] != "employer":
        raise HTTPException(403, "Employer access required")
    company_for_user(company_id, user)
    required = ["title", "employmentType", "description"]
    if any(not str(payload.get(key, "")).strip() for key in required):
        raise HTTPException(422, "Title, employment type and description are required")
    now = datetime.now(timezone.utc).isoformat()
    job_id = secrets.token_urlsafe(12)
    with connection() as db:
        db.execute("INSERT INTO jobs (id,company_id,title,reference,employment_type,department,work_mode,location_id,category,vacancies,salary_currency,salary_min,salary_max,application_deadline,description,requirements,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (job_id, company_id, str(payload["title"]).strip(), payload.get("reference"), str(payload["employmentType"]), payload.get("department"), payload.get("workMode"), payload.get("locationId"), payload.get("category"), int(payload.get("vacancies") or 1), str(payload.get("salaryCurrency") or "USD").upper(), payload.get("salaryMin") or None, payload.get("salaryMax") or None, payload.get("applicationDeadline") or None, str(payload["description"]).strip(), payload.get("requirements"), str(payload.get("status") or "draft"), now, now))
        job = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
    return {"data": {"job": dict(job)}}


@app.get("/api/v1/admin/employees")
def admin_employees(page: int = 1, limit: int = 20, search: str = "", status: str = "", sort: str = "", credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    require_admin(credentials)
    page, limit, offset = admin_page(page, limit)
    term = f"%{search.strip().lower()}%"
    where = "WHERE portal='employee' AND (?='' OR lower(first_name || ' ' || last_name) LIKE ? OR lower(email) LIKE ?)"
    params: list[Any] = [search.strip(), term, term]
    with connection() as db:
        total = db.execute(f"SELECT COUNT(*) AS total FROM users {where}", params).fetchone()["total"]
        rows = db.execute(f"SELECT id,email,first_name,last_name,created_at FROM users {where} ORDER BY created_at DESC LIMIT ? OFFSET ?", [*params, limit, offset]).fetchall()
    items = [{"id": r["id"], "displayName": f"{r['first_name']} {r['last_name']}", "email": r["email"], "status": "active", "declaredLocation": "Not provided", "createdAt": r["created_at"], "lastActiveAt": r["created_at"]} for r in rows]
    total_pages = max(1, (total + limit - 1) // limit)
    return {"items": items, "summary": {"total": total, "active": total, "verified": 0, "pending": 0, "suspended": 0, "restricted": 0}, "pagination": {"page": page, "limit": limit, "total": total, "totalPages": total_pages}}


@app.get("/api/v1/admin/employers")
def admin_employers(page: int = 1, limit: int = 20, search: str = "", status: str = "", verification: str = "", sort: str = "", credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    require_admin(credentials)
    page, limit, offset = admin_page(page, limit)
    term = f"%{search.strip().lower()}%"
    where = "WHERE u.portal='employer' AND (?='' OR lower(u.first_name || ' ' || u.last_name) LIKE ? OR lower(u.email) LIKE ? OR lower(COALESCE(c.name,'')) LIKE ?)"
    params: list[Any] = [search.strip(), term, term, term]
    with connection() as db:
        total = db.execute(f"SELECT COUNT(DISTINCT u.id) AS total FROM users u LEFT JOIN companies c ON c.owner_id=u.id {where}", params).fetchone()["total"]
        rows = db.execute(f"SELECT u.id,u.email,u.first_name,u.last_name,u.created_at,c.name AS company_name,c.code AS company_code FROM users u LEFT JOIN companies c ON c.owner_id=u.id {where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?", [*params, limit, offset]).fetchall()
    items = [{"id": r["id"], "name": r["company_name"] or f"{r['first_name']} {r['last_name']}", "contactName": f"{r['first_name']} {r['last_name']}", "contactEmail": r["email"], "email": r["email"], "companyCode": r["company_code"], "status": "active", "verificationStatus": "pending", "declaredLocation": "Not provided", "activeJobs": 0, "createdAt": r["created_at"]} for r in rows]
    total_pages = max(1, (total + limit - 1) // limit)
    return {"items": items, "summary": {"total": total, "active": total, "verified": 0, "pendingVerification": total, "suspended": 0, "restricted": 0}, "pagination": {"page": page, "limit": limit, "total": total, "totalPages": total_pages}}


@app.get("/api/v1/admin/dashboard")
def admin_dashboard(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    # The existing local Admin portal intentionally opens without a login screen.
    # Keep that behavior only in development; production requires an Admin JWT.
    require_admin(credentials)
    with connection() as db:
        employees = db.execute("SELECT COUNT(*) AS total FROM users WHERE portal='employee'").fetchone()["total"]
        employers = db.execute("SELECT COUNT(*) AS total FROM users WHERE portal='employer'").fetchone()["total"]
        companies = db.execute("SELECT COUNT(*) AS total FROM companies").fetchone()["total"]
        chat_messages = db.execute("SELECT COUNT(*) AS total FROM chat_messages").fetchone()["total"]
    return {"totals": {"employees": employees, "employers": employers, "companies": companies, "activeJobs": 0, "applications": 0, "suspendedAccounts": 0, "openReports": 0}, "queues": {"employerVerifications": 0, "evidenceReviews": 0, "disputes": 0, "securityAlerts": 0, "supportRequests": 0}, "recentActivities": [], "activity": [], "meta": {"chatMessages": chat_messages}}


@app.post("/api/auth/{portal}/register")
def register_account(portal: Literal["employer", "employee"], payload: AuthPayload) -> dict[str, Any]:
    return {"data": register(portal, payload)}


@app.post("/api/auth/admin/login")
def admin_login(payload: LoginPayload) -> dict[str, Any]:
    with connection() as db:
        user = db.execute("SELECT * FROM users WHERE email = ? AND portal = 'admin'", (str(payload.email).lower(),)).fetchone()
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid administrator credentials")
    return {"data": {"accessToken": token_for(user), "user": public_user(user)}}


@app.post("/api/auth/{portal}/login")
def login(portal: Literal["employer", "employee"], payload: LoginPayload) -> dict[str, Any]:
    with connection() as db:
        user = db.execute("SELECT * FROM users WHERE email = ? AND portal = ?", (str(payload.email).lower(), portal)).fetchone()
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    return {"data": {"accessToken": token_for(user), "user": public_user(user)}}


@app.get("/api/auth/session")
def session(user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    return {"data": {"user": public_user(user)}}


@app.get("/api/employer/companies")
def employer_companies(user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    if user["portal"] != "employer": raise HTTPException(403, "Employer access required")
    with connection() as db:
        rows = db.execute("SELECT c.* FROM companies c JOIN company_members m ON m.company_id = c.id WHERE m.user_id = ?", (user["id"],)).fetchall()
    return {"data": {"companies": [{"id": r["id"], "name": r["name"], "code": r["code"]} for r in rows]}}


@app.get("/api/employer/dashboard")
def employer_dashboard(companyId: str | None = Query(default=None), user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    if user["portal"] != "employer": raise HTTPException(403, "Employer access required")
    with connection() as db:
        company = db.execute("SELECT c.* FROM companies c JOIN company_members m ON m.company_id=c.id WHERE m.user_id=? AND (? IS NULL OR c.id=?) LIMIT 1", (user["id"], companyId, companyId)).fetchone()
        if not company: raise HTTPException(404, "Company not found")
        employees = db.execute("SELECT COUNT(*) AS total FROM company_members WHERE company_id=?", (company["id"],)).fetchone()["total"]
    with connection() as db:
        job_total = db.execute("SELECT COUNT(*) AS total FROM jobs WHERE company_id=?", (company["id"],)).fetchone()["total"]
        published = db.execute("SELECT COUNT(*) AS total FROM jobs WHERE company_id=? AND status='published'", (company["id"],)).fetchone()["total"]
    stats = {"employees": max(0, employees - 1), "activeJobs": published, "totalJobs": job_total, "applications": 0, "interviews": 0}
    return {"data": {"company": {"id": company["id"], "name": company["name"], "code": company["code"]}, "stats": stats, "totalJobs": job_total, "activeJobs": published, "totalApplications": 0, "totalEmployees": max(0, employees - 1), "pendingApplications": 0, "interviewsScheduled": 0, "user": {"name": f"{user['first_name']} {user['last_name']}", "role": "owner"}}}


@app.post("/api/employer/companies/{company_id}/invitations")
@app.post("/api/employer/companies/{company_id}/team/invitations")
def invite_employee(company_id: str, payload: InvitePayload, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    if user["portal"] != "employer": raise HTTPException(403, "Employer access required")
    token = secrets.token_urlsafe(18)
    with connection() as db:
        allowed = db.execute("SELECT 1 FROM company_members WHERE company_id=? AND user_id=? AND role='owner'", (company_id, user["id"])).fetchone()
        if not allowed: raise HTTPException(403, "Company owner access required")
        invite_id = secrets.token_urlsafe(12)
        db.execute("INSERT INTO invitations VALUES (?, ?, ?, ?, 'pending', datetime('now'))", (invite_id, company_id, str(payload.email).lower(), token))
        company = db.execute("SELECT name FROM companies WHERE id=?", (company_id,)).fetchone()
    send_email(str(payload.email), "You are invited to TALVORA", f"Join {company['name']} using invitation code: {token}")
    return {"data": {"id": invite_id, "email": str(payload.email).lower(), "invitationCode": token, "status": "pending"}}


@app.get("/api/employer/companies/{company_id}/team/members")
def team_members(company_id: str, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    if user["portal"] != "employer": raise HTTPException(403, "Employer access required")
    with connection() as db:
        allowed = db.execute("SELECT 1 FROM company_members WHERE company_id=? AND user_id=?", (company_id, user["id"])).fetchone()
        if not allowed: raise HTTPException(403, "Company access required")
        rows = db.execute("SELECT u.id, u.email, u.first_name, u.last_name, m.role FROM company_members m JOIN users u ON u.id=m.user_id WHERE m.company_id=?", (company_id,)).fetchall()
        pending = db.execute("SELECT id, email, 'pending' AS status, 'member' AS role FROM invitations WHERE company_id=? AND status='pending'", (company_id,)).fetchall()
    members = [{"id": r["id"], "email": r["email"], "name": f"{r['first_name']} {r['last_name']}", "role": r["role"], "status": "active"} for r in rows]
    members.extend([{"id": r["id"], "email": r["email"], "name": "Pending invitation", "role": r["role"], "status": r["status"]} for r in pending])
    return {"data": {"members": members}}


@app.get("/api/employer/companies/{company_id}/team/roles")
def team_roles(company_id: str, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    if user["portal"] != "employer": raise HTTPException(403, "Employer access required")
    with connection() as db:
        allowed = db.execute("SELECT 1 FROM company_members WHERE company_id=? AND user_id=?", (company_id, user["id"])).fetchone()
    if not allowed: raise HTTPException(403, "Company access required")
    return {"data": {"roles": [{"id": "owner", "name": "Owner", "description": "Full organization access"}, {"id": "member", "name": "Member", "description": "Standard organization access"}]}}


@app.get("/api/chat/{channel}")
def get_chat(channel: Literal["admin", "workplace"], user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    if channel == "workplace" and user["portal"] not in ("employer", "employee", "admin"): raise HTTPException(403, "Workplace chat is for Employer and Employee accounts")
    with connection() as db:
        rows = db.execute("SELECT m.*, u.first_name, u.last_name, u.portal FROM chat_messages m JOIN users u ON u.id=m.sender_id WHERE channel=? ORDER BY m.created_at", (channel,)).fetchall()
    return {"data": {"messages": [{"id": r["id"], "senderId": r["sender_id"], "senderName": f"{r['first_name']} {r['last_name']}", "senderPortal": r["portal"], "text": r["text"], "createdAt": r["created_at"]} for r in rows]}}


@app.post("/api/chat/{channel}")
def post_chat(channel: Literal["admin", "workplace"], payload: ChatPayload, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    if channel == "workplace" and user["portal"] not in ("employer", "employee"): raise HTTPException(403, "Workplace chat is for Employer and Employee accounts")
    message_id = secrets.token_urlsafe(16)
    with connection() as db:
        db.execute("INSERT INTO chat_messages VALUES (?, ?, ?, ?, datetime('now'))", (message_id, channel, user["id"], payload.text.strip()))
        row = db.execute("SELECT * FROM chat_messages WHERE id=?", (message_id,)).fetchone()
    return {"data": {"id": row["id"], "senderId": user["id"], "text": row["text"], "createdAt": row["created_at"]}}


@app.get("/api/admin/chat/threads")
def admin_chat(user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    if user["portal"] != "admin": raise HTTPException(403, "Admin access required")
    return {"data": {"admin": get_chat("admin", user)["data"]["messages"], "workplace": get_chat("workplace", user)["data"]["messages"]}}


def send_email(to: str, subject: str, body: str) -> None:
    if not settings.smtp_host: return
    message = EmailMessage(); message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"; message["To"] = to; message["Subject"] = subject; message.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls();
        if settings.smtp_username: server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)
