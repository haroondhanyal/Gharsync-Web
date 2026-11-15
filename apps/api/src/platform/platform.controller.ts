import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentAuth, RequirePermission, type AuthContext } from "../auth/auth-context.js";
import { OrganizationAccessGuard } from "../auth/organization-access.guard.js";
import { PlatformService } from "./platform.service.js";

const planSchema = z.object({ planKey: z.string().min(2).max(40) });
const ticketStatusSchema = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"]) });
const flagSchema = z.object({ enabled: z.boolean() });
const verificationSchema = z.object({ status: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]) });
const platformPlanSchema = z.object({ monthlyPrice: z.number().finite().min(0).max(9999999999), annualPrice: z.number().finite().min(0).max(9999999999), maxBranches: z.number().int().min(1).nullable(), maxStaff: z.number().int().min(1).nullable(), maxMonthlyJobs: z.number().int().min(1).nullable(), isActive: z.boolean() });

@Controller("billing")
@UseGuards(OrganizationAccessGuard)
export class BillingController {
  constructor(private readonly platform: PlatformService) {}
  @Get("plans") plans(@CurrentAuth() _auth: AuthContext) { return this.platform.plans(); }
  @Get("subscription") subscription(@CurrentAuth() auth: AuthContext) { return this.platform.currentSubscription(auth); }
  @Post("plan-requests") @RequirePermission("billing.manage") request(@CurrentAuth() auth: AuthContext, @Body({ schema: planSchema }) body: z.infer<typeof planSchema>) { return this.platform.requestPlan(auth, body.planKey); }
}

@Controller("platform")
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}
  @Get("overview") overview(@CurrentAuth() auth: AuthContext) { return this.platform.overview(auth); }
  @Get("organizations") organizations(@CurrentAuth() auth: AuthContext) { return this.platform.organizations(auth); }
  @Get("users") users(@CurrentAuth() auth: AuthContext) { return this.platform.users(auth); }
  @Get("audit-logs") auditLogs(@CurrentAuth() auth: AuthContext) { return this.platform.auditLogs(auth); }
  @Get("plans") plans(@CurrentAuth() auth: AuthContext) { return this.platform.adminPlans(auth); }
  @Patch("organizations/:id/verification") verification(@CurrentAuth() auth: AuthContext, @Param("id", { schema: z.uuid() }) id: string, @Body({ schema: verificationSchema }) body: z.infer<typeof verificationSchema>) { return this.platform.updateVerification(auth, id, body.status); }
  @Patch("plans/:id") updatePlan(@CurrentAuth() auth: AuthContext, @Param("id", { schema: z.uuid() }) id: string, @Body({ schema: platformPlanSchema }) body: z.infer<typeof platformPlanSchema>) { return this.platform.updatePlan(auth, id, body); }
  @Get("tickets") tickets(@CurrentAuth() auth: AuthContext) { return this.platform.tickets(auth); }
  @Patch("tickets/:id") updateTicket(@CurrentAuth() auth: AuthContext, @Param("id", { schema: z.uuid() }) id: string, @Body({ schema: ticketStatusSchema }) body: z.infer<typeof ticketStatusSchema>) { return this.platform.updateTicket(auth, id, body.status); }
  @Patch("flags/:key") updateFlag(@CurrentAuth() auth: AuthContext, @Param("key", { schema: z.string().min(2).max(80) }) key: string, @Body({ schema: flagSchema }) body: z.infer<typeof flagSchema>) { return this.platform.setFlag(auth, key, body.enabled); }
}
