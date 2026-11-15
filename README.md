<div align="center">
  <img src="apps/web/public/gharsync-mark.svg" width="76" height="76" alt="GharSync house and sparkle mark" />
  <h1>GharSync</h1>
  <p><strong>Your Home. Your Services. One Platform.</strong></p>
  <p>Pakistan-first home care and service-business operations, built to grow from one home to a connected service network.</p>
</div>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" />
  <img alt="NestJS" src="https://img.shields.io/badge/API-NestJS-EA2845?logo=nestjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white" />
  <img alt="Prisma" src="https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma&logoColor=white" />
</p>

## What is GharSync?

GharSync brings customers, home assets, local service professionals and business operations into one platform. The product is being developed in phases, with tenant-aware data boundaries and modular feature ownership from the start.

The first implementation slice includes the public website and responsive login/sign-up screens. The API, database schema and local infrastructure foundation are being established in Phase 1. Authentication and operational workflows are not production-ready until their later phases are implemented.

## Product direction

- **For homes:** Keep properties, appliances, service history, warranties and maintenance requests together.
- **For service teams:** Manage customers, branches, bookings, technicians, quotes, invoices and stock.
- **For the platform:** Support multiple organizations with server-enforced permissions and tenant isolation.
- **Pakistan first:** PKR currency and `Asia/Karachi` timezone defaults, with room for international expansion.

## Architecture

```mermaid
flowchart LR
  Customer[Customer / Business staff] --> Web[Next.js web app]
  Web -->|Versioned REST /api/v1| API[NestJS API]
  API --> Prisma[Prisma data layer]
  Prisma --> PG[(PostgreSQL)]
  API --> Redis[(Redis / BullMQ foundation)]
  API -. Phase 8 adapters .-> Providers[SMS · Email · Push · WhatsApp]
  API -. Phase 8 AI adapter .-> LLM[Configurable LLM provider]
  API -. Phase 9 billing adapter .-> Payments[Payment providers]
```

```text
apps/
  web/                 Next.js App Router screens and UI
  api/                 NestJS versioned API and Prisma schema
packages/
  shared-types/        API envelopes and cross-app domain types
  validation/          Shared Zod request schemas
  config/              Reserved for agreed shared tooling presets
docs/
  DEVELOPMENT_PHASES.md Team plan, phase boundaries and status
  database/            Data model decisions and migration notes
```

Web screens belong in route folders under `apps/web/src/app`; reusable UI belongs in `apps/web/src/components`. API modules own their DTOs, services, authorization checks and persistence calls. Shared contracts live in `packages/`, and frontend code never accesses the database directly.

## Local development

### Requirements

- Node.js 22.22.3+ or 24.15.0+ (required by the NestJS 12 CLI toolchain)
- npm 10 or newer
- Docker Desktop or Docker Engine with Compose

### Start

```bash
cp .env.example .env
npm install
npm run infra:up
npm run db:generate
npm run db:migrate
npm run dev:web
```

In a second terminal, start the API:

```bash
npm run dev:api
```

- Web app: <http://localhost:3000>
- API health: <http://localhost:4000/api/v1/health>
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

The first database migration will be created and applied by Prisma when the local database is available. No fake customers or production workflow records are seeded in Phase 1.

### Useful commands

| Command | Purpose |
|---|---|
| `npm run dev:web` | Start the Next.js app |
| `npm run dev:api` | Start the NestJS API in watch mode |
| `npm run build:web` | Build the web app |
| `npm run build:api` | Build the API |
| `npm run typecheck` | Type-check configured workspaces |
| `npm test` | Run configured workspace unit tests |
| `npm run infra:up` | Start local PostgreSQL and Redis |
| `npm run infra:down` | Stop local services (keeps named volumes) |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Create/apply a local Prisma migration |

## Environment and secrets

Copy `.env.example` to `.env`. The checked-in example contains local-only development defaults. Never use those values outside a developer machine and never commit real credentials. Authentication keys and provider credentials are added with the phases that introduce those integrations.

## Security and data rules

- Treat organization and branch IDs from clients as untrusted input.
- Enforce tenant and role permissions in API guards/services and every scoped query.
- Keep audit/event history for security-sensitive and workflow state changes.
- Model money as PostgreSQL `Decimal`, with currency stored explicitly.
- Do not mark invoices paid without a verified payment record.
- Do not claim delivery for a message until a provider confirms it.
- Keep provider credentials on the server and validate webhook signatures.

## Delivery phases

See [the development phase plan](docs/DEVELOPMENT_PHASES.md) for scope, team ownership and exit criteria. Phase 1 establishes architecture, domain data foundations, local services and this developer guide. Later feature teams can work in parallel once shared contracts and schema ownership are reviewed.

## License

Proprietary — GharSync. All rights reserved.
