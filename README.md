<div align="center">

<img src="public/brand/logo.png" alt="Lumora Solar" width="150" />

# Lumora Solar Ops

### उज्ज्वल कल की ऊर्जा: the operating system for a rooftop-solar business

One platform where homeowners upload documents and follow their project live, field workers do geo-tagged site surveys from their phones, and the office gets an auto-generated quotation on the company letterhead. Everything from the first document to the subsidy credit then runs in one tracked flow, in **English and हिंदी**.

[![Live demo](https://img.shields.io/badge/Live_demo-lumora--ops--platform.vercel.app-1B263B?style=for-the-badge&logo=vercel&logoColor=white)](https://lumora-ops-platform-ae4b.vercel.app)
[![Demo video](https://img.shields.io/badge/Demo_video-Google_Drive-C6A75E?style=for-the-badge&logo=googledrive&logoColor=white)](https://drive.google.com/drive/folders/1FL3pzDluYX-WpU-x3rWnZ8KGFkOK0h_N?usp=drive_link)

![Next.js](https://img.shields.io/badge/Next.js_15-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_strict-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![Razorpay](https://img.shields.io/badge/Razorpay-0C2451?logo=razorpay&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/tests-106_passing-2E7D32)

</div>

---

## Demo video

<a href="https://drive.google.com/drive/folders/1FL3pzDluYX-WpU-x3rWnZ8KGFkOK0h_N?usp=drive_link">
  <img src="docs/screenshots/demo-video-cover.jpg" alt="Watch the Lumora Solar Ops demo video" width="720" />
</a>

**▶ [Watch the 4½-minute walkthrough on Google Drive](https://drive.google.com/drive/folders/1FL3pzDluYX-WpU-x3rWnZ8KGFkOK0h_N?usp=drive_link)**

The video follows one fictional homeowner, *Ramesh Kumar Verma*, through the whole live app:
1. He signs up in Hindi and uploads his documents.
2. The office rejects a blurry Aadhaar, and the reason reaches his phone instantly.
3. AI reads his electricity bill.
4. A field worker surveys his roof with geo-tagged photos.
5. The quote is generated on the letterhead, and he accepts it.
6. He pays the 90% advance through Razorpay.
7. The project goes through installation, net metering and the subsidy credit.

## Quick links

| | |
|---|---|
| 🌐 **Live application** | https://lumora-ops-platform-ae4b.vercel.app |
| 🎬 **Demo video** | [Google Drive folder](https://drive.google.com/drive/folders/1FL3pzDluYX-WpU-x3rWnZ8KGFkOK0h_N?usp=drive_link) |
| 🔑 **Demo logins** | [Demo credentials](#demo-credentials): every account uses `Lumora@2026` |
| 💳 **Test payments** | [Razorpay test mode](#testing-payments-razorpay-test-mode) |

## Contents

- [The story behind Lumora](#the-story-behind-lumora)
- [Problem statement](#problem-statement)
- [Target users](#target-users)
- [Solution](#solution)
- [Key features](#key-features)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Demo credentials](#demo-credentials)
- [Testing payments (Razorpay test mode)](#testing-payments-razorpay-test-mode)
- [Security](#security)
- [Testing](#testing)
- [Design decisions](#design-decisions)
- [Roadmap](#roadmap)
- [Author](#author)

---

## The story behind Lumora

**Lumora Solar** is my startup. We install on-grid rooftop solar for homes in **Raipur (Chhattisgarh)** and **Delhi NCR** under the Government of India's **PM Surya Ghar: Muft Bijli Yojana**, which gives homeowners a central subsidy (plus a state top-up) to put panels on their roofs.

The installation itself is the easy part. Behind every roof sits a long paper trail:
- KYC documents and electricity bills to collect;
- a site survey to do;
- a sizing calculation and a quotation on letterhead;
- an advance and a balance payment;
- a subsidy application, dispatch and installation;
- a net-meter file with the electricity board;
- finally, the subsidy credit, often months after the first phone call.

We were running all of this on WhatsApp threads, notebooks, spreadsheets and Word files. As we took on more homes, the business was limited less by how fast we could install than by how much **coordination** the office could handle.

So I built the tool I wished we had: **Lumora Solar Ops**, a single digital workflow for the whole business.
- Every project follows the same ten stages.
- Every stage knows what it is waiting for and who owes it.
- The customer, the field team and the office all see the same live truth.

The rules are ones we follow every day:
- the sizing formula;
- the GST split;
- the PM Surya Ghar subsidy slabs;
- the 90/10 payment split;
- the 40-day completion promise.

They are encoded in tested code instead of living in someone's head. This repository is that system. It is also my university end-term project.

---

## Problem statement

A small rooftop-solar EPC (engineering, procurement and construction) company juggles dozens of homeowners at different stages, each needing documents, a survey, a precise quotation, two payments and a government subsidy process. Without a system:

- 📎 **Documents get lost.** The electricity bill, Aadhaar, PAN and cancelled cheque arrive as blurry chat photos, are hard to find later, and nobody tracks which are approved or rejected.
- 📓 **Surveys live in notebooks.** Roof measurements, cable distances and photos never reach the office in a structured form, and nothing proves the surveyor was on site.
- 🧮 **Every quotation is retyped by hand.** Sizing is done in a spreadsheet and the quote is rebuilt in Word, so numbers, terms and reference numbers drift between versions.
- 📞 **Customers keep calling** to ask what's happening, because they can't see the status themselves.
- 💸 **Payments are reconciled by eye.** UPI screenshots and bank transfers are matched manually.
- ⏰ **Stuck projects are invisible.** Nobody can see which projects are blocked, who they're waiting on, or which will miss the 40-day completion promise.

## Target users

| Role | Who | What they need |
|---|---|---|
| 🏠 **Customer** | A homeowner, mostly on a phone, often Hindi-first, not tech-savvy | Upload documents easily, know exactly what's happening and what to do next, see and accept the quote, pay safely, raise service requests |
| 👷 **Worker** | A field surveyor or installer on site, sometimes with weak signal | Today's jobs with call and directions, a guided survey that can't be submitted incomplete, photos that survive a lost connection |
| 🧑‍💼 **Admin** | The owner and office staff | One view of every project and every blocker, document and bill verification, quote approval, payment verification and all business settings |

Public sign-up always creates a **customer**. Workers and admins are created by an admin from *Admin → Users*, so nobody can sign themselves up as staff.

## Solution

Lumora Solar Ops replaces the scattered tools with **one workflow engine and three purpose-built apps**: a customer portal, a worker app and an admin console.

| Before | With Lumora Solar Ops |
|---|---|
| Documents sent as WhatsApp photos | A checklist with camera capture, compression, upload retry, status chips and rejection reasons that appear on the customer's phone instantly |
| The bill is read by eye and typed into a spreadsheet | **AI vision + a deterministic PDF parser + cross-checks** extract 7–24 months of consumption, and an admin confirms side by side with the bill |
| Survey notes in a notebook | A guided mobile survey with offline autosave and **GPS-stamped rooftop photos** shown on a map |
| A Word quote retyped every time | A **quote generated automatically** from confirmed data: sizing with the binding constraint, BOM, GST-split pricing, subsidy and payback, rendered as a PDF **on the company letterhead** |
| "What's the status?" phone calls | A **live 10-stage tracker** that says either *"We're working on it"* or *"Action needed from you"*, with the exact button |
| Payment screenshots matched by hand | **Razorpay** UPI/card/netbanking with server-verified signatures and webhooks, or a bank-transfer UTR an admin verifies |
| No idea which projects are stuck | A **blockers engine** listing what is missing, who owes it (customer, field team or office) and how long it has been waiting, plus 40-day SLA risk |

Under the hood, a **pure, tested state machine** moves each project forward only when that stage's exit condition is true. The whole business follows one set of rules.

---

## Key features

### 🏠 For customers
- **Sign up in English or Hindi** with DPDP (India's data-protection law) consent recorded; the language choice is remembered on the profile.
- **Live project tracker**: a 10-stage stepper (horizontal on desktop, vertical on mobile). Under the current stage it shows either *"We're working on it"* with an ETA, or *"Action needed from you"* with the exact button. It updates in real time with no refresh.
- **Document checklist** with per-document status, rejection reasons, why-we-need-it text, camera capture, client-side compression, upload progress and automatic retry.
- **Quotation viewer**:
  - The letterhead PDF inline, plus a download.
  - A savings summary: subsidy, net cost, payback and 25-year savings.
  - One-tap acceptance, with the timestamp, IP and user agent stored.
  - An expired quote offers *"Request revised quote"*.
- **Payments** through Razorpay Checkout (UPI, cards, netbanking) **or** a bank-transfer / loan UTR with a receipt upload; downloadable receipts.
- A bilingual **timeline**, an in-app **notification bell** (plus email via Resend when configured) and **AMC service requests** with photos.

### 👷 For field workers
- **Today / Upcoming / Done** jobs with click-to-call and Google Maps directions. Workers receive only a customer's name, phone and address, never KYC documents or prices.
- **Guided survey**:
  - Large numeric inputs.
  - **Autosave to IndexedDB** and a persistent **photo upload queue** that survives lost signal.
  - A live *"what's missing"* list; submit stays disabled until the survey is complete, and the server re-checks the same rules.
- **Geo-tagged rooftop photos**: a high-accuracy GPS fix, an EXIF-aware re-encode, with the coordinates, accuracy and IST time burned into the image and shown on an OpenStreetMap map.
- **Installation checklist**: material received, before/after photos, marked installed.

### 🧑‍💼 For the office (admin)
- **Overview**:
  - KPIs: active projects, quotes to approve, payments to verify, collected vs pending ₹, SLA risk.
  - A pipeline Kanban and a monthly collections chart.
  - A **blockers panel** sorted by age, with *waiting on customer / field team / us* filters.
  - Global search by name, phone, service number or reference number.
- **Customer 360**:
  - Documents: approve or reject with a reason, version history, audited viewing.
  - **Bill review side by side with the bill**.
  - Survey: all fields, photos and the map pin.
  - Quote: sizing breakdown, overrides with a mandatory reason, **live PDF preview**, *Approve & send*.
  - Payments: verify UTRs, record offline payments.
  - The full audit timeline and next-step actions for every later stage.
- **Settings**: every business constant is editable and audit-logged:
  - sizing, GST split, subsidy, export tariff, payment split and quote validity;
  - terms, bank details, signatory and city codes;
  - letterhead margins, the BOM catalogue and pricing slabs.
- **Users**: create and deactivate workers and admins.

### ✨ The interesting parts
- 🤖 **Three-signal bill extraction**: AI vision (Claude or Gemini) + a deterministic CSPDCL text-layer parser + arithmetic cross-checks give a confidence score. Only **admin-confirmed** data ever feeds sizing.
- 📄 **Quotes as data, not Word files**: every quote stores its full input/output snapshot, so any version can be re-rendered byte for byte. Reference numbers (`0241/RPR/10/2026-2027`) come from an atomic per-financial-year counter that rolls over on 1 April IST.
- ⚡ **Realtime without leaking data**: Supabase Realtime broadcasts carry *no data*, only "refresh" pings. The client re-fetches through the server, which re-runs authorization.
- 🧾 **Effects outbox**: notifications, emails, PDF rendering and AI extraction run only after the database transaction commits, so a rollback never notifies anyone.
- 🌐 **Natural Hindi**, not machine-literal Hindi, across every screen, with an automated EN/HI key-parity test.

---

## Screenshots

> All names, phone numbers and documents shown are fictional demo data.

### Admin console

| Overview: KPIs and pipeline | Blockers: who owes what |
|---|---|
| ![Admin overview](docs/screenshots/admin-overview.jpg) | ![Blockers panel and revenue chart](docs/screenshots/admin-blockers.jpg) |
| **Customer 360: document verification** | **Bill read by AI + parser, cross-checked** |
| ![Document verification](docs/screenshots/admin-documents.jpg) | ![Bill extraction checks](docs/screenshots/bill-extraction.jpg) |
| **Quote auto-generated: sizing, pricing, economics** | **Razorpay Checkout (test mode)** |
| ![Quote sizing breakdown](docs/screenshots/quote-sizing.jpg) | ![Razorpay checkout](docs/screenshots/razorpay-checkout.jpg) |

### Customer portal (Hindi)

| Documents: rejection reason appears live | Quote: savings, accept, PDF |
|---|---|
| ![Documents with rejected Aadhaar](docs/screenshots/documents-rejected.jpg) | ![Customer quotation in Hindi](docs/screenshots/customer-quote-hindi.jpg) |

### Field worker's phone

| Guided survey (offline autosave) | Geo-tagged photo on the map | Installation checklist |
|:---:|:---:|:---:|
| <img src="docs/screenshots/worker-survey.jpg" width="230" alt="Worker survey" /> | <img src="docs/screenshots/worker-geo-photo.jpg" width="230" alt="Geo-tagged rooftop photo" /> | <img src="docs/screenshots/installer.jpg" width="230" alt="Installer checklist" /> |

---

## Tech stack

| Layer | Technology | Why this choice |
|---|---|---|
| Framework | **Next.js 15** (App Router) + **TypeScript strict** | Server Components keep data access and authorization on the server; Server Actions give typed mutations with built-in CSRF protection; one deployable unit on Vercel. |
| Database | **Supabase Postgres** + **Prisma 6** | A typed schema and migrations; transactions bundle *stage change + event + notification*. |
| Auth | **Supabase Auth** (`@supabase/ssr`) | Email/password sessions in cookies, refreshed in middleware; roles live in our own `User` table. |
| File storage | **Supabase Storage** (private buckets) | Signed upload URLs let phones send 10 MB files directly (bypassing the 4.5 MB serverless body limit); reads use 60-second signed URLs. |
| Realtime | **Supabase Realtime Broadcast** | Instant "something changed" pings to the customer, worker and admin screens. |
| Validation | **Zod** | One validation layer for forms, server actions, route handlers, AI output and settings JSON. |
| PDF | **@react-pdf/renderer** | Deterministic server-side PDFs from React components: quotes on the letterhead and payment receipts. |
| Payments | **Razorpay** | India-first payments (UPI, cards, netbanking) with the Orders API, signed Checkout callbacks and webhooks. |
| AI | **Claude** or **Gemini** vision | Reads Hindi/English CSPDCL bills and app screenshots into strict JSON; Claude when `ANTHROPIC_API_KEY` is set, otherwise Gemini (`gemini-3.5-flash-lite`). |
| i18n | **next-intl** | Typed English and Hindi catalogues; a cookie-based locale (no URL prefix), so shared links work for everyone. |
| Maps | **Leaflet** + **OpenStreetMap** | Survey location maps with no paid map key. |
| UI | **Tailwind CSS v4** + **shadcn/ui** (Base UI) + Framer Motion | Accessible primitives themed to the brand: navy `#1B263B`, cream `#F4F1DE`, gold `#C6A75E` accents. |
| Offline | **IndexedDB** (`idb`) + browser-image-compression | Survey drafts and the photo upload queue survive a lost signal. |
| Email | **Resend** (optional) | Transactional emails; skipped cleanly when not configured. |
| Testing | **Vitest** | 106 fast unit tests over all the pure business logic. |
| Hosting | **Vercel** (`icn1`, Seoul) + **Supabase** (`ap-northeast-2`, Seoul) | Functions run next to the database for low query latency. |

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
  AI[Claude / Gemini vision]
  RS[Resend email]

  C & W & A --> MW --> RSC
  C & W & A -- actions --> SA --> SVC --> PG
  SVC --> SM & BL & SOL
  SA --> EX --> AI
  RSC & API --> PDF
  C & W -. direct signed upload .-> ST
  API -. 60 s signed URL .-> ST
  SVC -- after commit --> RT -. refresh ping .-> C & W & A
  SVC -- after commit --> RS
  C -- Checkout --> RZP -- webhook --> API
  RSC --> AUTH
```

### Major components

| Component | Where | Responsibility |
|---|---|---|
| **Customer portal** | `app/(customer)/portal` | Tracker, documents, quote, payments, timeline, support |
| **Worker app** | `app/(worker)/worker` | Job list, guided survey, geo photos, installation checklist |
| **Admin console** | `app/(admin)/admin` | Overview, Customer 360, tickets, users, settings |
| **Server actions** | `lib/actions/*` | Every mutation: Zod parse → role/ownership check → transactional workflow call |
| **Workflow service** | `lib/workflow/service.ts` | `withWorkflow` transactions, timeline events, notifications, `advanceIfReady`, effects outbox |
| **State machine + blockers** | `lib/workflow/stateMachine.ts`, `blockers.ts` | Pure stage rules and "what's missing, who owes it" |
| **Solar engine** | `lib/solar/*` | Sizing, BOM, pricing (GST split, amount in words), economics, reference numbers |
| **Bill extraction** | `lib/extraction/*` | Text parser, AI vision adapter, merge, cross-checks, confidence |
| **PDF rendering** | `lib/pdf/*` | Quotation and receipt documents on the letterhead |
| **Payments** | `lib/payments/*`, `app/api/webhooks/razorpay` | Orders, signature verification, idempotent webhooks |
| **Authorization** | `lib/authz/*` | `requireRole`, `assertCanAccessProject`, pure and unit-tested ownership rules |
| **Realtime** | `lib/realtime/*` | Broadcasts after commit; a ref-counted client channel registry |
| **Storage** | `lib/storage/*` | Private buckets, signed URLs, magic-byte verification |

**How a change flows.** Every mutation is a server action:

```text
Zod.parse → requireRole / assertCanAccessProject → withWorkflow(tx => … recordEvent … notify … advanceIfReady)
```

Side effects are collected in an **effects outbox** and run only after the transaction commits: realtime pings, emails, and slow work such as PDF rendering or AI extraction.

### Project lifecycle (state machine)

A project sits *in* a stage until that stage's exit condition holds. `advanceIfReady` then moves it forward, strictly linearly, with no skipping. An invalid move throws a typed `InvalidTransitionError` with machine-readable reasons.

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

The **blockers engine** turns the same project snapshot into "what's missing and who owes it", for example:
- *Aadhaar rejected: blurry*
- *Survey overdue by 2 days*
- *Quote expires in 1 day*
- *40-day SLA at risk*

It powers both the customer's action card and the admin blockers panel.

### Quote-generation pipeline

```mermaid
flowchart LR
  B[Confirmed BillData<br/>months · load · phase] --> S
  SV[Submitted survey<br/>roof area · distances] --> S
  ST[Settings + catalog + slabs] --> S
  S["computeSizing<br/>avg = Σunits/n → /30 → /5<br/>min(required, load cap, roof cap)"] --> BOM[buildLineItems<br/>panels = kW×1000/Wp]
  BOM --> PR["computePricing<br/>₹/kW · GST 70/30 · basic/Wp<br/>Indian amount in words"]
  PR --> EC[computeEconomics<br/>subsidy · payback · 25-yr]
  EC --> Q[(Quote vN DRAFT<br/>inputs + outputs snapshotted)]
  Q --> PDF[Letterhead PDF<br/>DRAFT watermark] --> PA[PENDING_APPROVAL<br/>admins notified]
  PA -- Approve & Send --> SENT[re-dated, final PDF<br/>customer notified]
  SENT -- accept --> ACC[ACCEPTED<br/>→ ADVANCE_PAYMENT]
```

Entering the QUOTE stage triggers this pipeline automatically. A revision keeps the reference number and bumps the version; older versions become `SUPERSEDED`.

### Electricity-bill extraction

CSPDCL bill PDFs have a garbled Hindi text layer but intact digits, so extraction combines **three independent signals**:

1. A deterministic **text-layer parser** (`lib/extraction/cspdclParser.ts`) anchored on value shapes: the 10-digit service number, `4000.00W`, and `YYYY/MM reading units` table rows.
2. **AI vision** (Claude or Gemini) with a strict JSON schema, validated again with Zod. PDFs and photos/screenshots go in as they are.
3. **Cross-checks**:
   - previous reading + units ≈ current reading;
   - the months are continuous;
   - the units are plausible;
   - the text layer and the vision result agree.

   Together they give a confidence score. Low confidence or a failed critical check means *Needs review*.

Extraction runs after the upload response, so it never blocks the customer. It merges up to 24 months from the CSPDCL app screenshot, keeps months an admin typed in, and falls back to manual entry if anything fails.

---

## Data model

- **Accounts:** `User` (Supabase Auth id, role, language, active) → `Customer` (address, DPDP consent) → `Project` (stage and stage timestamps, assigned worker, system size, phase, and per-stage facts such as the subsidy application number and the dispatch, installation, net-metering, commissioning and subsidy dates, plus AMC).
- **Per project:**
  - `Document`: versioned, with an `isLatest` flag, review status and extraction status.
  - `BillData`: the extracted fields and months, the source (AI, PARSER or MANUAL), checks, confidence and confirmation.
  - `Survey` and `Photo`: with geo fields.
  - `Quote`: reference number, version, status, snapshots, totals and the acceptance IP.
  - `Payment`: milestone, method, Razorpay ids, UTR and status.
  - `ProjectEvent` (the bilingual timeline and audit trail), `Notification` and `ServiceTicket`.
- **Config and infrastructure:** `Settings` (Zod-validated JSON), `CatalogItem`, `PricingSlab`, `RefCounter`, `WebhookEvent` (idempotency), `AuditLog` and `RateLimit`.

See [`prisma/schema.prisma`](prisma/schema.prisma).

## Project structure

```text
app/
  (auth)/          login, register (customer self-sign-up)
  (customer)/      /portal: tracker, documents, quote, payments, timeline, support
  (worker)/        /worker: jobs, survey, installation
  (admin)/         /admin: overview, projects (Customer 360), tickets, users, settings
  api/             PDF routes, signed-URL redirects, Razorpay webhook
components/        UI by area (customer, worker, admin, shared) + shadcn primitives
lib/
  workflow/        state machine, blockers, transactional service + effects outbox
  solar/           sizing, BOM, pricing, economics, reference numbers
  extraction/      CSPDCL parser, AI vision, cross-checks
  actions/         server actions (every mutation)
  authz/ storage/ payments/ pdf/ realtime/ notify/ settings/ i18n/ ...
messages/          en.json, hi.json
prisma/            schema, migrations, seed (fictional demo data)
public/brand/      logo and letterhead
tests/             Vitest suites + fixtures
```

---

## Local setup

**Requirements:** Node.js 20+ (tested on Node 25) and npm.

```bash
git clone https://github.com/Sohangi-Singh/Lumora-Ops-Platform.git
cd Lumora-Ops-Platform
npm install
cp .env.example .env        # fill in values (see Environment variables)
npx prisma migrate deploy   # create tables (+ RLS lockdown)
SEED_RESET=1 npm run db:seed
npm run dev                 # http://localhost:3000
```

**No Supabase project yet?**
- Run `npm run db:local` to start an embedded Postgres on port 54329 (no Docker needed).
- Set `DATABASE_URL` and `DIRECT_URL` to `postgresql://postgres:postgres@localhost:54329/lumora` and leave the Supabase variables empty.
- In `next dev` the login page then offers a **dev-only user switcher** (`/dev/login`) to sign in as any seeded user. It is disabled whenever `NODE_ENV=production` or Supabase is configured.
- Uploads, realtime and emails need the real services.

**Supabase setup** (the free tier is enough):
1. Create a project and copy the Project URL, the anon key and the service-role key.
2. Copy two connection strings: the **transaction pooler** (port 6543; append `?pgbouncer=true&connection_limit=5&pool_timeout=20`) and the **direct** connection (port 5432).
3. Run `npx prisma migrate deploy`, then `SEED_RESET=1 npm run db:seed`. The seed creates the private buckets (`project-documents`, `project-photos`, `quotes`), the Auth users and the demo files.
4. Nothing else is needed: Realtime Broadcast needs no table publication, and the buckets have no public policies.

**Useful scripts**

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm test` | Run the 106 unit tests |
| `npm run typecheck` / `npm run lint` | Type-check / lint |
| `npm run db:local` | Start an embedded local Postgres |
| `npm run db:seed` | Seed demo data (wipes first when `SEED_RESET=1`) |
| `npm run quote:sample out.pdf` | Render a sample quotation for a fictional customer |

## Environment variables

Copy [`.env.example`](.env.example) to `.env`. **Never commit `.env`**; it is git-ignored. The service-role key and the Razorpay secrets are server-only and are imported only by `server-only` modules.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres for the app: the Supabase transaction pooler (6543) with `?pgbouncer=true&connection_limit=5&pool_timeout=20` |
| `DIRECT_URL` | ✅ | Direct Postgres connection (5432) for Prisma migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public anon key (Auth + Realtime subscribe) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Server-only**: Storage, Auth admin, Realtime broadcast |
| `NEXT_PUBLIC_APP_URL` | ✅ | Absolute app URL (emails, links) |
| `RAZORPAY_KEY_ID` | for payments | Razorpay key id (test mode) |
| `RAZORPAY_KEY_SECRET` | for payments | **Server-only** key secret (order creation, signature verification) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | for payments | Key id exposed to Checkout |
| `RAZORPAY_WEBHOOK_SECRET` | for webhooks | Webhook signing secret |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | optional | Claude vision for bill extraction |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | optional | Gemini vision (used when no Anthropic key is set; default `gemini-3.5-flash-lite`) |
| `RESEND_API_KEY` / `RESEND_FROM` | optional | Transactional email (skipped when unset) |

Without an AI key, the text parser and manual entry still work. Without Resend, in-app notifications still work.

## Deployment

**🌐 Live application: https://lumora-ops-platform-ae4b.vercel.app**

- Hosted on **Vercel**, with functions pinned to `icn1` (Seoul).
- The database, Auth, Storage and Realtime run on **Supabase** (`ap-northeast-2`, Seoul).
- Razorpay runs in **test mode**, so no real money moves.

**To deploy your own copy:**
1. Push the repository to GitHub and import it in Vercel (framework: Next.js; default build command). `vercel.json` pins functions to `icn1` to sit next to the database; change it if your Supabase region differs.
2. Add every variable above in **Vercel → Settings → Environment Variables**, with `NEXT_PUBLIC_APP_URL` set to your Vercel domain.
3. Run the migrations and the seed against the Supabase database from your machine: `npx prisma migrate deploy && SEED_RESET=1 npm run db:seed`.
4. In the Razorpay dashboard (test mode), add a webhook to `https://<your-domain>/api/webhooks/razorpay` for `payment.captured` and `payment.failed`, using the same secret as `RAZORPAY_WEBHOOK_SECRET`.

## Demo credentials

Every demo account uses the password **`Lumora@2026`**. The seed puts each customer at a different stage, so you can see the whole lifecycle at once.

| Role | Email | Where they are |
|---|---|---|
| 🧑‍💼 Admin | `admin.demo@example.com` | sees everything |
| 👷 Worker | `ravi.demo@example.com` (Hindi) | survey for Rohit scheduled later today |
| 👷 Worker | `manoj.demo@example.com` | installation in progress for Neha |
| 🏠 Customer | `kavita.demo@example.com` (Hindi) | just registered, no documents yet |
| 🏠 Customer | `priya.demo@example.com` | Aadhaar **rejected** (blurry), PAN under review |
| 🏠 Customer | `rohit.demo@example.com` | site survey scheduled |
| 🏠 Customer | `anjali.demo@example.com` (Hindi) | quote **awaiting admin approval** |
| 🏠 Customer | `vikram.demo@example.com` | 90% advance **paid** (Razorpay) → subsidy application |
| 🏠 Customer | `neha.demo@example.com` (Delhi NCR) | installation, **40-day SLA at risk** |
| 🏠 Customer | `suresh.demo@example.com` (Hindi) | **commissioned**, subsidy credited, AMC ticket open |

All people, addresses, phone numbers and documents in the seed are fictional. You can also sign up as a new homeowner from the register page.

## Testing payments (Razorpay test mode)

- **Card:** `4111 1111 1111 1111`, any future expiry, any CVV and any name; on the OTP page choose *Success*.
- **UPI:** `success@razorpay` (succeeds) or `failure@razorpay` (fails).
- **Netbanking:** pick any bank, then *Success* or *Failure* on the mock page.

Edge cases worth trying:
- **Dismiss Checkout:** the status stays "awaiting payment".
- **A failed payment:** it is recorded as FAILED and can be retried.
- **Paying twice in two tabs:** the same order is reused, and a second capture is flagged for refund.
- **A bank-transfer UTR:** an admin verifies or rejects it.

## Security

- **Authorization on the server, always.**
  - Every action and route goes through `lib/authz` (`requireRole`, `assertCanAccessProject`), and the ownership rules are pure and unit-tested.
  - Customers get 404 (not 403) for other customers' projects, so ids can't be probed.
  - Workers never receive KYC documents or prices.
- **Private storage only.**
  - Files live in private buckets, and every read is a 60-second signed URL issued after the authorization check. Every document view is audit-logged.
  - Uploads use one-time signed URLs. The server then verifies **magic bytes** and the real file size, and deletes disguised executables.
- **Defence in depth.** RLS is enabled on every public table with no policies, so the public anon key can read nothing through PostgREST.
- **Sensitive data.** Aadhaar numbers are only ever displayed masked (`XXXX XXXX 1234`), and DPDP consent is recorded at sign-up.
- **Payments.**
  - Checkout signatures (HMAC-SHA256 of `order_id|payment_id`) and webhook signatures (over the raw body) are verified with constant-time comparison.
  - Webhooks are idempotent per event.
  - Amounts always come from the accepted quote's snapshot, never from the client.
- **Abuse limits.**
  - Postgres-backed rate limits on login, registration, uploads, orders and tickets.
  - Zod on every input, plus Next.js server-action CSRF protection.
  - Security headers: HSTS, frame options, no-sniff, and referrer and permissions policies.

## Testing

```bash
npm test
```

**106 Vitest tests** cover the pure business logic:
- **Sizing** with a real-world sheet (5,279 units over 7 months → 754 avg → 25.1/day → 5.03 kW → **5 kW**); roof and load caps; never rounding up past a cap.
- **Pricing**: 5 kW → **₹3,51,000**, "Three Lakh Fifty-One Thousand Only"; the GST split; basic price per Wp; slab selection; Indian amount-in-words up to crores.
- **Reference numbers** (`0241/RPR/10/2026-2027`) and the **April financial-year rollover** in IST.
- **Every state-machine transition**, valid and invalid (skips, backwards moves, moves after the final stage), plus guards and auto-advance.
- **Blockers** for every stage, including SLA risk and breach and quote expiry.
- **Razorpay** checkout and webhook signature verification.
- **Extraction**: the CSPDCL parser on a synthetic bill, schema coercion, cross-checks and confidence.
- Everything else:
  - the quote pipeline end to end;
  - survey requirements;
  - magic-byte sniffing;
  - Aadhaar masking;
  - authorization rules;
  - **EN/HI message-key parity**.

The live deployment has also been tested end to end:
- sign-up;
- uploads and realtime updates;
- bill extraction;
- survey and quote approval;
- a Razorpay payment confirmed by the webhook;
- the receipt PDF and every later stage.

## Design decisions

- **Basic price per Wp.** Our sample quotation prints 64.645. Splitting the GST-inclusive value 70/30 and backing out GST from each part gives 64.647, which is the default. A "blended rate" formula gives 64.463. The formula can be switched in *Settings → Quotation* (see `computeBasicPerWp()`).
- **Load cap.** Sizing caps at the sanctioned (contract) load printed on the bill, falling back to the connected load if that is all the bill shows.
- **Subsidy.**
  - Central assistance follows the PM Surya Ghar slabs: ₹30,000/kW for the first 2 kW and ₹18,000 for the 3rd, capped at ₹78,000.
  - The state subsidy is a configurable flat amount (₹30,000) for systems of 1 kW or more.
- **Realtime as invalidation, not data.** This keeps authorization in exactly one place: the server.
- **Cookie locale instead of `/hi/...` URLs.** A link the office sends works for everyone, whatever language they use.

## Roadmap

- 💬 WhatsApp status updates and document collection (WhatsApp Business API)
- 📈 Live generation monitoring from the inverter's cloud API on the customer dashboard
- 🎁 A referral programme with tracked rewards
- 🏛️ Subsidy auto-tracking against the PM Surya Ghar portal
- 📱 An installable offline-first PWA for the worker app

---

## Author

**Sohangi Singh**, founder of Lumora Solar and builder of Lumora Solar Ops.
GitHub: [@Sohangi-Singh](https://github.com/Sohangi-Singh)

<div align="center">
<sub>Built for Lumora Solar · Raipur & Delhi NCR · ☀️ उज्ज्वल कल की ऊर्जा</sub>
</div>
