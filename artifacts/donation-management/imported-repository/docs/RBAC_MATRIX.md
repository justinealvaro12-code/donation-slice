# RBAC_MATRIX.md — Donation Management System

## 1. Authentication Model — Standalone Email/Password + JWT
This module performs its own authentication. There is no external platform issuing tokens; the application verifies credentials and issues/consumes its own JWTs.

### How a user authenticates
- `POST /api/auth/login` accepts an email and password, checks them against the stored user record (password hashed with bcrypt), and on success issues an application-signed JWT (`HS256`, signed with `JWT_SECRET`) containing `sub` (user id), `organization_id`, and `role` as claims.
- The client sends this JWT as a `Bearer` token on every subsequent request.

### How the JWT is consumed
- Every protected API route sits behind the `authenticate` middleware (`backend/src/middleware/auth.js`), which verifies the JWT's signature and expiry before the request reaches any route handler.
- On success, the middleware attaches a verified context object to the request: `req.auth = { user_id, organization_id, role, permissions: [...] }`. Route/repository code never parses the token itself — it only reads this already-verified context.
- If the token is missing, expired, or invalid, the request is rejected with `401` before it reaches any donation/pledge/donor logic.

### How the authenticated user is identified
`req.auth.user_id` is the sole source of "who is making this request." It is used to stamp `created_by` / `updated_by` on every write — never taken from the request body.

### How the active organization is determined
`req.auth.organization_id` is the sole source of tenant context, taken from the verified token claims. Every query in this module includes `WHERE organization_id = req.auth.organization_id` (enforced at the data-access layer, not left to individual handlers to remember — see §4).

### How permissions are resolved
- At authentication time, the middleware calls `permissionsForOrgRole(organization_id, role)`, which queries the `organization_role_permissions` table for that organization's actual permission grants for the user's role.
- If the organization has no rows yet for that role, it falls back to the hardcoded defaults in `backend/src/rolePermissions.js`. That file is **not** the live runtime source of truth — it only provides the default permission set used when seeding a new organization, or as a fallback until an admin customizes a role's grants via Settings → Roles & Permissions. Once an organization has its own rows in `organization_role_permissions`, those rows — not the file — govern that organization's permission checks.
- The resolved `permissions` array is attached to `req.auth` and checked by `requirePermission(...)` on each route (see §4).

### Preventing organization-context switching
- `organization_id` is **never** read from the request body, query string, URL path, or any custom header. If a client sends one anyway, it is silently ignored — the token's value always wins.
- Because `organization_id` is baked into the signed token, a user cannot escalate to another tenant without a new token issued for that tenant (which itself requires valid credentials for a user belonging to that organization).
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
| `campaign.delete` | No | No | No | Yes | Yes |
| `pledge.view` | Yes | Yes | Yes | Yes | Yes |
| `pledge.create` | No | Yes | No | Yes | Yes |
| `pledge.update` | No | Yes | No | Yes | Yes |
| `pledge.delete` | No | No | No | Yes | Yes |
| `donation.view` | Yes | Yes | Yes | Yes | Yes |
| `donation.create` | No | Yes | Yes | Yes | Yes |
| `donation.confirm` | No | No | Yes | Yes | Yes |
| `donation.refund` | No | No | Yes | Yes | Yes |
| `donation.void` | No | No | Yes | Yes | Yes |
| `donation.delete` | No | No | No | Yes | Yes |
| `receipt.view` | Yes | Yes | Yes | Yes | Yes |
| `receipt.create` | No | No | Yes | Yes | Yes |
| `receipt.void` | No | No | Yes | Yes | Yes |
| `report.view` | Yes | Yes | Yes | Yes | Yes |
| `settings.view` | No | No | No | No | Yes |
| `settings.manage` | No | No | No | No | Yes |

**Least-privilege notes:**
- Viewer has no write permissions at all — a pure read role for oversight/reporting.
- Fundraising Staff is intentionally blocked from `donation.confirm/refund/void`, `receipt.create/void`, and any `*.delete` — the segregation-of-duties boundary described above.
- Finance Staff is intentionally blocked from `donor.create/update/delete` and `campaign.*` — they operate on money, not on donor/campaign records.
- Only Manager/Administrator can delete a donor, campaign, pledge, or donation — these are destructive, org-level actions.
- `settings.view`/`settings.manage` (organization settings, including Roles & Permissions) are Administrator-only.

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
`campaign.view`, `campaign.create`, `campaign.update`, `campaign.delete`,
`pledge.view`, `pledge.create`, `pledge.update`, `pledge.delete`,
`donation.view`, `donation.create`, `donation.confirm`, `donation.refund`, `donation.void`, `donation.delete`,
`receipt.view`, `receipt.create`, `receipt.void`,
`report.view`,
`settings.view`, `settings.manage`.

## Design Decision to Flag in Defense
The Fundraising Staff / Finance Staff split (create vs. confirm) wasn't required by the assessment template — it's an added control based on how real non-profits separate gift-entry from gift-finalization. Trade-off: it adds a role and a workflow step (someone has to confirm every donation) versus a simpler model where the creator can also confirm. Worth being ready to justify why the extra step is worth the friction (fraud/error resistance) versus just relying on an audit log.
