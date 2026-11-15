# GharSync development phases

The supplied master prompt describes a full commercial SaaS platform. Build it in ten reviewable phases, with stable API contracts and schema ownership agreed before feature teams work in parallel.

| Phase | Scope | Suggested owner(s) | Status |
|---|---|---|---|
| 1. Foundation and architecture | Monorepo, product/design foundation, route map, tenant-aware core schema, Docker services and developer docs | Architect + web lead + data/API lead | Complete in code; local DB apply pending Docker daemon |
| 2. Identity and tenancy | Auth, phone OTP adapter, sessions, organizations, branches, invitations, permissions and tenant isolation | Identity/API team + web auth team | Implemented; migration apply and provider credentials pending |
| 3. Business console and CRM | Database-backed dashboard, customers, search, filters and customer profiles | Dashboard team + CRM/API team | Implemented in code; database-backed review pending |
| 4. Homes and assets | Properties, assets, documents, QR access and service history | Home/assets team |
| 5. Service workflows | Catalog, booking lifecycle, technician assignment, quotations, invoices and verified payments | Operations team + finance/API team |
| 6. Workforce | Technician profiles, skills, schedules, availability, workload and performance | Workforce team |
| 7. Inventory and warranty | Branch stock, stock movements, suppliers, claims and expiry alerts | Inventory team |
| 8. Communications and AI | Provider adapters, delivery logs, notifications, safe AI assistance and usage audit | Integrations team |
| 9. SaaS billing and platform admin | Plans, entitlements, subscriptions, support and protected admin controls | Platform team |
| 10. Release readiness | Accessibility, security, monitoring, performance, backups, deployment and runbooks | QA + DevOps + security |

## Phase 1 acceptance criteria

- A clean workspace has separate web, API and shared package boundaries.
- The web app has a coherent GharSync identity and responsive public/auth screens.
- The API exposes a versioned health endpoint and has a clear place for feature modules and persistence.
- The core Prisma schema captures organizations, memberships, branches and the customer-to-booking domain with tenant keys and indexes.
- PostgreSQL and Redis can be started locally from Docker Compose; environment setup and run commands are documented.
- The README explains the product, architecture, repository map, security principles and delivery plan.

## Parallel team boundaries

- Web feature teams own their route group, screen components, interaction states and web-facing API hooks.
- API feature teams own the matching Nest module, DTOs, services, access checks, schema changes and focused docs.
- Shared request/response contracts and Zod validation live in `packages/shared-types` and `packages/validation`.
- Shared core schema, auth/session contracts and design tokens each have a named reviewer before parallel changes land.
- Feature teams must not bypass tenant filtering or rely on frontend-only permission checks.
- Each phase ends with migration/docs updated and agreed acceptance criteria reviewed.

## Status and remaining work

Phases 1 through 3 now have their initial implementation in code. Phase 2 adds password sign-in and registration, server-side password hashing, rotating refresh sessions, session revocation, phone OTP verification, password recovery, organization membership, invitations, role permissions, branch scope and security audit events. SMS and email are provider adapters configured through environment variables; the app reports unconfigured delivery clearly and does not pretend a message was sent.

Phase 3 adds an organization-scoped overview, customer directory/search/filter/pagination, customer create/edit/archive/profile and CSV export, plus team, invite and branch screens. Dashboard revenue, invoices, bookings creation, inventory and technician performance depend on later product phases and are not represented as real data here.

The Prisma migration for Phases 2 and 3 is generated but has not been applied to a live local PostgreSQL instance. Docker Desktop's daemon was unavailable during this work, so database-backed end-to-end review remains pending until Docker is available. Generate the Prisma client and apply the checked-in migrations before running the API. SMS verification also requires a real SMS adapter configuration; email recovery and invite delivery require email credentials. Until configured, these flows return a clear setup error or show a shareable invite URL when appropriate.

## Phase 2 and 3 acceptance notes

- Authentication secrets are server-only; refresh tokens are stored hashed and rotated, and passwords use Node's scrypt password hashing.
- Authorization is checked in API guards/services and data queries are constrained to the active organization and (when assigned) branch.
- Public/auth pages include account type selection, verification, password recovery and an illustrated responsive side panel.
- The business console and customer pages use live API responses and have responsive desktop/mobile navigation.
- Applying migrations, provider configuration, and database-backed review remain operational follow-ups; quote/payment workflows are owned by later phases.
