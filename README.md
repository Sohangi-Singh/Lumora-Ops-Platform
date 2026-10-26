# Lumora Solar Ops

**One platform for a rooftop-solar EPC business** — customers upload documents and track their project live, field workers record geo-tagged site surveys from their phones, the system auto-generates the techno-commercial quotation on the company letterhead, the owner approves it, the customer accepts and pays via Razorpay, and every stage up to subsidy credit is tracked in real time, in English and Hindi.

- **Live demo:** _add the Vercel URL here after deploy_
- **Stack:** Next.js 15 (App Router, TypeScript strict) · Supabase (Postgres, Auth, Storage, Realtime) · Prisma · Zod · @react-pdf/renderer · Razorpay · Claude vision · next-intl · Leaflet/OSM · Vitest

---

## Problem statement

Lumora Solar Private Limited (Raipur, Chhattisgarh and Delhi NCR) installs on-grid rooftop solar under the PM Surya Ghar scheme. Today every project runs on WhatsApp threads and Word quotations on letterhead:

- documents (electricity bill, Aadhaar, PAN, cancelled cheque) arrive as chat photos and get lost;
- the surveyor's roof measurements live in a notebook; sizing is done by hand in a spreadsheet;
- each quotation is retyped, so numbers, terms and reference numbers drift;
- customers keep calling to ask "what's the status?";
- payments are reconciled by eye, and nobody sees which projects are stuck or about to miss the 40-day completion promise.

## Target users

| Role | Who | Uses it to |
|---|---|---|
| `CUSTOMER` | Homeowner (mostly on a phone, often Hindi-first) | Upload documents, follow a live tracker, view/accept the quote, pay, raise AMC service requests |
| `WORKER` | Field surveyor / installer | See today's jobs, do the survey with geo-tagged photos (offline-safe), log installation |
| `ADMIN` | Owner / office staff | Verify documents and bill data, assign surveys, approve quotes, verify payments, move stages, manage settings and users |

## Solution & key features

**Customer**
- Self-registration with DPDP consent; English/हिंदी switcher remembered on the profile.
- **Live project tracker**: 10-stage stepper (horizontal on desktop, vertical on mobile). Under the current stage, either *"We're working on it"* (with ETA) or *"Action needed from you"* with the exact button. Updates arrive in realtime with no refresh.
- Document checklist with per-document status chips, rejection reasons, why-we-need-it text, camera capture, client-side compression, upload progress and automatic retry.
- Quotation viewer (letterhead PDF inline + download), savings summary (subsidy, net cost, payback, 25-year savings), accept with confirmation (timestamp, IP, user agent stored); expired quotes offer "Request revised quote".
- Payments: Razorpay Checkout (UPI/cards/netbanking) **or** bank transfer / loan UTR with receipt upload; downloadable receipts.
- Bilingual timeline, in-app notification bell (+ email via Resend when configured), AMC service requests with photos.

**Worker**
- Today / Upcoming / Done jobs with click-to-call and Google Maps directions. Workers only ever receive name, phone and address — never KYC documents or prices.
- Guided survey: big numeric inputs, **autosave to IndexedDB**, persistent **photo upload queue** that survives lost signal, live "what's missing" list, submit disabled until complete (the same rules are re-checked on the server).
- **Geo-tagged rooftop photos**: high-accuracy GPS fix, EXIF-aware re-encode, coordinates + accuracy + IST time burned into the image, shown on an OpenStreetMap (Leaflet) map.
- Installation checklist: material received, before/after photos, installed.

**Admin**
- Overview: KPIs (active projects, quotes to approve, payments to verify, collected vs pending ₹, SLA risk), read-only pipeline Kanban, **blockers panel** sorted by age with *waiting on customer / worker / us* filters, monthly collections chart, global search (name, phone, service no., ref no.).
- Customer 360: documents (approve / reject with reason, version history, audited viewing), **bill-data review side-by-side with the bill**, survey (all fields, photos, map pin), quote (sizing breakdown with the binding constraint, overrides with mandatory reason, **live PDF preview**, Approve & Send), payments (verify UTRs, record offline payments), full audit timeline, next-step actions.
- Settings: every business constant (sizing, GST split, subsidy, export tariff, payment split, validity, terms, bank, signatory, city codes, letterhead margins), BOM catalog and pricing slabs — all audit-logged. Users: create/deactivate workers and admins.

---

## Tech stack — and why

| Choice | Why |
|---|---|
| **Next.js 15 App Router + TypeScript strict** | Server Components keep data access and authorization on the server; Server Actions give typed mutations with built-in CSRF protection; one deployable unit on Vercel. |
| **Supabase** | Managed Postgres + Auth + private Storage + Realtime in one free tier. Storage signed URLs let phones upload 10 MB files directly (bypassing the 4.5 MB serverless body limit). |
| **Prisma** | Typed schema and migrations; transactions for "stage change + event + notification". |
| **Zod** | One validation layer for forms, server actions, route handlers, AI output and settings JSON. |
| **@react-pdf/renderer** | Deterministic, server-side PDF from React components — the quote is data, not a Word file. |
| **Razorpay** | Indian payments (UPI first) with Orders API, signed Checkout callbacks and webhooks. |
| **Claude vision (Anthropic API)** | Reads Hindi/English CSPDCL bills and app screenshots into structured JSON; paired with a deterministic parser and cross-checks so it is never trusted blindly. Model comes from `ANTHROPIC_MODEL`. |
| **next-intl** | Typed message catalogues for English and natural Chhattisgarh Hindi; cookie-based locale (no URL prefix) so shared links work for everyone. |
| **Leaflet + OpenStreetMap** | Survey location map with no paid map key. |
| **Tailwind v4 + shadcn/ui** | Accessible primitives themed to the brand (navy `#1B263B`, cream `#F4F1DE`, gold `#C6A75E` accents only). |
| **Vitest** | Fast unit tests for all pure business logic. |

---

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    C[Customer portal<br/>mobile-first]
    W[Worker app<br/>IndexedDB drafts + upload queue]
    A[Admin console]
  end
  subgraph Vercel["Next.js on Vercel"]
    MW[middleware<br/>session refresh]
    RSC[Server Components<br/>pages]
    SA[Server Actions<br/>Zod + authz]
    API[Route handlers<br/>PDF · signed-URL redirects · webhook]
    subgraph Domain["lib/ (pure, unit-tested)"]
      SM[workflow/stateMachine]
      BL[workflow/blockers]
      SOL[solar/ sizing · BOM · pricing · economics · refNo]
      EX[extraction/ parser · checks]
    end
    SVC[workflow/service<br/>transactions + effects outbox]
    PDF[pdf/QuoteDocument]
  end
  subgraph Supabase
    PG[(Postgres<br/>RLS on, no policies)]
    AUTH[Auth]
    ST[(Private Storage<br/>documents · photos · quotes)]
    RT[Realtime Broadcast]
  end
  RZP[Razorpay]
  CL[Claude vision]
  RS[Resend email]

  C & W & A --> MW --> RSC
  C & W & A -- actions --> SA --> SVC --> PG
  SVC --> SM & BL & SOL
  SA --> EX --> CL
  RSC & API --> PDF
  C & W -. direct signed upload .-> ST
  API -. 60 s signed URL .-> ST
  SVC -- after commit --> RT -. refresh ping .-> C & W & A
  SVC -- after commit --> RS
  C -- Checkout --> RZP -- webhook --> API
  RSC --> AUTH
```

**How a change flows.** Every mutation is a server action: `Zod.parse → requireRole / assertCanAccessProject → withWorkflow(tx => … recordEvent … notify … advanceIfReady)`. Side effects (realtime pings, emails, slow work like PDF rendering or AI extraction) are collected in an **effects outbox** and run only after the transaction commits, so a rollback never notifies anyone. Realtime messages carry **no data** — they're invalidation pings; clients re-fetch through the server, which re-runs authorization.

### Project lifecycle (state machine)

`lib/workflow/stateMachine.ts` is pure and exhaustively tested. A project sits *in* a stage until that stage's exit condition holds; `advanceIfReady` then moves it forward (strictly linear, no skipping). Invalid moves throw a typed `InvalidTransitionError` with machine-readable reasons.

```mermaid
stateDiagram-v2
  direction LR
  [*] --> REGISTERED
  REGISTERED --> DOCUMENTS: account created
  DOCUMENTS --> SURVEY: bill + Aadhaar + PAN + cheque APPROVED<br/>and bill data confirmed
  SURVEY --> QUOTE: survey SUBMITTED with geo photo
  QUOTE --> ADVANCE_PAYMENT: quote ACCEPTED within validity
  ADVANCE_PAYMENT --> SUBSIDY_APPLICATION: 90% PAID / VERIFIED
  SUBSIDY_APPLICATION --> INSTALLATION: PM Surya Ghar application no.
  INSTALLATION --> NET_METERING: dispatched + installed + photos
  NET_METERING --> COMMISSIONED: file submitted + 10% PAID / VERIFIED
  COMMISSIONED --> SUBSIDY_CREDITED: net meter installed
  SUBSIDY_CREDITED --> [*]: subsidy credited → 5-year AMC
```

The **blockers engine** (`lib/workflow/blockers.ts`) turns the same snapshot into "what's missing and who owes it" — e.g. *Aadhaar rejected: blurry*, *Survey overdue by 2 days*, *Quote expires in 1 day*, *40-day SLA at risk* — powering both the customer's action card and the admin blockers panel.

### Quote-generation pipeline

```mermaid
flowchart LR
  B[Confirmed BillData<br/>months · load · phase] --> S
  SV[Submitted survey<br/>roof area · distances] --> S
  ST[Settings + catalog + slabs] --> S
  S["computeSizing<br/>avg = Σunits/n → /30 → /5<br/>min(required, load cap, roof cap)"] --> BOM[buildLineItems<br/>panels = kW×1000/Wp]
  BOM --> PR["computePricing<br/>₹70,200/kW · GST 70/30 · basic/Wp<br/>Indian amount in words"]
  PR --> EC[computeEconomics<br/>subsidy · payback · 25-yr]
  EC --> Q[(Quote vN DRAFT<br/>inputs + outputs snapshotted)]
  Q --> PDF[Letterhead PDF<br/>DRAFT watermark] --> PA[PENDING_APPROVAL<br/>admins notified]
  PA -- Approve & Send --> SENT[re-dated, final PDF<br/>customer notified]
  SENT -- accept --> ACC[ACCEPTED<br/>→ ADVANCE_PAYMENT]
```

Entering the QUOTE stage triggers this automatically. Ref numbers (`0241/RPR/10/2026-2027`) come from an atomic per-financial-year counter (`INSERT … ON CONFLICT DO UPDATE … RETURNING`), roll over on 1 April IST, and revisions keep the ref number while bumping the version (older versions become `SUPERSEDED`). Because every quote stores its full input/output snapshot, any PDF can be re-rendered byte-for-byte.

### Electricity-bill extraction

CSPDCL PDFs have a garbled Hindi text layer but intact digits, so extraction runs **three independent signals**:

1. a deterministic **text-layer parser** (`lib/extraction/cspdclParser.ts`) anchored on value shapes — 10-digit service no., `4000.00W`, `YYYY/MM reading units` table rows;
2. **Claude vision** with a strict JSON schema (structured output), validated again with Zod; PDFs go in as document blocks, photos/screenshots as images;
3. **cross-checks**: previous reading + units ≈ current reading, continuous months, plausible units, text-vs-vision agreement → a confidence score; low confidence or a failed critical check ⇒ "Needs review".

It runs after the upload response (never blocks the customer), merges up to 24 months from the CSPDCL app screenshot, keeps admin-entered months, and degrades to manual entry if the API key is missing or anything fails. **Only admin-confirmed data feeds sizing.**

---

## Data model (overview)

`User` (Supabase Auth id, role, language, active) → `Customer` (address, DPDP consent) → `Project` (stage, stage timestamps, worker, size, phase, per-stage facts such as subsidy application no., dispatch/installation/net-metering/commissioning/subsidy dates, AMC).
Per project: `Document` (versioned, `isLatest`, status, extraction status), `BillData` (fields, months JSON, source AI/PARSER/MANUAL, checks, confidence, confirmation), `Survey` + `Photo` (geo fields), `Quote` (ref no., version, status, snapshots, totals, acceptance IP), `Payment` (milestone, method, Razorpay ids, UTR, status), `ProjectEvent` (bilingual timeline + audit log), `Notification`, `ServiceTicket`.
Config and infrastructure: `Settings` (Zod-validated JSON), `CatalogItem`, `PricingSlab`, `RefCounter`, `WebhookEvent` (idempotency), `AuditLog`, `RateLimit`. See [`prisma/schema.prisma`](prisma/schema.prisma).

---

## Local setup

Requirements: Node 20+ (tested on Node 25), npm.

```bash
npm install
cp .env.example .env        # fill in values (see below)
npx prisma migrate deploy   # create tables (+ RLS lockdown)
SEED_RESET=1 npm run db:seed
npm run dev                 # http://localhost:3000
```

**No Supabase project yet?** `npm run db:local` starts an embedded Postgres on port 54329 (no Docker). Set `DATABASE_URL` and `DIRECT_URL` to `postgresql://postgres:postgres@localhost:54329/lumora` and leave the Supabase variables empty. In `next dev` the login page then offers a **dev-only user switcher** (`/dev/login`) to sign in as any seeded user. It does nothing whenever `NODE_ENV=production` or Supabase is configured. Uploads, realtime and emails need the real services.

**Supabase project setup** (free tier is enough):
1. Create a project; copy the Project URL, anon key and service-role key; copy the transaction pooler (6543, append `?pgbouncer=true&connection_limit=5&pool_timeout=20`) and direct (5432) connection strings.
2. `npx prisma migrate deploy` then `SEED_RESET=1 npm run db:seed` — the seed creates the private buckets (`project-documents`, `project-photos`, `quotes`), Auth users and demo files.
3. Nothing else: Realtime Broadcast needs no table publication, and buckets have no public policies.

Useful scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run quote:sample out.pdf` (renders a sample quotation for a fictional customer).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres (Supabase transaction pooler, port 6543, append `?pgbouncer=true&connection_limit=5&pool_timeout=20`) used by the app |
| `DIRECT_URL` | yes | Direct Postgres connection used by Prisma migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key (Auth + Realtime subscribe) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only: Storage, Auth admin, Realtime broadcast |
| `ANTHROPIC_API_KEY` | optional | Claude vision bill extraction (text parser + manual entry work without it) |
| `ANTHROPIC_MODEL` | optional | Claude model id used for extraction |
| `RAZORPAY_KEY_ID` | for online payments | Razorpay key id (test mode) |
| `RAZORPAY_KEY_SECRET` | for online payments | Server-only key secret (order creation, signature verification) |
| `RAZORPAY_WEBHOOK_SECRET` | for webhooks | Webhook signing secret |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | for online payments | Key id exposed to Checkout |
| `RESEND_API_KEY` | optional | Transactional email (skipped when unset) |
| `RESEND_FROM` | optional | Sender, e.g. `Lumora Solar <updates@yourdomain>` |
| `NEXT_PUBLIC_APP_URL` | yes | Absolute app URL (emails, links) |

## Deployment

1. Push the repo to GitHub and import it in Vercel (framework: Next.js; build command default).
2. Add every variable above in Vercel → Settings → Environment Variables.
3. Run migrations + seed against the Supabase database from your machine (`npx prisma migrate deploy && SEED_RESET=1 npm run db:seed`).
4. In the Razorpay dashboard (test mode) add a webhook to `https://<your-domain>/api/webhooks/razorpay` for `payment.captured` and `payment.failed` with the same secret as `RAZORPAY_WEBHOOK_SECRET`.

**Deployment link:** _add after deploy_

## Demo credentials

Password for every demo account: **`Lumora@2026`**

| Role | Email | Where they are |
|---|---|---|
| Admin | `admin.demo@example.com` | everything |
| Worker | `ravi.demo@example.com` (Hindi) | survey scheduled for Rohit tomorrow |
| Worker | `manoj.demo@example.com` | installation in progress for Neha |
| Customer | `kavita.demo@example.com` (Hindi) | just registered — no documents yet |
| Customer | `priya.demo@example.com` | Aadhaar **rejected** (blurry), PAN under review |
| Customer | `rohit.demo@example.com` | site survey scheduled |
| Customer | `anjali.demo@example.com` (Hindi) | quote **awaiting admin approval** |
| Customer | `vikram.demo@example.com` | 90% advance **paid** (Razorpay) → subsidy application |
| Customer | `neha.demo@example.com` (Delhi NCR) | installation, **40-day SLA at risk** |
| Customer | `suresh.demo@example.com` (Hindi) | **commissioned**, subsidy credited, AMC ticket open |

All people, addresses, phone numbers and documents in the seed are fictional.

## Testing payments (Razorpay test mode)

- **Card:** `4111 1111 1111 1111`, any future expiry, any CVV, any name; OTP page → *Success*.
- **UPI:** `success@razorpay` (succeeds) or `failure@razorpay` (fails).
- **Netbanking:** pick any bank → *Success* / *Failure* on the mock page.

Then try: dismissing Checkout (status stays "awaiting payment"), a failed payment (recorded as FAILED, retry allowed), paying twice in two tabs (the same order is reused; a second capture is flagged for refund), and a bank-transfer UTR that an admin verifies or rejects.

## Security notes

- **Authorization on the server, always.** Every action and route goes through `lib/authz` (`requireRole`, `assertCanAccessProject`); ownership rules are pure and unit-tested. Customers get 404 (not 403) for other projects so ids can't be probed. Workers never receive KYC documents or prices.
- **Private storage only.** Files live under `projects/{projectId}/…` in private buckets; reads are 60-second signed URLs issued after the authz check, and every document view is written to the audit log. Uploads use one-time signed upload URLs, then the server verifies **magic bytes** and the real size before accepting the file (renamed executables are deleted).
- **Defence in depth.** RLS is enabled on every public table with no policies, so the public anon key can read nothing via PostgREST; buckets have no public policies.
- **Sensitive data.** Aadhaar numbers are only ever displayed masked (`XXXX XXXX 1234`); DPDP consent and timestamp are recorded at sign-up; a privacy note sits on the documents page.
- **Payments.** Checkout signatures (HMAC-SHA256 of `order_id|payment_id`) and webhook signatures (raw body) are verified with constant-time comparison; webhooks are idempotent per event; amounts always come from the accepted quote's snapshot, never the client.
- **Abuse limits.** Postgres-backed rate limits on login, registration, uploads, orders and tickets (work across serverless instances). Zod on every input, Next.js server-action CSRF protection, security headers (HSTS, frame options, no-sniff, referrer and permissions policy). Secrets live only in env vars; the service-role key is imported only by `server-only` modules.

## Testing

```bash
npm test
```

106 Vitest tests cover the pure business logic:
- **Sizing** with the RTS sheet (5,279 units / 7 months → 754 avg → 25.1/day → 5.03 kW → **5 kW**, cap 9.89), roof/load caps, never rounding up past a cap, 12-of-24 months, minimum months.
- **Pricing**: 5 kW → **₹3,51,000**, "Three Lakh Fifty-One Thousand Only", GST split, basic per Wp vs the sample's 64.645, slab selection; Indian amount-in-words up to crores.
- **Ref numbers** `0241/RPR/10/2026-2027` and the **April FY rollover** in IST.
- **Every state-machine transition**, valid and invalid (skips, backwards, after final), guards and auto-advance.
- **Blockers** for every stage including SLA risk/breach and quote expiry.
- **Razorpay** checkout and webhook signature verification.
- **Extraction**: CSPDCL parser on a synthetic bill fixture, schema coercion, cross-checks and confidence.
- Composed quote pipeline end-to-end, survey requirements, magic-byte sniffing, Aadhaar masking, authz rules, and **EN/HI message-key parity**.

## Decisions & notes for the owner

- **Basic per-Wp formula.** The sample quote prints 64.645. Splitting the GST-inclusive value 70/30 and backing out GST from each part gives 64.647 (used by default); the "blended rate" formula in the brief gives 64.463. Switch in *Settings → Quotation* if needed — see `computeBasicPerWp()`.
- **Load cap.** Sizing caps at the sanctioned (contract) load from the bill, falling back to connected load if that is all that's printed.
- **State subsidy** is a configurable flat amount (₹30,000) applied to systems ≥ 1 kW; central assistance follows PM Surya Ghar slabs (₹30k/kW for 2 kW, ₹18k for the 3rd, capped at ₹78,000).

## Future scope

- WhatsApp status updates and document collection (WhatsApp Business API)
- Generation monitoring via the inverter's cloud API on the customer dashboard
- Referral programme with tracked rewards
- Subsidy auto-tracking against the PM Surya Ghar portal
- Offline-first PWA install for the worker app
