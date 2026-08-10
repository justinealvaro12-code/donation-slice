# DASHBOARD_STRUCTURE.md — Donation Management System

## Sidebar Item: Dashboard
Purpose: Overview of donation activity, campaign progress, and pending actions
Tabs: (none — single view)
KPIs:
- Total Raised — SUM(amount) of all confirmed donations in org
- Active Campaigns — COUNT(*) of campaigns WHERE status = 'active'
- Outstanding Pledges — COUNT(*) of pledges WHERE amount_fulfilled &lt; amount_pledged AND deleted_at IS NULL
- Pending Confirmations — COUNT(*) of donations WHERE status = 'pending'
Charts:
- Monthly Donation Trends — line chart, SUM(amount) by month for last 12 months
- Campaign Progress — bar chart, goal_amount vs. raised_amount per active campaign
Tables: (none)
Forms: (none)
Access: All roles (viewer, fundraising_staff, finance_staff, manager, administrator)

## Sidebar Item: Donations
Purpose: Manage donation records and their lifecycle
Tabs: All Donations, Pending, Confirmed, Refunded, Voided
Tables:
- Donation List
  Columns: ID, Donor, Amount, Payment Channel, Date, Status, Receipt
  Search: donor display_name, receipt_number
  Filters: status, date range, payment_channel, campaign
  Sorting: date (desc), amount (desc/asc), status
  Row actions: View, Confirm (if pending), Void (if pending), Refund (if confirmed)
  Bulk actions: (none in v1)
Forms:
- New Donation
  Fields: donor_id (searchable dropdown), campaign_id (optional dropdown), pledge_id (optional), amount, payment_channel, payment_reference, donation_date
  Actions: Create (saves as pending)
Access: Viewer (view only), Fundraising Staff (create), Finance Staff (confirm/refund/void), Manager+ (all)

## Sidebar Item: Donors
Purpose: Manage donor records and contact information
Tabs: All Donors, Active, Inactive
Tables:
- Donor List
  Columns: ID, Name, Type, Email, Phone, Status, Total Given
  Search: display_name, email
  Filters: donor_type, status
  Sorting: display_name, created_at
  Row actions: View, Edit, Delete (soft)
Forms:
- New/Edit Donor
  Fields: donor_type, display_name, email, phone, address
  Actions: Save
Access: Viewer (view), Fundraising Staff (create/update), Manager+ (delete)

## Sidebar Item: Campaigns
Purpose: Manage fundraising campaigns and goals
Tabs: All Campaigns, Draft, Active, Closed
Tables:
- Campaign List
  Columns: Name, Goal, Start Date, End Date, Status, Raised Amount
  Search: name
  Filters: status, date range
  Row actions: View, Edit, Activate (if draft), Close (if active)
Forms:
- New/Edit Campaign
  Fields: name, description, goal_amount, start_date, end_date
  Actions: Save
Access: Viewer (view), Fundraising Staff (create/update), Manager+ (activate/close)

## Sidebar Item: Pledges
Purpose: Track donor commitments and fulfillment
Tabs: All Pledges, Pledged, Partially Fulfilled, Fulfilled, Cancelled
Tables:
- Pledge List
  Columns: Donor, Campaign, Amount Pledged, Fulfilled, Status, Due Date
  Search: donor display_name
  Filters: status (computed), campaign, due_date range
  Row actions: View, Cancel (if no confirmed donations)
Forms:
- New Pledge
  Fields: donor_id, campaign_id (optional), amount_pledged, pledge_date, due_date
  Actions: Save
Access: Viewer (view), Fundraising Staff (create/update), Manager+ (cancel)

## Sidebar Item: Receipts
Purpose: View and manage donation receipts
Tabs: All Receipts, Issued, Voided
Tables:
- Receipt List
  Columns: Receipt Number, Donor, Amount, Issued Date, Status
  Search: receipt_number, donor name
  Filters: status, date range
  Row actions: View, Void (if issued)
Forms: (none — auto-generated on donation confirm)
Access: Viewer (view), Finance Staff+ (void)

## Sidebar Item: Reports
Purpose: Financial and campaign reporting
Tabs: Summary, Trends, Campaigns, Channels, Top Donors
Tables: (varies by tab — see API_CONTRACT.md)
Charts:
- Trends: line chart by month
- Campaigns: bar chart comparison
- Channels: pie/donut chart
- Top Donors: horizontal bar chart
Access: Viewer (view only), Manager+ (export if added in v2)

## Sidebar Item: Settings
Purpose: Organization-level configuration
Tabs: Roles & Permissions, Payment Channels, Receipt Numbering
Tables:
- Role Permissions: Role, Permissions list, Edit
- Payment Channels: Channel, Active toggle
- Receipt Settings: Prefix, Next Sequence
Forms:
- Edit Role Permissions: checkbox grid of permissions per role
- Edit Receipt Prefix: prefix text field
Access: Administrator only