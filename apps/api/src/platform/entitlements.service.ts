import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

type Capacity = "branches" | "staff" | "monthlyJobs";
const names: Record<Capacity, string> = { branches: "branch", staff: "team member", monthlyJobs: "monthly booking" };

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCapacity(organizationId: string, capacity: Capacity) {
    const subscription = await this.prisma.subscription.findFirst({ where: { organizationId, status: { in: ["TRIAL", "ACTIVE"] }, periodEnd: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { plan: { select: { maxBranches: true, maxStaff: true, maxMonthlyJobs: true } } } });
    if (!subscription) throw new ForbiddenException("This workspace has no active subscription or trial. Contact your organization administrator.");
    const limit = capacity === "branches" ? subscription.plan.maxBranches : capacity === "staff" ? subscription.plan.maxStaff : subscription.plan.maxMonthlyJobs;
    if (limit === null) return;
    const count = capacity === "branches"
      ? await this.prisma.branch.count({ where: { organizationId, deletedAt: null } })
      : capacity === "staff"
        ? await this.prisma.organizationMember.count({ where: { organizationId, status: { in: ["ACTIVE", "INVITED"] } } })
        : await this.prisma.booking.count({ where: { organizationId, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } });
    if (count >= limit) throw new ForbiddenException(`Your plan allows ${limit} ${names[capacity]} records. Upgrade your plan or contact your platform administrator.`);
  }
}
