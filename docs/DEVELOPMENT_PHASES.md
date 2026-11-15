# GharSync development phases

The supplied master prompt describes a full commercial SaaS platform. Build it in ten reviewable phases, with stable API contracts and schema ownership agreed before feature teams work in parallel.

| Phase | Scope | Suggested owner(s) | Status |
|---|---|---|---|
| 1. Foundation and architecture | Monorepo, product/design foundation, route map, tenant-aware core schema, Docker services and developer docs | Architect + web lead + data/API lead | Complete in code; local DB apply pending Docker daemon |
| 2. Identity and tenancy | Auth, phone OTP adapter, sessions, organizations, branches, invitations, permissions and tenant isolation | Identity/API team + web auth team |
| 3. Business console and CRM | Database-backed dashboard, customers, search, filters and customer profiles | Dashboard team + CRM/API team |
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

The prior UI slice has been moved into `apps/web`. Phase 1 architecture, core data design, generated initial migration, local infrastructure configuration and developer documentation are in place. Type checks, API/web production builds, Prisma schema validation and the API health unit test pass. Applying the migration against a live local PostgreSQL instance remains pending because Docker Desktop's daemon is not running. This phase does not implement production authentication, customer workflows, quote/payment persistence or role enforcement; those belong to their listed phases.
