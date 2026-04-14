# Product Requirements Document
## CRK-Aerial Rep Portal

**Version:** 2.1  
**Date:** April 11, 2026  
**Status:** Draft

---

## 1. Overview

**CRK-Aerial Rep Portal** is a web-based dealer operations platform for managing the full lifecycle of drone sales — from lead capture through quoting, ordering, inventory allocation, post-sale service, and dealer performance tracking. It is built for a network of drone dealers managed by a single admin (the owner), giving every dealer a shared workspace while maintaining clear ownership and accountability.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (JSX) |
| Hosting | Vercel |
| Backend / Database | Firebase (Firestore) |
| Authentication | Firebase Auth |
| File Storage | Firebase Storage |
| Map | Google Maps API |
| Email Notifications | EmailJS or SendGrid |
| Source Control | GitHub |

> **Note on Supabase:** Firebase covers authentication, database (Firestore), and file storage — Supabase is not needed for this project.

---

## 3. User Roles

### 3.1 Admin (1 user — the owner)
- Full access to all modules
- Creates and manages dealer accounts
- Assigns a commission/margin percentage to each dealer individually
- Controls which dashboard widgets and modules each dealer can see
- Views all leads, inventory, orders, service tickets, and documents across all dealers
- Manages drone model and parts catalog including MSRP pricing
- Views dealer leaderboard and all analytics
- Always sees full MSRP and cost pricing — dealer-adjusted prices are never shown to admin

### 3.2 Dealer
- Logs in with credentials created by admin
- Sees only the dashboard widgets and modules the admin has enabled for them
- Views drone and parts prices as both MSRP and their personal dealer price (MSRP adjusted by their assigned margin)
- Creates and manages their own leads
- Views all leads across all dealers (read-only on others)
- Builds and sends quotes directly to customers
- Manages their own inventory stock
- Creates and manages service & repair tickets
- Uploads and accesses documents
- Visible on the dealer leaderboard

---

## 4. Authentication

- Firebase Authentication (email/password)
- Admin creates dealer accounts manually
- Role (admin vs dealer) stored in Firestore user profile
- Protected routes — unauthenticated users redirected to login
- Session persistence across browser tabs

---

## 5. Module 1 — Lead Management

### 5.1 Lead Record Fields

| Field | Type | Notes |
|---|---|---|
| First Name | Text | Required |
| Last Name | Text | Required |
| Email | Email | Required |
| Phone | Text | Required |
| Company | Text | Optional |
| Address / Location | Text + Geocode | Powers map pin |
| Drone Model Interest | Multi-select Dropdown | From admin catalog |
| Budget | Currency (USD) | Optional |
| Status | Dropdown | See pipeline stages |
| Assigned Dealer | Dropdown | Admin assigns; dealer updates own |
| Source | Dropdown | Website, Referral, Trade Show, Cold Outreach, Other |
| Activity Log | Structured entries | See 5.3 |
| Created By | Auto | Name of admin or dealer |
| Created At | Timestamp | Auto |
| Last Updated | Timestamp | Auto |

### 5.2 Pipeline Stages

1. New
2. Contacted
3. Pending
4. Demo Scheduled
5. Proposal Sent
6. Won — auto-converts lead to Customer record
7. Lost

### 5.3 Activity Log (Structured)

Every lead has a chronological activity log. Each entry captures:
- **Type:** Call, Email Sent, Note, Status Change, Meeting, Demo, Quote Sent
- **Details:** Free text description
- **Created By:** Dealer or admin name
- **Timestamp:** Auto

Status changes are logged automatically. All other entries are added manually by the assigned dealer or admin.

### 5.4 Lead Views

- **List View** — sortable, filterable table with color-coded status badges
- **Kanban Pipeline View** — columns per stage; drag-and-drop cards to update status
- **Search** — by name, email, company, or phone

### 5.5 Lead to Customer Conversion

When a lead is marked **Won:**
- A **Customer record** is automatically created
- The lead record is archived but remains accessible
- The map pin updates to reflect "Customer" status
- A quote/order can be initiated directly from the customer record

### 5.6 Lead Permissions

| Action | Admin | Assigned Dealer | Other Dealers |
|---|---|---|---|
| Create | Yes | Yes | Yes |
| View | Yes | Yes | Read-only |
| Edit | Yes | Yes | No |
| Delete | Yes | No | No |
| Assign | Yes | No | No |

---

## 6. Module 2 — Customer Records

Once a lead converts to Won, a full Customer record is created automatically.

### 6.1 Customer Record Fields

| Field | Type |
|---|---|
| Full Name | Text |
| Company | Text |
| Email / Phone | Text |
| Address | Text + Geocode |
| Assigned Dealer | Linked |
| Drones Purchased | Linked to Orders |
| Service History | Linked to Service Tickets |
| Documents | Linked to Document Storage |
| Notes | Free text |
| Customer Since | Timestamp (auto) |

---

## 7. Module 3 — Quotes, Orders & Invoices

### 7.1 Quote Flow

1. Dealer or admin creates a quote linked to a lead or customer
2. Quote is built using line items from the drone/parts catalog and/or custom line items
3. Dealer sends the quote directly to the customer via email (PDF generated in-app)
4. Customer accepts or declines (tracked manually by dealer in the activity log)
5. Upon acceptance, dealer converts the quote to an **Order**
6. From a delivered order, an **Invoice** can be generated in one click — or an invoice can be created from scratch at any time

### 7.2 Quote Fields

| Field | Type |
|---|---|
| Quote # | Auto-generated |
| Linked Lead / Customer | Required |
| Line Items | Catalog items OR custom line items (see 7.5) |
| Quantity | Per line item |
| Unit Price | From catalog (editable) or custom |
| Discount | % or flat amount |
| Subtotal / Tax / Total | Auto-calculated |
| Notes / Terms | Free text |
| Status | Draft, Sent, Accepted, Declined, Expired |
| Created By | Dealer or admin name |
| Created At | Timestamp |

### 7.3 Order Fields

| Field | Type |
|---|---|
| Order # | Auto-generated |
| Linked Quote | Optional (not required if order created manually) |
| Linked Customer | Required |
| Line Items | Carried from quote or entered manually |
| Order Total | Auto-calculated |
| Status | Processing, Fulfilled, Shipped, Delivered, Cancelled |
| Fulfillment Date | Date |
| Tracking Info | Text |
| Notes | Free text |

### 7.4 Invoice Module

Invoices are formal payment requests sent to customers. They are distinct from quotes and can be created two ways:

**From an Order:** One-click invoice generation from any order — all line items, pricing, and customer info carry over automatically.

**From Scratch:** Any dealer or admin can create a standalone invoice not linked to any order or quote — useful for custom work, service charges, deposits, or any ad-hoc billing.

#### Invoice Fields

| Field | Type |
|---|---|
| Invoice # | Auto-generated |
| Linked Order | Optional |
| Linked Customer | Required (or enter manually if no customer record) |
| Line Items | Catalog items AND/OR custom line items (see 7.5) |
| Quantity | Per line item |
| Unit Price | From catalog or custom entry |
| Discount | % or flat amount per line item or overall |
| Subtotal | Auto-calculated |
| Customer State | Auto-filled from customer record (drives tax rate lookup) |
| Tax Exempt | Toggle (Yes / No) |
| Tax Exemption Reason | Dropdown — Agricultural Producer, Reseller, Non-Profit, Other (shown only if Tax Exempt = Yes) |
| Exemption Certificate # | Text — optional reference number for the exemption (shown only if Tax Exempt = Yes) |
| Tax Rate | Auto-populated from state tax table based on customer state; editable manually; set to 0% if tax exempt |
| Tax Amount | Auto-calculated (0 if exempt) |
| Total Due | Auto-calculated |
| Amount Paid | Manual entry |
| Balance Due | Auto-calculated (Total minus Amount Paid) |
| Payment Terms | Text (e.g. Net 30, Due on Receipt) |
| Due Date | Date |
| Payment Status | Unpaid, Partial, Paid, Overdue (auto-flags when past due date) |
| Notes | Free text (visible on invoice PDF) |
| Internal Notes | Free text (not visible on PDF) |
| Created By | Dealer or admin name |
| Created At | Timestamp |
| Sent At | Timestamp |

#### Invoice Actions
- **Save as Draft** — not yet sent to customer
- **Send Invoice** — generates PDF and emails to customer using their contact info on file
- **Mark as Paid** — updates payment status and logs the payment date
- **Record Partial Payment** — logs amount paid and auto-calculates remaining balance
- **Download PDF** — standalone download without emailing
- **Duplicate Invoice** — clone an existing invoice as a starting point

#### Tax Rate System

**Per-State Tax Table (Admin Managed)**
- Admin maintains a state-by-state tax rate table in the admin panel (`/admin/tax-rates`)
- When an invoice is created, the customer's state auto-populates the applicable tax rate
- Tax rate is editable per invoice if a manual override is needed

**Tax Exemption**
- Any invoice can have tax waived by toggling **Tax Exempt = Yes**
- Designed primarily for agricultural producers but supports other exemption types
- When exempt, tax rate is set to 0% and the PDF displays a tax exemption notice
- Exemption reason and optional certificate number are stored on the invoice record and displayed on the PDF for compliance purposes
- Admin can flag a customer record as tax-exempt by default — new invoices for that customer will have tax exempt pre-toggled

**Tax Exempt Customer Flag (on Customer Record)**

| Field | Type |
|---|---|
| Tax Exempt | Toggle (Yes / No) |
| Exemption Type | Agricultural Producer, Reseller, Non-Profit, Other |
| Exemption Certificate # | Text (optional) |
| Exemption Notes | Free text |

When a new invoice is created for a tax-exempt customer, the tax exempt toggle is pre-set to Yes and the exemption details auto-fill from the customer record — the dealer can still override per invoice if needed.

#### Invoice PDF
- Clean, branded PDF with CRK-Aerial logo and color scheme
- Displays: invoice number, date, due date, customer info, itemized line items, subtotal, tax, total due, balance due, payment terms, and notes
- Emailed directly from the app using the customer's email on file

### 7.5 Custom Line Items

Both quotes and invoices support two types of line items that can be mixed freely:

**Catalog Line Items** — pulled from the drone/parts catalog with MSRP and dealer pricing pre-filled, editable upward.

**Custom Line Items** — fully manual entries for anything not in the catalog:

| Field | Type |
|---|---|
| Description | Free text (e.g. "On-site training", "Shipping fee", "Custom mount fabrication") |
| Quantity | Number |
| Unit Price | Manual entry |
| Line Total | Auto-calculated |

Any number of custom line items can be added to a quote or invoice alongside catalog items.

### 7.6 PDF Generation (Quotes & Invoices)

- System generates branded PDFs for both quotes and invoices
- Downloadable and emailable directly from within the app
- Includes CRK-Aerial branding, all line items, totals, terms, and notes
- Customer email is auto-populated from their record; editable before sending

---

## 8. Module 4 — Inventory Management

### 8.1 Structure

- Each dealer maintains their own inventory stock
- Admin holds a central/unallocated stock pool and can push units to dealers
- Admin can view all dealers' inventory in a master view

### 8.2 Inventory Item Fields

| Field | Type |
|---|---|
| Drone Model | Linked to catalog |
| SKU / Serial # | Text |
| Condition | New, Demo, Refurbished |
| Quantity On Hand | Number |
| Quantity Reserved | Auto (from open orders) |
| Quantity Available | Auto (On Hand minus Reserved) |
| Location / Dealer | Linked |
| Cost Price | Currency |
| Notes | Text |
| Last Updated | Timestamp |

### 8.3 Inventory Actions

- **Add stock** — manually add units to a dealer's inventory
- **Transfer stock** — admin moves units between dealers or from central pool
- **Reserve stock** — automatically triggered when an order is created
- **Fulfill stock** — reduces on-hand count when order is marked Delivered
- **Low stock alerts** — email notification to admin when quantity drops below a threshold set per model

### 8.4 Inventory Views

- Per-dealer inventory view (dealers see only their own)
- Master inventory view (admin sees all dealers side by side)
- Filter by model, condition, and availability

---

## 9. Module 5 — Service & Repair Tracking

### 9.1 Ticket Types

- **Customer service** — linked to an existing customer record
- **Lead service** — linked to a lead record (pre-sale support)
- **Walk-in service** — no existing record required; customer info captured directly on the ticket

### 9.2 Service Ticket Fields

| Field | Type |
|---|---|
| Ticket # | Auto-generated |
| Ticket Type | Customer / Lead / Walk-in |
| Linked Record | Customer or Lead (optional for walk-in) |
| Customer Name | Text (auto-filled if linked) |
| Drone Model | Text or linked to catalog |
| Serial # | Text |
| Issue Description | Free text |
| Diagnosis | Free text |
| Parts Used | Line items from parts catalog |
| Labor Hours | Number |
| Status | Open, In Progress, Awaiting Parts, Resolved, Closed |
| Priority | Low, Normal, High, Urgent |
| Assigned Dealer | Dropdown |
| Estimated Completion | Date |
| Resolution Notes | Free text |
| Created At | Timestamp |
| Closed At | Timestamp |

### 9.3 Service Views

- List view with filters by status, priority, dealer, and date range
- Detail view with full ticket history and editable fields

---

## 10. Module 6 — Document Storage

### 10.1 Overview

Documents can be attached at multiple levels: per lead, per customer, per order, per service ticket, or as globally shared files (spec sheets, price lists, training materials).

### 10.2 Supported File Types

Any file type: PDF, Word (.docx), Excel (.xlsx), images (JPG, PNG), and others. All files stored in Firebase Storage.

### 10.3 Document Fields

| Field | Type |
|---|---|
| File Name | Text |
| File Type | Auto-detected |
| Linked To | Lead / Customer / Order / Service Ticket / Global |
| Uploaded By | Dealer or Admin name |
| Upload Date | Timestamp |
| Description / Tag | Text |

### 10.4 Document Actions

- Upload, download, preview (PDF and images), delete
- Admin manages a **Global Library** of shared documents (spec sheets, manuals, price lists) accessible to all dealers

---

## 11. Module 7 — Customer Map (Google Maps)

- Interactive map showing all leads and customers as pins
- Leads and Customers displayed in distinct colors
- Pin popup shows: customer name, status, drone model interest, assigned dealer
- Pins color-coded by lead/customer status
- Filters: by status, dealer, lead vs customer
- Clicking a pin navigates to the full lead or customer record

---

## 12. Module 8 — Dashboard & Analytics

Visible to all users. Admin sees all data; dealers see system-wide data with their own stats highlighted.

### 12.1 KPI Cards

- Total Leads (all + new this month)
- Total Customers
- Open Quotes
- Total Orders (this month / all time)
- Open Service Tickets
- Total Inventory Units (available)
- Pipeline Value (sum of budgets for open leads)
- Revenue Closed (sum of won order totals)

### 12.2 Charts

| Chart | Type | Description |
|---|---|---|
| Leads by Status | Donut | Distribution across pipeline stages |
| Leads by Dealer | Bar | Lead count per dealer |
| Won vs Lost | KPI Side-by-side | Win/loss count and rate |
| Leads Over Time | Line | New leads per week/month |
| Revenue Over Time | Line | Closed revenue per month |
| Top Drone Models | Bar | Most requested models |
| Inventory Levels | Bar | Stock per model across all dealers |
| Service Tickets by Status | Donut | Open / in progress / closed breakdown |

### 12.3 Dealer Leaderboard

Ranked table of all dealers with the following columns:
- Win Rate (%)
- Revenue Closed ($)
- Leads in Pipeline (#)
- Service Tickets Closed (#)
- Overall Score (weighted composite — equal weight across 4 metrics by default)

Filterable by time period: this month, this quarter, all time.

---

## 13. Module 9 — Admin Controls

### 13.1 Dashboard Visibility Controls

Admin can toggle on/off which dashboard widgets and modules are visible to each dealer. Controls are set per dealer and can be updated at any time.

**Configurable dashboard widgets per dealer:**

| Widget | Can Be Hidden |
|---|---|
| Total Leads KPI | Yes |
| Total Customers KPI | Yes |
| Open Quotes KPI | Yes |
| Total Orders KPI | Yes |
| Open Service Tickets KPI | Yes |
| Inventory Levels KPI | Yes |
| Pipeline Value KPI | Yes |
| Revenue Closed KPI | Yes |
| Leads by Status Chart | Yes |
| Leads by Dealer Chart | Yes |
| Won vs Lost Chart | Yes |
| Leads Over Time Chart | Yes |
| Revenue Over Time Chart | Yes |
| Top Drone Models Chart | Yes |
| Inventory Levels Chart | Yes |
| Service Tickets Chart | Yes |
| Dealer Leaderboard | Yes |

**Configurable module access per dealer:**

| Module | Can Be Restricted |
|---|---|
| Leads | No (core feature) |
| Customers | No (core feature) |
| Quotes & Orders | Yes |
| Inventory | Yes |
| Service & Repair | Yes |
| Documents | Yes |
| Map | Yes |

Admin sets these permissions from the dealer management panel. Changes take effect immediately on the dealer's next page load.

---

### 13.2 Dealer Pricing & Commission Management

#### Pricing Architecture

All drone models and parts in the catalog have a single **MSRP price** set by admin. Each dealer is assigned a **margin percentage** that determines their personal dealer cost price.

**Dealer Price Formula:**
```
Dealer Price = MSRP × (1 - Margin %)
Example: MSRP $2,000 × (1 - 20%) = Dealer Price $1,600
```

#### Admin Pricing View
- Admin always sees full MSRP and cost price in the catalog
- Admin sees all dealers' margin percentages in the dealer management panel
- Admin can set a different margin % per dealer at any time

#### Dealer Pricing View
- Dealers see **both** MSRP and their personal Dealer Price on every catalog item, inventory item, and quote line item
- The margin percentage itself is **not shown** to the dealer — only the resulting price
- Dealer Price is calculated in real-time on the frontend using the dealer's stored margin %
- Pricing is never exposed across dealers — each dealer only sees their own dealer price

#### Where Dealer Pricing Appears
- Catalog / parts browser
- Inventory item detail
- Quote line item builder (dealer price auto-populates as the default sell price, editable upward but not below dealer cost)
- Order detail view

#### Commission / Margin Settings (per dealer record)
| Field | Type | Notes |
|---|---|---|
| Margin % | Number (0–100) | Applied to all catalog items |
| Effective Date | Date | When the new margin takes effect |
| Notes | Text | Internal admin notes on pricing tier |

> **Security note:** Margin percentages and cost pricing must be protected at the Firestore security rules level so dealers cannot read other dealers' margins or the raw cost fields on catalog items.

---

## 14. Module 10 — Lead Chat

Every lead has a dedicated chat thread visible to all dealers and admin. It is separate from the structured Activity Log — the Activity Log tracks formal pipeline actions, while the Lead Chat is a freeform collaborative discussion space.

### 14.1 Lead Chat Features

- Threaded message feed displayed on the lead detail page
- Any dealer or admin can post a message
- Messages show: sender name, avatar/initials, timestamp
- Supports plain text and file attachments (images, PDFs)
- Messages are permanent — no deleting (admin can delete if needed)
- Real-time updates using Firestore's `onSnapshot` listener — new messages appear instantly without a page refresh

### 14.2 Lead Chat Message Fields

| Field | Type |
|---|---|
| Message ID | Auto-generated |
| Lead ID | Linked |
| Author | Linked to user profile |
| Message Text | Free text |
| Attachment | Optional file (Firebase Storage) |
| Timestamp | Auto |

### 14.3 Lead Chat Notifications

When a new message is posted on a lead:
- **Assigned dealer** receives an email notification
- **Admin** receives an email notification
- Other dealers are not notified unless they are the assigned dealer

---

## 15. Module 11 — Global Team Chat

A single shared chat channel accessible to all dealers and admin from anywhere in the app. This is a persistent, real-time team communication space — not tied to any lead or record.

### 15.1 Global Chat Features

- Accessible via a persistent icon/button in the main navigation (visible on all pages)
- Can be displayed as a slide-out panel or a dedicated full page
- Real-time messages using Firestore `onSnapshot` — no page refresh needed
- All users (admin + all dealers) can read and post
- Shows sender name, avatar/initials, and timestamp on every message
- Supports plain text and file attachments
- Message history is fully persistent — scrollable back through all past messages
- Admin can delete any message if needed

### 15.2 Global Chat Message Fields

| Field | Type |
|---|---|
| Message ID | Auto-generated |
| Author | Linked to user profile |
| Message Text | Free text |
| Attachment | Optional file (Firebase Storage) |
| Timestamp | Auto |

### 15.3 Global Chat Notification Preferences

Each user (admin and dealers) controls their own notification frequency for the global chat via their profile/settings page.

| Preference Option | Behavior |
|---|---|
| Every message | Email sent on each new global chat message |
| Daily digest | One summary email per day listing new messages |
| Weekly digest | One summary email per week |
| Mentions only | Email only when someone @mentions them by name |
| Off | No email notifications for global chat |

- Default for all users is **Mentions only**
- Users can update their preference at any time from their profile settings
- @mention support: typing `@name` in a message highlights and notifies that user regardless of their digest setting

---

## 16. Module 12 — GM Rep & Territory Manager (Admin Only)

This is a private, admin-only module that functions as an internal CRM for managing the dealer rep network. Dealers have zero visibility into this module — it is completely hidden from their accounts. It gives the General Manager a structured workspace to manage active reps, recruit new ones, assign territories, track performance against goals, and store all rep-related documents.

---

### 16.1 Rep Record

Each rep (active, prospect, or otherwise) has a full profile record.

#### Rep Record Fields

| Field | Type |
|---|---|
| First Name / Last Name | Text |
| Company / Business Name | Text |
| Email | Email |
| Phone | Text |
| Address | Text |
| Territory | Linked to Territory record(s) |
| Status | Dropdown — see 16.2 |
| Rep Pipeline Stage | Dropdown — see 16.3 (for prospects) |
| Commission % | Number — their margin rate (syncs with dealer account if active) |
| Start Date | Date |
| Contract Renewal Date | Date |
| Linked Dealer Account | Linked to dealer user (if active in the portal) |
| Performance Goals | Linked — see 16.5 |
| Documents | Linked — see 16.6 |
| Quotes / Invoices | Linked — see 16.7 |
| Private Notes Log | Append-only timestamped notes — admin only |
| Created At | Timestamp |
| Last Updated | Timestamp |

---

### 16.2 Rep Statuses

| Status | Description |
|---|---|
| Prospect | Potential rep being evaluated or recruited |
| In Onboarding | Signed but not yet fully set up |
| Active Rep | Fully operational dealer rep |
| Inactive Rep | Temporarily not active |
| Terminated | No longer part of the network |

---

### 16.3 Rep Recruitment Pipeline

For prospect reps not yet signed, a structured recruitment pipeline tracks progress:

1. **Prospect** — identified as a potential rep
2. **Contacted** — initial outreach made
3. **In Negotiation** — active discussions underway
4. **Signed** — agreement executed; transitions to In Onboarding status
5. **Declined** — did not move forward

Pipeline view mirrors the lead Kanban board — drag-and-drop cards between stages. Each stage change is logged automatically in the rep's private notes log with a timestamp.

---

### 16.4 Territory Management

Territories are defined and managed by admin. Each territory can be assigned to one or more reps.

#### Territory Record Fields

| Field | Type |
|---|---|
| Territory Name | Text (custom name, e.g. "Texas Panhandle", "Southwest Region") |
| States Covered | Multi-select — US states |
| Region Label | Text (e.g. Southwest, Midwest, Southeast) |
| Map Shape | Drawn polygon or pin cluster on Google Maps (see below) |
| Assigned Rep(s) | Linked to Rep records |
| Status | Active, Open (no rep assigned), Planned |
| Notes | Free text |

#### Territory Map (Google Maps — Admin Only)

- Full-screen interactive map at `/admin/territories/map`
- Admin can **draw custom territory shapes** (polygons) directly on the map using Google Maps Drawing Tools
- Shapes are saved and color-coded by territory status (Active = green, Open = yellow, Planned = grey)
- Each shape is linked to a Territory record — clicking a shape opens the territory detail panel
- Existing customer and lead pins from the main map can be toggled on as an overlay so admin can see where business activity is relative to territories
- Admin can also drop simple pins to mark prospect locations or areas of interest without drawing a full shape

---

### 16.5 Rep Performance Tracking

Performance data is pulled automatically from the rep's dealer activity in the portal, combined with manually set goals.

#### Auto-Pulled Metrics (from portal data)

| Metric | Source |
|---|---|
| Total Leads Created | Lead records |
| Leads Won | Lead records (status = Won) |
| Win Rate % | Auto-calculated |
| Revenue Closed ($) | Won order totals |
| Leads in Active Pipeline | Open lead records |
| Quotes Sent | Quote records |
| Invoices Sent | Invoice records |
| Service Tickets Closed | Service ticket records |

#### Manual Performance Fields

| Field | Type |
|---|---|
| Monthly Revenue Goal ($) | Number — set by admin per rep |
| Monthly Lead Goal (#) | Number — set by admin per rep |
| Performance Rating | 1–5 stars — admin-assigned |
| Last Review Date | Date |
| Review Notes | Free text |
| Goal Period | Month / Quarter / Year |

#### Performance Display
- Progress bars showing actual vs goal for revenue and leads
- Historical performance chart (bar chart — monthly revenue and leads over time)
- All metrics are filterable by time period: this month, this quarter, this year, all time

---

### 16.6 Rep Document Storage

All document types are stored per rep record in Firebase Storage, fully private to admin.

| Document Type | Notes |
|---|---|
| Dealer Agreement / Contract | Primary agreement |
| Commission Agreement | Commission terms and rate history |
| Onboarding Documents | Setup checklists, training materials, welcome packets |
| W9 / Tax Forms | Tax compliance documents |
| Other Documents | Any file type — PDF, Word, Excel, images |

- Upload, download, preview, and delete per document
- Each document shows: file name, type, upload date, and optional description/tag
- Admin can mark documents as requiring renewal (e.g. annual contract) and set a renewal reminder date

---

### 16.7 Quotes & Invoices Sent to Reps

Admin can create and store quotes and invoices sent to reps (e.g. for equipment purchases, training fees, territory setup costs) directly within the rep record.

- Uses the same quote and invoice builder from Module 3 (line items, custom entries, PDF generation, email send)
- Quotes and invoices created in this context are linked to the rep record and stored privately
- Payment status tracked the same way as customer invoices (Unpaid, Partial, Paid, Overdue)
- These rep-level quotes and invoices do **not** appear in the main dealer-facing quotes/invoices lists

---

### 16.8 Private Notes Log

Every rep record has a private, admin-only append-only notes log. Each entry captures:
- **Note text** — free text
- **Type** — Call, Email, Meeting, Review, Contract Update, General Note
- **Timestamp** — auto
- **Created By** — admin name

Pipeline stage changes are logged here automatically. All other entries are manual.

---

### 16.9 Rep Manager Views

- **Rep List View** — table of all reps filterable by status, territory, and performance rating
- **Recruitment Kanban** — pipeline board for prospect reps (stages = recruitment pipeline)
- **Territory Map** — full map with drawn territory shapes, rep assignments, and customer/lead overlay
- **Rep Detail Page** — full profile, performance dashboard, notes log, documents, and quotes/invoices

---

## 17. Email Notifications

| Trigger | Recipient |
|---|---|
| Lead assigned to dealer | Assigned dealer |
| Lead status changes to Won | Admin |
| Quote sent to customer | Dealer (confirmation copy) |
| Order status updated | Assigned dealer |
| Inventory low stock alert | Admin |
| Service ticket assigned | Assigned dealer |
| Service ticket resolved | Admin |
| Invoice sent to customer | Customer (PDF attached) + dealer (confirmation) |
| Invoice overdue | Assigned dealer + Admin |
| Invoice marked paid | Admin |
| Global chat message | Per each user's notification preference |
| Rep contract renewal due | Admin |
| Rep invoice overdue | Admin |

Provider: **EmailJS** (no backend required, recommended for V1) or **SendGrid** via Firebase Cloud Functions for higher volume.

---

## 18. Navigation Structure

```
/ .......................... Login
/dashboard ................. KPIs, charts, leaderboard
/leads ..................... Lead list + Kanban pipeline
/leads/new ................. Create lead
/leads/:id ................. Lead detail / edit / activity log / chat
/customers ................. Customer list
/customers/:id ............. Customer detail
/quotes .................... Quote list
/quotes/new ................ Build quote
/quotes/:id ................ Quote detail / PDF
/orders .................... Order list
/orders/:id ................ Order detail
/invoices .................. Invoice list
/invoices/new .............. Create invoice (from scratch)
/invoices/:id .............. Invoice detail / PDF / payment status
/inventory ................. Inventory (dealer view)
/inventory/master .......... All dealers' inventory (admin only)
/service ................... Service ticket list
/service/new ............... Create ticket
/service/:id ............... Ticket detail
/documents ................. Document library
/map ....................... Customer & lead map
/chat ...................... Global team chat (full page view)
/profile ................... User profile + notification preferences
/admin/dealers ............. Dealer management + margin % + dashboard controls (admin only)
/admin/catalog ............. Drone model + parts catalog with MSRP (admin only)
/admin/tax-rates ........... Per-state tax rate table (admin only)
/admin/reps ................ Rep & territory manager — list view (admin only)
/admin/reps/new ............ Create new rep record (admin only)
/admin/reps/:id ............ Rep detail — profile, performance, notes, docs, quotes/invoices (admin only)
/admin/reps/pipeline ....... Recruitment Kanban pipeline (admin only)
/admin/territories ......... Territory list (admin only)
/admin/territories/map ..... Territory map with drawable shapes + customer overlay (admin only)
```

---

## 18. Design System — CRK Aerial Brand

### 18.1 Logo
- Primary logo: CRK Aerial badge with drone watermark (uploaded asset)
- Used in: app header/sidebar, login page, PDF headers (quotes, invoices), email notifications
- On dark backgrounds: use white version of wordmark with bronze monogram
- On light backgrounds: use black wordmark with bronze monogram

### 18.2 Color Palette

| Role | Name | Hex | Usage |
|---|---|---|---|
| Primary Accent | CRK Bronze | `#8B6914` | Buttons, active states, highlights, links, badge accents |
| Primary Dark | Jet Black | `#111111` | Sidebar background, headers, primary text |
| Surface Dark | Charcoal | `#1E1E1E` | Card backgrounds on dark surfaces, nav items |
| Surface Mid | Slate Gray | `#2E2E2E` | Secondary backgrounds, table row alternates (dark mode) |
| Surface Light | Cool Gray | `#F4F4F5` | Page background (light mode), input backgrounds |
| Border | Steel Gray | `#3A3A3A` | Dividers, card borders, input borders |
| Text Primary | Off White | `#F0F0F0` | Primary text on dark backgrounds |
| Text Secondary | Medium Gray | `#9A9A9A` | Subtitles, metadata, placeholder text |
| Text Dark | Near Black | `#1A1A1A` | Primary text on light backgrounds |
| Success | Muted Green | `#4CAF7D` | Won status, paid badges, positive indicators |
| Warning | Amber | `#E6A817` | Pending status, low stock, overdue warnings |
| Danger | Muted Red | `#D95F5F` | Lost status, delete actions, error states |
| Info | Steel Blue | `#4A90B8` | Info badges, neutral status indicators |

### 18.3 App Theme

The app uses a **dark-primary theme** — dark sidebar/header with a lighter content area — consistent with the black and bronze brand identity.

- **Sidebar / Navigation:** Jet Black (`#111111`) background, Off White text, CRK Bronze active state highlight
- **Top Header Bar:** Jet Black with CRK Aerial logo left-aligned, bronze accent on active elements
- **Main Content Area:** Cool Gray (`#F4F4F5`) background — light enough to contrast the dark nav
- **Cards & Panels:** White with Steel Gray borders and subtle drop shadow
- **Primary Buttons:** CRK Bronze fill (`#8B6914`), white text, slightly darker on hover
- **Secondary Buttons:** Charcoal fill, Off White text
- **Destructive Actions:** Muted Red
- **Status Badges:** Color-coded using the palette above (Won = green, Lost = red, Pending = amber, etc.)

### 18.4 Typography

| Element | Font | Weight | Size |
|---|---|---|---|
| App Name / Logo Text | Inter or similar sans-serif | 700 Bold | — |
| Page Headings (H1) | Inter | 700 Bold | 24px |
| Section Headings (H2) | Inter | 600 SemiBold | 18px |
| Card Titles | Inter | 600 SemiBold | 16px |
| Body Text | Inter | 400 Regular | 14px |
| Labels / Metadata | Inter | 400 Regular | 12px |
| Buttons | Inter | 600 SemiBold | 14px |

### 18.5 PDF Branding (Quotes & Invoices)

All generated PDFs follow this layout:
- **Header:** CRK Aerial logo (top left) + document title (Quote / Invoice) top right
- **Header bar:** Jet Black background with Off White text
- **Bronze accent line** below the header bar
- Company info block below header (address, phone, email)
- Clean white body with Steel Gray dividers between sections
- Line items in alternating white / Cool Gray rows
- Totals block bottom right with bronze accent on the final Total Due row
- Footer: CRK Aerial name, EST. 1941, website/contact info in gray

### 18.6 Favicon & PWA Icon
- Use the CRK monogram (bronze on black) as the favicon and PWA home screen icon
- This allows dealers to "Add to Home Screen" on mobile for an app-like experience

---

## 19. Non-Functional Requirements

- **Responsive / Mobile-Friendly:** The app is a responsive web application — no separate mobile app required. It must work cleanly on desktop, tablet, and mobile browsers. See Section 18a for full mobile design requirements.
- **Performance:** All list views load under 2 seconds for up to 5,000 records
- **Real-time:** Firestore `onSnapshot` listeners power live chat in both lead chat and global chat
- **Security:** Firestore security rules enforce role-based access at the database level
- **File Storage:** Firebase Storage with access rules per user role; supports camera upload on mobile
- **Scalability:** Firebase/Firestore auto-scales; no server management needed

---

## 18a. Mobile Design Requirements

The app must be fully usable on a mobile phone browser (iOS Safari and Android Chrome). No native app install required — it runs as a responsive web app.

### Layout & Navigation
- **Hamburger menu** — tapping the menu icon slides out a full navigation panel from the left
- Navigation panel contains all main routes, user name/avatar, and a logout button
- All tables and list views reflow into **card-based layouts** on mobile (no horizontal scrolling on data tables)
- Forms stack vertically and use large tap targets (minimum 44px touch areas)
- Modals and drawers are full-screen on mobile

### Priority Mobile Flows (must be fully optimized for phone screens)

**1. Lead Management**
- Lead list displays as scrollable cards with status badge, customer name, assigned dealer, and last updated
- Tapping a card opens the full lead detail view
- Status can be updated from a prominent dropdown at the top of the detail view
- Activity log entries and chat messages can be added from mobile with a single tap

**2. Notes & Chat**
- Lead chat and global chat are fully functional on mobile
- Message input is pinned to the bottom of the screen (standard mobile chat UX)
- @mention autocomplete works on mobile keyboard

**3. Invoices**
- Full invoice creation available on mobile
- Line items can be added from catalog or as custom entries
- Tax exempt toggle is prominent and easy to tap
- Send invoice action is a clear primary button

**4. Inventory**
- Inventory list displays as cards per model with quantity badges
- Quick-add stock action accessible from mobile

### Camera & File Upload
- All file upload inputs support direct camera capture on mobile (using the native `capture` attribute on file inputs)
- Dealers can photograph drones, service damage, documents, or anything else directly from their phone camera and attach to: leads, service tickets, chat messages, or customer records
- Photos are uploaded to Firebase Storage and appear inline in the record

### Mobile-Specific UI Details
- Sticky header with app name, hamburger menu, and global chat notification badge
- Floating action button (FAB) on list pages for quick-create (new lead, new invoice, etc.)
- Pull-to-refresh on lead list, invoice list, and chat feeds
- Bottom-pinned primary action buttons on detail/form pages so they're always reachable with a thumb

---

## 19. Out of Scope (V1)

- Native iOS or Android app (responsive web covers mobile needs)
- Customer-facing portal
- CSV import/export (V2)
- Calendar / scheduling integration (V2)
- E-signature on quotes (V2)
- Accounting / invoicing integration (V2)

---

## 20. Open Questions

| # | Question | Notes |
|---|---|---|
| 1 | EmailJS vs SendGrid? | EmailJS for V1 simplicity; upgrade to SendGrid if volume grows |
| 2 | Starter drone model catalog? | Need a list of models and parts to pre-load |
| 3 | Quote PDF branding? | RESOLVED — see Section 18 Design System |
| 4 | Google Maps API key? | Required — obtain from Google Cloud Console |
| 5 | Tax rate on quotes/invoices? | Per-state table managed by admin; tax exempt toggle per invoice and per customer (ag producers + others) — RESOLVED |
| 6 | Leaderboard scoring weights? | Defaulting to equal weight across 4 metrics |

---

## 21. Suggested Build Order for Claude Code

1. Firebase project setup + Auth + Firestore security rules (including margin % and pricing protection)
2. Role-based routing + login page + user profile / notification preferences
3. Drone model + parts catalog — MSRP pricing, admin only (foundation for all modules)
4. Dealer management panel — create dealers, assign margin %, set dashboard visibility controls
5. Lead management — list view, Kanban board, detail view, activity log
6. Customer records + automatic lead-to-customer conversion
7. Inventory management — per dealer + admin master view + dealer pricing display
8. Quotes — line item builder (catalog + custom), PDF generation, email send
9. Orders — linked to quotes, status tracking
10. Invoices — from order or scratch, custom line items, PDF, email, payment tracking, per-state tax table, tax exemption (ag + other)
11. Service & repair tickets
12. Document storage + camera upload — Firebase Storage integration
13. Customer map — Google Maps with filtered pins
14. Dashboard — KPI cards, charts, dealer leaderboard + per-dealer visibility controls
15. Lead chat — real-time per-lead thread with email notifications
16. Global team chat — real-time, persistent, with @mentions and per-user notification preferences
17. GM Rep & Territory Manager — rep records, recruitment pipeline, performance tracking, documents, rep invoices/quotes
18. Territory map — Google Maps Drawing Tools for polygon territories + customer/lead overlay
19. Email notifications (all triggers including rep contract renewal and rep invoice overdue)
20. Mobile responsive pass — hamburger nav, card layouts, FAB buttons, pinned actions, pull-to-refresh, camera capture
21. Final QA + deploy to Vercel
