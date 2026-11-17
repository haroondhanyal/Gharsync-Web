# GharSync development phases

The supplied master prompt describes a full commercial SaaS platform. Build it in ten reviewable phases, with stable API contracts and schema ownership agreed before feature teams work in parallel.

| Phase | Scope | Suggested owner(s) | Status |
|---|---|---|---|
| 1. Foundation and architecture | Monorepo, design foundation, tenant-aware schema, embedded local database and developer docs | Architect + web lead + data/API lead | Complete; Docker optional |
| 2. Identity and tenancy | Auth, OTP, sessions, organizations, branches, invitations, permissions and tenant isolation | Identity/API team + web auth team | Complete and locally exercised |
| 3. Business console and CRM | Database-backed dashboard, customers, search, filters and customer profiles | Dashboard team + CRM/API team | Complete and locally exercised |
| 4. Homes and assets | Properties, assets, documents, QR access and service history | Home/assets team | Complete and locally exercised |
| 5. Service workflows | Catalog, booking lifecycle, technician assignment, quotations, invoices and verified payments | Operations team + finance/API team | Complete and locally exercised |
| 6. Workforce | Technician profiles, skills, schedules, availability, workload and performance | Workforce team | Complete and locally exercised |
| 7. Inventory and warranty | Branch stock, stock movements, suppliers, claims and expiry alerts | Inventory team | Complete and locally exercised |
| 8. Communications and AI | Provider adapters, delivery logs, notifications, safe AI assistance and usage audit | Integrations team | Complete and locally exercised |
| 9. SaaS billing and platform admin | Plans, entitlements, subscriptions, support and protected admin controls | Platform team | Complete; payment charging intentionally disabled |
| 10. Release readiness | Accessibility, security, monitoring, performance, backups, deployment and runbooks | QA + DevOps + security | Complete for current deployment boundary; hosted integrations remain |

## Phase 1 acceptance criteria

- A clean workspace has separate web, API and shared package boundaries.
- The web app has a coherent GharSync identity and responsive public/auth screens.
- The API exposes a versioned health endpoint and has a clear place for feature modules and persistence.
- The core Prisma schema captures organizations, memberships, branches and the customer-to-booking domain with tenant keys and indexes.
- A persistent local database starts in the Node process; Docker Compose services remain optional.
- The README explains the product, architecture, repository map, security principles and delivery plan.

## Parallel team boundaries

- Web feature teams own their route group, screen components, interaction states and web-facing API hooks.
- API feature teams own the matching Nest module, DTOs, services, access checks, schema changes and focused docs.
- Shared request/response contracts and Zod validation live in `packages/shared-types` and `packages/validation`.
- Shared core schema, auth/session contracts and design tokens each have a named reviewer before parallel changes land.
- Feature teams must not bypass tenant filtering or rely on frontend-only permission checks.
- Each phase ends with migration/docs updated and agreed acceptance criteria reviewed.

## Status and remaining work

Phases 1 through 10 have implemented local API and web flows. Phase 2 adds password sign-in and registration, server-side password hashing, rotating refresh sessions, session revocation, phone OTP verification, password recovery, organization membership, invitations, role permissions, branch scope and security audit events. The local development OTP logger removes the SMS-provider requirement for local signup; production still requires SMS delivery.

Phase 3 adds an organization-scoped overview and customer CRM. Phase 4 adds property/assets, QR access, private documents and service history. Phase 5 adds branch-aware services, booking transitions, quotes, invoice PDF, verified receipts and audited refunds. Phase 6 adds technician profiles, skill matching, weekly availability, leave requests/approvals, completed-job metrics, and assignment checks for work hours and conflicts. Phase 7 adds suppliers, products, branch stocks, receipts, adjustments, reservations, transfers, consumption, reorder warnings and warranty claim lifecycle/expiry alerts. Homeowner approvals and external payment settlement remain later integrations.

The API applies checked-in Prisma migrations to persistent embedded PGlite at startup and seeds current permissions and plan catalog. Run `node scripts/e2e-local.mjs` with the local API running to exercise signup/verification, CRM, homes, booking/billing, workforce, inventory, warranty, notification logs, AI plan gating, entitlements and platform-admin denial. `npm run seed:demo` adds a fuller business fixture for local UI review. Production PostgreSQL is configured with `DATABASE_MODE=postgres` and `DATABASE_URL`; production SMS/email, subscription payment, push/WhatsApp delivery and durable file storage remain deployment integrations.

## Phase 2 and 3 acceptance notes

- Authentication secrets are server-only; refresh tokens are stored hashed and rotated, and passwords use Node's scrypt password hashing.
- Authorization is checked in API guards/services and data queries are constrained to the active organization and (when assigned) branch.
- Public/auth pages include account type selection, verification, password recovery and an illustrated responsive side panel.
- The business console and customer pages use live API responses and have responsive desktop/mobile navigation.
- The embedded database, schema migrations and API paths are locally exercised. Production deployment still needs PostgreSQL, message providers and durable document storage.

## Phase 4 and 5 acceptance notes

- Home and asset queries enforce organization and branch scope; QR codes contain revocable random tokens and resolve only after authentication.
- Document uploads allow PDF/JPEG/PNG/WebP up to 10 MB, validate file signatures, store private files outside the web root and check the saved checksum on download.
- Booking transitions are constrained and audited. Quotes use decimal arithmetic and revisions; invoice issuance is based on an accepted quote after completion.
- Payments remain pending until a permitted staff member verifies them. Verification, refunds, invoice voiding and audit events are serialized against the invoice ledger to prevent overpayment and conflicting voids.
- Type-checking, production builds, unit tests and `node scripts/e2e-local.mjs` validate the local implementation.

## Phase 6 and 7 acceptance notes

- Technician profiles and schedules are organization/branch-scoped; overlapping leave requests are rejected and managers review requests with an audit trail.
- Assignment requires an active technician profile, required skills, an open working-hours slot, no approved leave and no conflicting active job.
- Inventory movements update on-hand and reserved counts atomically, reject underflow/over-reservation, and pair both sides of a branch transfer in one transaction.
- Product, supplier, stock, booking references and warranty claims are scoped to the selected organization and branch.
- The local E2E script covers signup and OTP, CRM, homes/assets, quotes, bookings, billing, workforce, transfers, stock consumption and warranty claims.

## Phase 8 acceptance notes

- Booking receipt and key booking status changes create branch-aware in-app notifications for active team members; workspace managers can compose messages and save organization-owned templates.
- Provider errors and configuration gaps create failed/skipped/queued ledger states. A channel is reported sent only after an explicit provider delivery receipt.
- Service drafts require an active Growth/Business plan and rollout flag, are tenant-scoped and logged. They use local Ollama by default; an optional OpenAI-compatible endpoint can override it. Email and Pakistan phone patterns are redacted before text is sent to either provider. Help Desk supports local image analysis, PDF text extraction and sampled video frames (Poppler and FFmpeg are required for PDF/video).
- Quote assistance uses only the selected active service and its configured catalog bounds; it returns draft wording only and never changes quote totals or sends approval.

## Phase 9 acceptance notes

- PKR Free/Starter/Growth/Business plan definitions and 14-day trial records are seeded idempotently for new and existing organizations.
- Branch, team-member and monthly-booking caps are enforced server-side from the selected plan.
- A plan-change request creates a support ticket and audit record. Checkout, recurring charges, paid-plan activation, webhook handling and SaaS MRR reporting are disabled until a payment processor is integrated.
- Platform endpoints check a server-side email allowlist. Platform operators can review organization and verification status, update plans/flags/tickets and read user/audit data; all mutations are audited.

## Phase 10 acceptance notes

- CI runs dependency installation, client generation, typechecking, API tests and optimized web/API builds for pull requests and main.
- The app provides API liveness and database-readiness routes, public metadata, sitemap, robots exclusions, keyboard focus styles, reduced-motion support and responsive review screenshots.
- Deployment and backup/restore guidance records local PGlite boundaries and required external production integrations.
- Last local run passed `npm run typecheck`, `npm test`, `npm run build:api`, `npm run build:web`, and the Phase 1–10 local REST E2E script. Repeat these after changes before release.
