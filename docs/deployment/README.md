# GharSync release and operations guide

## Runtime layout

- Web: Node.js 24.15+ and Next.js server, public port 3000 behind HTTPS reverse proxy.
- API: NestJS server, health `/api/v1/health`, readiness `/api/v1/health/ready`, default port 4000.
- Primary database: managed PostgreSQL for production; PGlite is for one-process local development only.
- Documents: private filesystem locally; production should use a private S3-compatible bucket, short-lived signed downloads and object lifecycle policies.
- Message delivery: server-only SMS/email provider adapters. WhatsApp and push are reported unconfigured until their official integrations are added.
- Background queue: Redis/BullMQ is not currently required or implemented as an active worker. Add it only when scheduled reminders, retries or asynchronous document work are introduced.

## Production checklist

1. Build and typecheck the exact commit with CI; review database migrations and accessibility/security changes.
2. Provision PostgreSQL with encrypted connections, automated point-in-time backups and restore drills. Set `DATABASE_MODE=postgres` and `DATABASE_URL` to a least-privilege application account.
3. Apply migrations with `npx prisma migrate deploy --config apps/api/prisma.config.ts`; do not run `prisma migrate dev` against production.
4. Set strong independent `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_HMAC_SECRET`, `WEB_ORIGIN`, `APP_URL`, `API_PORT`, `NEXT_PUBLIC_API_BASE_URL`, `API_INTERNAL_URL` and `DOCUMENT_STORAGE_PATH`. Use a secret manager; never copy `.env.example` secrets into production.
5. Configure and test SMS OTP delivery. Add email delivery before inviting staff or using password recovery. The provider contract must document acceptance separately from delivery receipts.
6. Configure `PLATFORM_ADMIN_EMAILS` as a comma-separated allowlist for the protected control center. Use dedicated operator accounts and MFA at the identity provider/reverse proxy.
7. Configure an AI provider only after privacy review. AI assistance requires Growth/Business entitlement and the platform rollout flag; email and Pakistan phone patterns are redacted before sending request text.
8. Configure HTTPS and host-only secure cookies, restrictive CORS `WEB_ORIGIN`, trusted CSRF origins and reverse-proxy request limits. Keep API ports private to the web tier where practical.
9. Point document storage at private durable storage, define data retention and deletion policy, and verify upload/download authorization plus virus scanning integration before public uploads.
10. Deploy the API and web processes with restart supervision, central structured logs, error alerts and uptime monitoring. Do not publish test accounts or local OTP behavior.
11. Confirm `/api/v1/health` and `/api/v1/health/ready` from the deployment environment; perform one signup/OTP, booking/assignment, quote/invoice and verified-payment smoke flow.
12. Verify backup restore and rollback instructions before enabling real customer traffic.

## Provider adapter contracts

### SMS and email

The API sends an HTTP POST with a bearer API key. SMS JSON body is `{ "to": "...", "message": "..." }`; email JSON body is `{ "to": "...", "subject": "...", "text": "..." }`. OTP delivery accepts an HTTP success response. In the notification ledger, a non-success response is `FAILED`; a success response without JSON `{ "status": "delivered" }` remains `QUEUED`; only that explicit receipt becomes `SENT`. Store provider delivery webhooks separately if the provider confirms asynchronously.

### AI draft service

By default, draft assistance and the help desk use the API server's local Ollama instance. Install Ollama and pull the configured model (`ollama pull lfm3-omni`); set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` server-side. The AI status checks local reachability and model installation. Help desk image analysis uses the model's image input; PDF text extraction needs Poppler and video frame extraction needs FFmpeg. Keep Ollama bound to a trusted local/private interface because help desk prompts are sent to it. Draft assistance requires a live Growth/Business plan and the `ai-assistant` rollout flag.

An optional OpenAI-compatible draft adapter can override Ollama. `AI_PROVIDER_URL` receives `{ task, language, instructions, text, catalogReference }` with a bearer key and may return `{ "output": "..." }` or `{ "text": "..." }`. Email addresses and Pakistan mobile patterns are redacted before sending. Timeouts and failures are logged. Output must remain a draft, use no invented prices and require staff review. This adapter receives text only.

### Billing

Subscription plans and trial records are active; branch, staff and monthly-booking limits are enforced. Paid plan changes create an audited support request. Automated card/mobile-wallet charging, signed billing webhooks, invoices and retry/dunning are intentionally disabled until a payment provider and idempotent event ledger are implemented.

## Local data and backups

PGlite database files live at `var/pglite`; local uploaded documents default to `var/documents`. Stop the API before copying the database directory. For a clean demo reset, stop the API, back up or remove `var/pglite`, then restart. Never seed demo records in production; `npm run seed:demo` refuses non-local hosts and production mode.

## Known deployment work

Production launch still requires a selected SMS/email vendor, durable S3-compatible object storage and scanning, a payment gateway/webhook, retention/legal review, customer satisfaction collection, monitoring vendor, backup/restore rehearsal, and operator playbooks tailored to the hosting provider.
