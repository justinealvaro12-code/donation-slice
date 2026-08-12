# API_CONTRACT.md — Donation Management System

## Conventions (apply to every endpoint below)
- All routes require a valid platform JWT. `organization_id` is **always** derived server-side from the token — never accepted from body, query, param, or header.
- All `id` values are server-generated UUIDv4.
- All list endpoints support pagination (`page`, `page_size`), and default to `deleted_at IS NULL`.
- All mutating endpoints (`POST`/`PATCH`/`DELETE`) require the listed permission; a user without it always receives `403`, regardless of whether the record exists (see Threat Model for the "existence leak" nuance on 403 vs 404).
- All server-controlled fields (`id`, `organization_id`, `created_at`, `created_by`, `updated_at`, `updated_by`, `status` where noted, `amount_fulfilled`) are stripped from client input and stamped by the backend — never trusted from the request body even if present.
- Standard error shape: `{ "error": { "code": "...", "message": "...", "fields": { ... } } }`.

---

## 1. Donors

### `POST /api/donors`
**Purpose:** Create a donor record.
**Permission:** `donor.create`
**Request body:**
```json
{ "donor_type": "individual|organization", "display_name": "string", "email": "string?", "phone": "string?", "address": "string?" }
```
**Validation:** `display_name` required, 1–255 chars. `donor_type` must be a valid enum. `email` must be valid format if present; must be unique per organization among non-deleted donors.
**Responses:** `201` created (returns full donor object) · `400` malformed JSON · `409` duplicate email in org · `422` validation failed.

### `GET /api/donors`
**Purpose:** List donors for the current organization.
**Permission:** `donor.view`
**Query params:** `page`, `page_size`, `search` (name/email), `status`.
**Responses:** `200` paginated list · `400` invalid query params.

### `GET /api/donors/:id`
**Purpose:** Get one donor.
**Permission:** `donor.view`
**Responses:** `200` donor object · `404` not found or belongs to another org (identical response — see Threat Model).

### `PATCH /api/donors/:id`
**Purpose:** Update donor details.
**Permission:** `donor.update`
**Request body:** any subset of `display_name`, `email`, `phone`, `address`, `status`.
**Validation:** same as create for fields present; email uniqueness re-checked if changed.
**Responses:** `200` updated object · `403` no permission · `404` not found/cross-org · `409` duplicate email · `422` validation failed.

### `DELETE /api/donors/:id`
**Purpose:** Soft-delete a donor.
**Permission:** `donor.delete`
**Guard:** blocked if donor has any non-cancelled pledges or non-void donations (`409`) — prevents orphaning financial history.
**Responses:** `204` deleted · `403` no permission · `404` not found/cross-org · `409` has active financial records.

---

## 2. Campaigns

### `POST /api/campaigns`
**Purpose:** Create a campaign.
**Permission:** `campaign.create`
**Request body:** `{ "name": "string", "description": "string?", "goal_amount": "decimal", "start_date": "date", "end_date": "date?" }`
**Validation:** `name` required; `goal_amount > 0`; `end_date >= start_date` if present. `status` forced to `draft` server-side regardless of input.
**Responses:** `201` created · `400` malformed · `422` validation failed.

### `GET /api/campaigns`
**Permission:** `campaign.view`
**Query params:** `page`, `page_size`, `status`, `search`.
**Responses:** `200` paginated list.

### `GET /api/campaigns/:id`
**Permission:** `campaign.view`
**Responses:** `200` campaign object (includes rolled-up totals: pledged, raised) · `404` not found/cross-org.

### `PATCH /api/campaigns/:id`
**Purpose:** Edit campaign details (not status — see transition endpoints).
**Permission:** `campaign.update`
**Validation:** same field rules as create; rejects direct `status` writes (ignored, not erroed, to avoid leaking whether the field is protected — logged as an anomaly).
**Responses:** `200` updated · `403` · `404` · `422`.

### `POST /api/campaigns/:id/activate`
**Purpose:** Transition `draft → active`.
**Permission:** `campaign.activate`
**Guard:** campaign must currently be `draft`.
**Responses:** `200` updated campaign · `403` · `404` · `409` invalid transition.

### `POST /api/campaigns/:id/close`
**Purpose:** Transition `active → closed`.
**Permission:** `campaign.close`
**Guard:** campaign must currently be `active`.
**Responses:** `200` · `403` · `404` · `409` invalid transition.

---

## 3. Pledges

### `POST /api/pledges`
**Purpose:** Record a donor's commitment to give.
**Permission:** `pledge.create`
**Request body:** `{ "donor_id": "uuid", "campaign_id": "uuid?", "amount_pledged": "decimal", "pledge_date": "date", "due_date": "date?", "notes": "string?" }`
**Validation:** `donor_id` must exist and belong to caller's org (else `404`, not `400` — avoids confirming existence across orgs). `campaign_id`, if present, same rule. `amount_pledged > 0`. `amount_fulfilled` and `status` ignored if sent by client — always initialized to `0` / `pledged`.
**Responses:** `201` created · `400` malformed · `404` donor/campaign not found or cross-org · `422` validation failed.

### `GET /api/pledges`
**Permission:** `pledge.view`
**Query params:** `page`, `page_size`, `donor_id`, `campaign_id`, `status`.
**Responses:** `200` paginated list.

### `GET /api/pledges/:id`
**Permission:** `pledge.view`
**Responses:** `200` pledge object (includes linked donations summary) · `404` not found/cross-org.

### `PATCH /api/pledges/:id`
**Purpose:** Edit non-financial pledge fields (`due_date`, `notes`) only.
**Permission:** `pledge.update`
**Validation:** rejects `amount_pledged`, `amount_fulfilled`, `status`, `donor_id` changes (ignored server-side, request still succeeds for allowed fields, anomaly logged).
**Responses:** `200` · `403` · `404` · `422`.

### `POST /api/pledges/:id/cancel`
**Purpose:** Transition pledge to `cancelled`.
**Permission:** `pledge.cancel`
**Guard:** blocked if pledge has any `confirmed` donations already linked (`409`) — a partially/fully honored pledge cannot be cancelled outright.
**Responses:** `200` · `403` · `404` · `409` invalid transition.

---

## 4. Donations *(vertical slice entity)*

### `POST /api/donations`
**Purpose:** Record a new donation (starts as `pending`).
**Permission:** `donation.create`
**Request body:**
```json
{
  "donor_id": "uuid",
  "campaign_id": "uuid?",
  "pledge_id": "uuid?",
  "amount": "decimal",
  "payment_channel": "cash|check|bank_transfer|card|online|other",
  "payment_reference": "string?",
  "donation_date": "date"
}
```
**Validation:**
- `donor_id` required, must exist in caller's org → else `404`.
- `campaign_id`, if present, must exist in caller's org → else `404`.
- `pledge_id`, if present: must exist in caller's org, **and** `pledge.donor_id` must equal the submitted `donor_id` → else `404` (treated as "not found" rather than `400`, so a mismatched pledge doesn't confirm another donor's pledge exists).
- `amount > 0`.
- `payment_channel` must be a valid enum value.
- `status`, `organization_id`, `created_by` etc. ignored if sent — server-stamped.
**Responses:** `201` created (status `pending`) · `400` malformed · `404` donor/campaign/pledge not found, cross-org, or pledge/donor mismatch · `422` validation failed.

### `GET /api/donations`
**Permission:** `donation.view`
**Query params:** `page`, `page_size`, `donor_id`, `campaign_id`, `pledge_id`, `status`, `date_from`, `date_to`.
**Responses:** `200` paginated list.

### `GET /api/donations/:id`
**Permission:** `donation.view`
**Responses:** `200` donation object (includes linked receipt if issued) · `404` not found/cross-org.

### `POST /api/donations/:id/confirm`
**Purpose:** Confirm a pending donation. On success, server also: (a) recalculates and stamps `pledge.amount_fulfilled` / `pledge.status` if `pledge_id` is set, and (b) auto-issues a receipt (see §5) — both happen inside the same transaction so a donation is never left `confirmed` without its receipt/pledge update.
**Permission:** `donation.confirm`
**Guard:** donation must currently be `pending`.
**Responses:** `200` updated donation + receipt reference · `403` · `404` · `409` invalid transition (e.g. already confirmed/void).

### `POST /api/donations/:id/refund`
**Purpose:** Mark a confirmed donation as refunded; reverses its contribution to `pledge.amount_fulfilled` if linked; voids the associated receipt.
**Permission:** `donation.refund`
**Guard:** donation must currently be `confirmed`.
**Responses:** `200` · `403` · `404` · `409` invalid transition.

### `POST /api/donations/:id/void`
**Purpose:** Cancel a `pending` donation that was never confirmed (e.g. entered in error).
**Permission:** `donation.void`
**Guard:** donation must currently be `pending`.
**Responses:** `200` · `403` · `404` · `409` invalid transition (cannot void a confirmed donation — must refund instead).

---

## 5. Receipts

### `GET /api/receipts`
**Permission:** `receipt.view`
**Query params:** `page`, `page_size`, `donor_id`, `status`.
**Responses:** `200` paginated list.

### `GET /api/receipts/:id`
**Permission:** `receipt.view`
**Responses:** `200` receipt object · `404` not found/cross-org.

### `POST /api/receipts/:id/void`
**Purpose:** Void an issued receipt (e.g. clerical error), independent of the underlying donation.
**Permission:** `receipt.void`
**Guard:** receipt must currently be `issued`.
**Responses:** `200` · `403` · `404` · `409` invalid transition.

*(Receipts have no direct `POST /api/receipts` — creation is a system side-effect of `donation.confirm`, not a standalone client action. This is the assumption flagged for the technical defense; the alternative design is a standalone `receipt.issue` permissioned endpoint if a future requirement needs manual/delayed receipt issuance, e.g. batch/year-end receipting.)*

---

## Design Decision to Flag in Defense
Receipt issuance is a **side effect of `donation.confirm`**, not a separate client call. Trade-off: simpler client flow and no risk of a confirmed donation missing its receipt, but less flexibility if the org later wants to batch-issue receipts (e.g. year-end) instead of per-donation. That would be a straightforward extension — add a `receipt.issue` endpoint and make auto-issue configurable per organization — without changing the schema.
