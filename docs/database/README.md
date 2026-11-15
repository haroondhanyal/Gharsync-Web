# Phase 1 data model

The initial Prisma schema establishes the tenant and service lifecycle foundations: users, organizations, membership, branches, customers and addresses, properties, assets, services, bookings and immutable booking events.

## Modeling rules

- IDs are UUIDs; database tables use snake_case names.
- Every business record carries `organizationId` and an organization relation. Scoped queries must always include the active tenant.
- Branch access is optional at membership level because an owner may have organization-wide access. Fine-grained permission grants arrive in Phase 2.
- Soft deletion uses `deletedAt` for records that may need operational recovery or audit context.
- Money uses `Decimal`, never floating point. Currency defaults to PKR at organization level.
- Booking status changes need a corresponding `BookingEvent`; valid transitions will be centralized in the Phase 5 workflow service.
- User identity and organization membership are separate so one user can participate in several organizations.

## Planned schema additions

The following domain groups are added with their implementation phases rather than being represented by unused tables early:

- Phase 2: refresh sessions, OTP challenges, permissions, invitations and audit details.
- Phase 5: quotes, quote revisions/items, invoices, invoice items, payments and refunds.
- Phase 6: technician profiles, skills, availability, assignments and attendance.
- Phase 7: inventory products, suppliers, purchase orders, stock movements and warranty claims.
- Phase 8: notification templates/delivery logs, provider events and AI usage logs.
- Phase 9: subscription plans, entitlements, subscription history, support and platform administration.

Each addition must include tenant-aware indexes, explicit foreign keys, migration notes and authorization coverage.
