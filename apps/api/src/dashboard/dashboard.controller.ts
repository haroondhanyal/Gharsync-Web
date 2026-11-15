import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentAuth, RequirePermission, type AuthContext } from "../auth/auth-context.js";
import { OrganizationAccessGuard } from "../auth/organization-access.guard.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("dashboard")
@UseGuards(OrganizationAccessGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("overview")
  @RequirePermission("dashboard.read")
  overview(@CurrentAuth() auth: AuthContext) {
    return this.dashboard.overview(auth);
  }
}
