import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthContext } from "../auth/auth-context.js";
import { randomUUID } from "node:crypto";

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private assertPlatformAdmin(auth: AuthContext) {
    const allowed = (this.config.get<string>("PLATFORM_ADMIN_EMAILS") ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
    if (!allowed.includes(auth.email.toLowerCase())) throw new ForbiddenException("Platform administrator access is not enabled for this account.");
  }

  async plans() {
    return this.prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, key: true, name: true, description: true, monthlyPrice: true, annualPrice: true, currency: true, maxBranches: true, maxStaff: true, maxMonthlyJobs: true, features: true } });
  }

  async adminPlans(auth: AuthContext) {
    this.assertPlatformAdmin(auth);
    return this.prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, key: true, name: true, description: true, monthlyPrice: true, annualPrice: true, currency: true, maxBranches: true, maxStaff: true, maxMonthlyJobs: true, features: true, isActive: true } });
  }

  async currentSubscription(auth: AuthContext) {
    if (!auth.organizationId) throw new ForbiddenException();
    const membership = await this.prisma.organizationMember.findFirst({ where: { organizationId: auth.organizationId, userId: auth.userId, status: "ACTIVE" }, select: { role: true } });
    if (!membership || !["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) throw new ForbiddenException("Your role cannot view billing details.");
    const [subscription, jobsThisMonth] = await Promise.all([
      this.prisma.subscription.findFirst({ where: { organizationId: auth.organizationId }, include: { plan: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.booking.count({ where: { organizationId: auth.organizationId, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
    ]);
    return { subscription, jobsThisMonth, billingProvider: "not-configured", paymentsEnabled: false };
  }

  async requestPlan(auth: AuthContext, key: string) {
    if (!auth.organizationId) throw new ForbiddenException();
    const membership = await this.prisma.organizationMember.findFirst({ where: { organizationId: auth.organizationId, userId: auth.userId, status: "ACTIVE" }, select: { role: true } });
    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) throw new ForbiddenException("Only an owner or administrator can request a plan change.");
    const plan = await this.prisma.subscriptionPlan.findFirst({ where: { key, isActive: true }, select: { key: true, name: true } });
    if (!plan) throw new NotFoundException("Subscription plan not found.");
    const ticketNumber = `GS-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    const ticket = await this.prisma.supportTicket.create({ data: { organizationId: auth.organizationId, userId: auth.userId, ticketNumber, priority: "NORMAL", subject: `Plan change request: ${plan.name}`, description: `Organization ${auth.organizationId} requested the ${plan.name} (${plan.key}) plan. A billing provider must be connected before charges or paid activation can occur.` } });
    await this.prisma.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, action: "billing.plan_change_requested", resourceType: "support_ticket", resourceId: ticket.id, metadata: { requestedPlan: plan.key } } });
    return { status: "REQUESTED", ticketNumber };
  }

  async overview(auth: AuthContext) {
    this.assertPlatformAdmin(auth);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [organizations, subscriptions, tickets, users, plans, flags, customers, bookings, paymentSums, health, verification] = await Promise.all([
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] } } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.subscriptionPlan.count({ where: { isActive: true } }),
      this.prisma.featureFlag.findMany({ orderBy: { key: "asc" } }),
      this.prisma.customer.count({ where: { deletedAt: null } }),
      this.prisma.booking.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
      this.prisma.payment.aggregate({ where: { status: "VERIFIED", verifiedAt: { gte: monthStart } }, _sum: { amount: true } }),
      this.prisma.$queryRaw`SELECT 1`.then(() => "ok").catch(() => "unavailable"),
      this.prisma.organization.groupBy({ by: ["verificationStatus"], _count: { _all: true } }),
    ]);
    return { organizations, users, customers, jobsThisMonth: bookings, verifiedPaymentsThisMonth: paymentSums._sum.amount?.toString() ?? "0", paymentCurrency: "multiple", paymentsEnabled: false, database: health, openSupportTickets: tickets, activePlans: plans, subscriptions: Object.fromEntries(subscriptions.map((row) => [row.status, row._count._all])), verification: Object.fromEntries(verification.map((row) => [row.verificationStatus, row._count._all])), flags };
  }

  async organizations(auth: AuthContext) {
    this.assertPlatformAdmin(auth);
    return this.prisma.organization.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, name: true, slug: true, businessType: true, verificationStatus: true, currency: true, timezone: true, createdAt: true, _count: { select: { members: true, customers: true, bookings: true } }, subscriptions: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, periodEnd: true, plan: { select: { name: true, key: true } } } } } });
  }

  async users(auth: AuthContext) {
    this.assertPlatformAdmin(auth);
    return this.prisma.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, fullName: true, email: true, phoneVerifiedAt: true, createdAt: true, _count: { select: { memberships: true } } } });
  }

  async auditLogs(auth: AuthContext) {
    this.assertPlatformAdmin(auth);
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, organizationId: true, action: true, resourceType: true, resourceId: true, createdAt: true, actor: { select: { fullName: true, email: true } }, organization: { select: { name: true } } } });
  }

  async updateVerification(auth: AuthContext, organizationId: string, status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED") {
    this.assertPlatformAdmin(auth);
    const org = await this.prisma.organization.update({ where: { id: organizationId }, data: { verificationStatus: status }, select: { id: true, name: true, verificationStatus: true } }).catch(() => null);
    if (!org) throw new NotFoundException("Workspace not found.");
    await this.prisma.auditLog.create({ data: { organizationId: org.id, actorUserId: auth.userId, action: "platform.organization_verification_updated", resourceType: "organization", resourceId: org.id, metadata: { status } } });
    return org;
  }

  async updatePlan(auth: AuthContext, id: string, input: { monthlyPrice: number; annualPrice: number; maxBranches: number | null; maxStaff: number | null; maxMonthlyJobs: number | null; isActive: boolean }) {
    this.assertPlatformAdmin(auth);
    const plan = await this.prisma.subscriptionPlan.update({ where: { id }, data: { monthlyPrice: input.monthlyPrice, annualPrice: input.annualPrice, maxBranches: input.maxBranches, maxStaff: input.maxStaff, maxMonthlyJobs: input.maxMonthlyJobs, isActive: input.isActive }, select: { id: true, key: true, name: true, monthlyPrice: true, annualPrice: true, maxBranches: true, maxStaff: true, maxMonthlyJobs: true, isActive: true } }).catch(() => null);
    if (!plan) throw new NotFoundException("Plan not found.");
    await this.prisma.auditLog.create({ data: { actorUserId: auth.userId, action: "platform.subscription_plan_updated", resourceType: "subscription_plan", resourceId: plan.id, metadata: { monthlyPrice: input.monthlyPrice, annualPrice: input.annualPrice, isActive: input.isActive } } });
    return plan;
  }

  async tickets(auth: AuthContext) {
    this.assertPlatformAdmin(auth);
    return this.prisma.supportTicket.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: 100, include: { user: { select: { fullName: true, email: true } }, organization: { select: { name: true } } } });
  }

  async updateTicket(auth: AuthContext, id: string, status: "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED") {
    this.assertPlatformAdmin(auth);
    const item = await this.prisma.supportTicket.findUnique({ where: { id }, select: { id: true, organizationId: true } });
    if (!item) throw new NotFoundException("Support ticket not found.");
    const updated = await this.prisma.supportTicket.update({ where: { id }, data: { status } });
    await this.prisma.auditLog.create({ data: { organizationId: item.organizationId, actorUserId: auth.userId, action: "platform.support_ticket_updated", resourceType: "support_ticket", resourceId: id, metadata: { status } } });
    return updated;
  }

  async setFlag(auth: AuthContext, key: string, enabled: boolean) {
    this.assertPlatformAdmin(auth);
    const flag = await this.prisma.featureFlag.update({ where: { key }, data: { enabled } }).catch(() => null);
    if (!flag) throw new NotFoundException("Feature flag not found.");
    await this.prisma.auditLog.create({ data: { actorUserId: auth.userId, action: "platform.feature_flag_updated", resourceType: "feature_flag", resourceId: flag.id, metadata: { key, enabled } } });
    return flag;
  }
}
