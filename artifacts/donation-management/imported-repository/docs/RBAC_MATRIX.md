# RBAC_MATRIX.md — Donation Management System

## JWT Integration Note (Pre-Development Assessment)

This module is designed to consume ARGO's platform-issued JWT. The current
implementation uses a development secret (`JWT_SECRET` in `.env`) for standalone
testing. At integration time, the auth middleware will be updated to:

- Verify tokens using ARGO's JWKS endpoint (RS256) or shared platform secret
- Extract `user_id` (claim: `sub`), `organization_id`, and `role` from ARGO's token payload
- The permission resolution mechanism (`permissionsForOrgRole`) remains unchanged

Required from ARGO platform team:
- JWKS URL or signing secret
- Exact JWT claim names for user ID, organization ID, and role
- Token expiry/refresh behavior

## 1. Authentication Model — No Separate Login System
This module performs **no authentication of its own**. It consumes the platform-issued JWT on every request and trusts nothing else about identity or tenancy.

### How the JWT is consumed
- Every API route sits behind a shared platform middleware that verifies the JWT signature/expiry before the request reaches any module code.
- On success, the middleware attaches a verified context object to the request, e.g. `req.auth = { user_id, organization_id, roles: [...], permissions: [...] }`. Module code never parses the token itself — it only reads this already-verified context.
- If the token is missing, expired, or invalid, the request is rejected with `401` before it reaches any donation/pledge/donor logic.

### How the authenticated user is identified
`req.auth.user_id` is the sole source of "who is making this request." It is used to stamp `created_by` / `updated_by` on every write — never taken from the request body.

### How the active organization is determined
`req.auth.organization_id` is the sole source of tenant context, taken from the verified token claims. Every query in this module includes `WHERE organization_id = req.auth.organization_id` (enforced at the data-access layer, not left to individual handlers to remember — see §4).

### Preventing organization-context switching
- `organization_id` is **never** read from the request body, query string, URL path, or any custom header. If a client sends one anyway, it is silently ignored — the token's value always wins.
- Because `organization_id` is baked into the signed token, a user cannot escalate to another tenant without a new token issued by the platform for that tenant (which is itself gated by the platform's own membership rules, outside this module's scope).
- The data-access layer (see §4) makes tenant filtering structural rather than optional, so even a handler that "forgets" to filter cannot leak cross-tenant data.

---

## 2. Roles
Based on the intended users defined in SCOPING.md:

| Role | Description |
|---|---|
| **Viewer** | Read-only access — maps to Program Staff who need visibility into fund allocation but don't manage donors/money. |
| **Fundraising Staff** | Manages donor relationships, campaigns, and pledges; records donations but does not confirm/finalize them. |
| **Finance Staff** | Confirms, refunds, and voids donations; manages receipts; does not create/edit donor or campaign records. |
| **Manager** | Full operational access across all entities, including cancellations and campaign lifecycle control. |
| **Administrator** | Full access, including anything Manager has, for org-level oversight. |

**Design rationale (segregation of duties):** Fundraising Staff can *create* a donation record but cannot *confirm* it — confirmation (the action that finalizes the financial record, updates pledge totals, and issues a receipt) is reserved for Finance Staff or above. This mirrors a real non-profit's internal control: the person who logs a gift isn't the same person who finalizes it, reducing the risk of a single actor fabricating and self-approving a donation.

---

## 3. Role–Permission Matrix

| Permission | Viewer | Fundraising Staff | Finance Staff | Manager | Administrator |
|---|:---:|:---:|:---:|:---:|:---:|
| `donor.view` | Yes | Yes | Yes | Yes | Yes |
| `donor.create` | No | Yes | No | Yes | Yes |
| `donor.update` | No | Yes | No | Yes | Yes |
| `donor.delete` | No | No | No | Yes | Yes |
| `campaign.view` | Yes | Yes | Yes | Yes | Yes |
| `campaign.create` | No | Yes | No | Yes | Yes |
| `campaign.update` | No | Yes | No | Yes | Yes |
| `campaign.activate` | No | No | No | Yes | Yes |
| `campaign.close` | No | No | No | Yes | Yes |
| `pledge.view` | Yes | Yes | Yes | Yes | Yes |
| `pledge.create` | No | Yes | No | Yes | Yes |
| `pledge.update` | No | Yes | No | Yes | Yes |
| `pledge.cancel` | No | No | No | Yes | Yes |
| `donation.view` | Yes | Yes | Yes | Yes | Yes |
| `donation.create` | No | Yes | Yes | Yes | Yes |
| `donation.confirm` | No | No | Yes | Yes | Yes |
| `donation.refund` | No | No | Yes | Yes | Yes |
| `donation.void` | No | No | Yes | Yes | Yes |
| `receipt.view` | Yes | Yes | Yes | Yes | Yes |
| `receipt.void` | No | No | Yes | Yes | Yes |
| `report.view` | Yes | Yes | Yes | Yes | Yes |

**Least-privilege notes:**
- Viewer has no write permissions at all — a pure read role for oversight/reporting.
- Fundraising Staff is intentionally blocked from `donation.confirm/refund/void` and `receipt.void` — the segregation-of-duties boundary described above.
- Finance Staff is intentionally blocked from `donor.create/update/delete` and `campaign.*` — they operate on money, not on donor/campaign records.
- Only Manager/Administrator can cancel a pledge or close/activate a campaign — these are org-level lifecycle decisions with downstream effects on reporting.

---

## 4. Permission Enforcement Mechanism
- Every route declares its required permission (as documented per-endpoint in API_CONTRACT.md), checked via a shared middleware: `requirePermission('donation.confirm')`.
- The middleware checks `req.auth.permissions` (resolved server-side from the user's role at token-issue or session-lookup time — never client-supplied) and returns `403` before the route handler runs if the permission is absent.
- Tenant filtering is enforced at the data-access layer: repository/query functions for every business table require an `organization_id` argument and are called only with `req.auth.organization_id` — there is no code path that queries these tables without a tenant filter.
- Combined, a request must pass three independent gates before touching data: (1) valid JWT → (2) required permission present → (3) query scoped to token's `organization_id`. Failing any one gate blocks the request.

---

## 5. Permission Naming Convention
All permissions follow `<resource>.<action>`, action-based rather than role-based, so new roles can be composed later without inventing new permissions:
`donor.view`, `donor.create`, `donor.update`, `donor.delete`,
`campaign.view`, `campaign.create`, `campaign.update`, `campaign.activate`, `campaign.close`,
`pledge.view`, `pledge.create`, `pledge.update`, `pledge.cancel`,
`donation.view`, `donation.create`, `donation.confirm`, `donation.refund`, `donation.void`,
`receipt.view`, `receipt.void`.

## Design Decision to Flag in Defense
The Fundraising Staff / Finance Staff split (create vs. confirm) wasn't required by the assessment template — it's an added control based on how real non-profits separate gift-entry from gift-finalization. Trade-off: it adds a role and a workflow step (someone has to confirm every donation) versus a simpler model where the creator can also confirm. Worth being ready to justify why the extra step is worth the friction (fraud/error resistance) versus just relying on an audit log.
