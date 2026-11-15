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
| 8. Communications and AI | Provider adapters, delivery logs, notifications, safe AI assistance and usage audit | Integrations team |
| 9. SaaS billing and platform admin | Plans, entitlements, subscriptions, support and protected admin controls | Platform team |
| 10. Release readiness | Accessibility, security, monitoring, performance, backups, deployment and runbooks | QA + DevOps + security |

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

Phases 1 through 7 are implemented in code. Phase 2 adds password sign-in and registration, server-side password hashing, rotating refresh sessions, session revocation, phone OTP verification, password recovery, organization membership, invitations, role permissions, branch scope and security audit events. The local development OTP logger removes the SMS-provider requirement for local signup; production still requires SMS delivery.

Phase 3 adds an organization-scoped overview and customer CRM. Phase 4 adds property/assets, QR access, private documents and service history. Phase 5 adds branch-aware services, booking transitions, quotes, invoice PDF, verified receipts and audited refunds. Phase 6 adds technician profiles, skill matching, weekly availability, leave requests/approvals, completed-job metrics, and assignment checks for work hours and conflicts. Phase 7 adds suppliers, products, branch stocks, receipts, adjustments, reservations, transfers, consumption, reorder warnings and warranty claim lifecycle/expiry alerts. Homeowner approvals and external payment settlement remain later integrations.

The API applies checked-in Prisma migrations to persistent embedded PGlite at startup and seeds current permissions. Run `node scripts/e2e-local.mjs` with the local API running to exercise signup/verification, CRM, homes, booking/billing, workforce, inventory and warranty. Production PostgreSQL is configured with `DATABASE_MODE=postgres` and `DATABASE_URL`; production SMS/email and durable file storage remain deployment integrations.

## Phase 2 and 3 acceptance notes

- Authentication secrets are server-only; refresh tokens are stored hashed and rotated, and passwords use Node's scrypt password hashing.
- Authorization is checked in API guards/services and data queries are constrained to the active organization and (when assigned) branch.
- Public/auth pages include account type selection, verification, password recovery and an illustrated responsive side panel.
- The business console and customer pages use live API responses and have responsive desktop/mobile navigation.
- The embedded database, schema migrations and API paths for Phases 1–7 are locally exercised. Production deployment still needs PostgreSQL, message providers and durable document storage.

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
