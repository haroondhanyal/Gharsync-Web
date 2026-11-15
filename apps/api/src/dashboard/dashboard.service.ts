import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { BookingStatus } from "../generated/prisma/enums.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthContext } from "../auth/auth-context.js";

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function startOfDayInZone(date: Date, timeZone: string) {
  const parts = dateParts(date, timeZone);
  const midnightAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const offsetParts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const offsetValues = Object.fromEntries(offsetParts.map((part) => [part.type, part.value]));
  const localClockAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(offsetValues.hour), Number(offsetValues.minute), Number(offsetValues.second));
  const offset = localClockAsUtc - date.getTime();
  return new Date(midnightAsUtc - offset);
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(auth: AuthContext) {
    const organizationId = auth.organizationId!;
    const organization = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { id: true, name: true, currency: true, timezone: true } });
    const branchScope = auth.branchId ? { branchId: auth.branchId } : {};
    const customerScope = { organizationId, deletedAt: null, isActive: true, ...branchScope };
    const bookingScope = { organizationId, deletedAt: null, ...branchScope };
    const now = new Date();
    const dayStart = startOfDayInZone(now, organization.timezone);
    const localNow = dateParts(now, organization.timezone);
    const monthStart = startOfDayInZone(new Date(Date.UTC(Number(localNow.year), Number(localNow.month) - 1, 1, 12)), organization.timezone);
    const [
      totalCustomers, newCustomersThisMonth, todaysBookings, bookingCounts, recentCustomers, recentBookings,
      repeatedCustomers,
    ] = await Promise.all([
      this.prisma.customer.count({ where: customerScope }),
      this.prisma.customer.count({ where: { ...customerScope, createdAt: { gte: monthStart } } }),
      this.prisma.booking.count({ where: { ...bookingScope, scheduledAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) } } }),
      this.prisma.booking.groupBy({ by: ["status"], where: bookingScope, _count: { _all: true } }),
      this.prisma.customer.findMany({
        where: customerScope, take: 6, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: { id: true, fullName: true, phone: true, createdAt: true },
      }),
      this.prisma.booking.findMany({
        where: bookingScope, take: 8, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: { id: true, status: true, createdAt: true, scheduledAt: true, customer: { select: { id: true, fullName: true } }, service: { select: { name: true } }, branch: { select: { name: true } } },
      }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM (
          SELECT b."customerId"
          FROM "bookings" b
          WHERE b."organizationId" = ${organizationId}::uuid
            AND b."deletedAt" IS NULL
            ${auth.branchId ? Prisma.sql`AND b."branchId" = ${auth.branchId}::uuid` : Prisma.empty}
            AND EXISTS (SELECT 1 FROM "customers" c WHERE c."id" = b."customerId" AND c."isActive" = true AND c."deletedAt" IS NULL)
          GROUP BY b."customerId"
          HAVING COUNT(*) > 1
        ) repeated
      `),
    ]);
    const counts = Object.fromEntries(bookingCounts.map((row) => [row.status, row._count._all])) as Partial<Record<BookingStatus, number>>;
    const pendingStatuses: BookingStatus[] = ["REQUESTED", "UNDER_REVIEW", "QUOTED", "AWAITING_APPROVAL", "APPROVED", "SCHEDULED", "ASSIGNED"];
    const inProgressStatuses: BookingStatus[] = ["TECHNICIAN_EN_ROUTE", "IN_PROGRESS"];
    const total = bookingCounts.reduce((sum, row) => sum + row._count._all, 0);
    const pendingBookings = pendingStatuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
    const inProgressBookings = inProgressStatuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
    return {
      organization,
      generatedAt: now.toISOString(),
      metrics: {
        totalCustomers,
        newCustomersThisMonth,
        repeatCustomers: Number(repeatedCustomers[0]?.count ?? 0),
        totalBookings: total,
        activeRequests: pendingBookings + inProgressBookings,
        pendingBookings,
        inProgressBookings,
        completedBookings: counts.COMPLETED ?? 0,
        cancelledBookings: counts.CANCELLED ?? 0,
        disputedBookings: counts.DISPUTED ?? 0,
        todaysBookings,
        revenue: null,
        outstandingBalance: null,
        technicianPerformance: null,
        customerSatisfaction: null,
        warrantyCases: null,
        inventoryAlerts: null,
      },
      bookingStatusCounts: bookingCounts.map(({ status, _count }) => ({ status, count: _count._all })),
      recentCustomers,
      recentBookings,
      unavailableMetrics: ["revenue", "outstandingBalance", "technicianPerformance", "customerSatisfaction", "warrantyCases", "inventoryAlerts"],
    };
  }
}
