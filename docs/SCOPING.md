# SCOPING.md — Donation Management System

## Problem
Non-profit organizations need a way to track who is giving (donors), what is being raised for (campaigns), what has been promised versus actually received (pledges vs. donations), how funds move once received (fund allocation), and to produce receipts, acknowledgements, and financial reports for accountability and audit purposes. Today this is often scattered across spreadsheets, email threads, and paper receipts, making it hard to reconcile pledges against actual cash/in-kind receipts or to report accurately to leadership and auditors.

## Intended Users
- **Donor Relations / Fundraising Staff** — manage donors, campaigns, pledges, acknowledgements
- **Finance / Accounting Staff** — record donations, manage fund allocation, generate financial reports
- **Program Staff** — view beneficiary-linked allocations (read-mostly)
- **Manager / Executive Director** — approvals, oversight, reporting
- **Administrator** — org configuration, role/permission management

## Main Features (Full Module Vision)
- Donor management (individuals, organizations, recurring donors)
- Beneficiary management and linkage to fund allocations
- Campaign management (goals, timelines, status)
- Pledges (commitments) with fulfillment tracking
- Donations — cash and in-kind, tied to payment channels
- Receipts and donor acknowledgements (auto-generated)
- Fund allocation (donations/pledges → programs/beneficiaries)
- Donor history and giving timeline
- Financial and campaign reporting

## Included in First Version (v1)
- Donor CRUD (individual + organization donor types)
- Campaign CRUD with basic status lifecycle (Draft → Active → Closed)
- Pledge creation and lifecycle (Pledged → Partially Fulfilled → Fulfilled → Cancelled)
- Cash donation recording, linked to a payment channel and optionally to a pledge
- Basic receipt generation on donation confirmation
- Tenant-isolated, permission-gated API for the above
- Dashboard with core KPIs (total raised, active campaigns, outstanding pledges)

## Explicitly Excluded (v1)
- In-kind donation valuation/appraisal workflows
- Recurring/subscription donation billing automation
- Payment gateway integration (Stripe/PayPal live processing) — v1 records payment channel as metadata only, not live processing
- Beneficiary-level fund disbursement tracking (beyond simple allocation tagging)
- Multi-currency conversion
- Donor portal (self-service donor login) — this module is staff-facing only in v1
- Automated tax-receipt PDF generation/email delivery (manual/basic template only)

## Assumptions
- ARGO platform JWT provides authenticated user identity and organization context; this module performs no independent authentication.
- Each organization represents one non-profit tenant; donors/campaigns/pledges do not span organizations.
- Monetary amounts are stored in a single base currency per organization for v1.
- "Payment channel" (bank transfer, cash, check, card) is a simple categorical field in v1, not a live integration.

## Open Questions
- Should a donor be allowed to belong to multiple organizations (e.g., a donor who gives to two different affiliated non-profits on the same platform), or is donor identity strictly per-tenant?
- Is partial pledge fulfillment (multiple donations against one pledge) required in v1, or can pledges be fulfilled in a single donation only?
- What level of financial report detail is required for v1 (summary totals vs. exportable ledger)?

## Known Limitations
- No live payment processing; reconciliation against actual bank/gateway records is manual in v1.
- In-kind donations are recorded as a simple category + estimated value, without a formal appraisal workflow.
- Reporting is limited to in-app dashboard KPIs; no scheduled/exported report generation in v1.
