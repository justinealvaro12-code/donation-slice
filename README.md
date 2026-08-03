# Donation Management System — Vertical Slice

## Module
Donation Management (ARGO Pre-Development Assessment). Full design docs are in `/docs`. This vertical slice implements the **Donation** entity end to end, including its dependency on **Donor**.

## Purpose
Prove a complete, secure, tenant-isolated slice of the Donation Management module: record a donation, confirm it (which issues a receipt and would recalculate a linked pledge if pledges were in this slice's scope), void an unconfirmed donation, or refund a confirmed one — all gated by platform authentication and RBAC.

## Technology Used
- **Backend:** Node.js, Express, PostgreSQL (`pg`), `jsonwebtoken`, `zod` for validation
- **Frontend:** React (Vite)
- **Tests:** Jest + Supertest (integration tests against a real Postgres test database)

## Scope of This Slice (see `/docs/SCOPING.md` for full module scope)
Included: Donor (minimal — create/list/get) and Donation (full lifecycle: create, view, confirm, void, refund) with receipt auto-issuance on confirm.
**Not included in this slice** (documented in the full design docs, out of scope here to keep the slice complete-but-small per the assessment's own guidance): Campaigns, Pledges, in-kind donations. The `donations` table's schema in this slice omits `campaign_id`/`pledge_id` for that reason — see the migration comments.

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ running locally (or update `DATABASE_URL`)

### 1. Install dependencies
```bash
cd backend
npm install
```
(Frontend, optional for defense demo:)
```bash
cd frontend
npm install
```

### 2. Configure environment
```bash
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL to a real database, e.g.
# postgres://postgres:postgres@localhost:5432/donation_management
# Create that database first: createdb donation_management
```

## Migration Instructions
```bash
cd backend
npm run migrate
```
This runs every file in `/backend/migrations` in order. `000_platform_stub.sql` creates `organizations`/`users` tables that stand in for ARGO's real platform-owned tables — see the comment at the top of that file. `001`–`003` create this module's actual tables (`donors`, `donations`, `receipts`).

## Seed Data (for manual testing / demo)
```bash
npm run seed
```
Creates two organizations (Org A, Org B), one user per role in each (`viewer`, `fundraising_staff`, `finance_staff`, `manager`, `administrator`), and prints ready-to-use JWTs for each — copy one into the frontend's token field, or use directly with `curl`/Postman as a `Bearer` token.

## How to Run the Application
```bash
cd backend
npm run dev        # starts API on http://localhost:4000
```
```bash
cd frontend
npm run dev         # starts UI on http://localhost:5173
```
Paste a JWT from the seed output into the token field in the UI to authenticate.

## How to Run the Tests
```bash
cd backend
# Point DATABASE_URL at a dedicated TEST database (tests insert real rows) and migrate it first:
npm run migrate
npm test
```
> **Honesty note:** these tests are written and syntax-checked (`node --check` passed on every file), but this environment doesn't have network access to install npm packages or run Postgres, so the suite has not been executed end-to-end here. Run `npm test` in your own environment before the defense to confirm actual pass/fail — don't take "written" as "verified."

### Test coverage
- **Mandatory Security Test 1 — Cross-Tenant Isolation:** Org B cannot view, confirm, or list a donation/donor belonging to Org A (`404`, not `403`, per the anti-enumeration design in `/docs/THREAT_MODEL.md`).
- **Mandatory Security Test 2 — RBAC Denial:** a `viewer` role cannot create or confirm a donation (`403`); the state is confirmed unchanged after the denied attempt, not just the HTTP status.
- State machine guards: no double-confirm, no refund of a never-confirmed donation.
- Confirm → receipt issuance happens atomically.
- Validation: negative amounts rejected; client-submitted `organization_id`/`status` on create are ignored, not honored (mass-assignment defense).
- Cross-donor pledge/tenant reference guard: a donation cannot reference a donor from another organization.

## Test Accounts / Sample Roles
Seed script creates, per organization: `viewer`, `fundraising_staff`, `finance_staff`, `manager`, `administrator` — matching `/docs/RBAC_MATRIX.md` exactly. Emails follow the pattern `<role>@orgA.example.com` / `<role>@orgB.example.com`; JWTs are printed to stdout by `npm run seed`.

## Known Limitations
- Campaigns and Pledges are designed (see `/docs/ERD.md`, `/docs/WORKFLOW.md`) but not implemented in this slice — donations here are standalone gifts, not linked to a campaign or pledge.
- Receipt issuance is a side effect of `donation.confirm` only; there's no standalone `receipt.issue` endpoint (see the design-decision note in `/docs/API_CONTRACT.md`).
- No real platform JWT issuance — this slice verifies JWTs signed with a shared dev secret (`JWT_SECRET`) to simulate what ARGO's platform would issue; production integration would consume ARGO's actual signing key/JWKS.
- Not executed end-to-end in the authoring environment (see the honesty note under Tests above) — verify locally before the defense.
