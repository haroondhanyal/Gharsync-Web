import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module.js";
import { CustomersModule } from "./customers/customers.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { JwtAuthGuard } from "./auth/jwt-auth.guard.js";
import { HealthController } from "./health/health.controller.js";
import { HomesModule } from "./homes/homes.module.js";
import { WorkflowsModule } from "./workflows/workflows.module.js";
import { OrganizationsModule } from "./organizations/organizations.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { OperationsModule } from "./operations/operations.module.js";
import { CommunicationsModule } from "./communications/communications.module.js";
import { PlatformModule } from "./platform/platform.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    ThrottlerModule.forRoot([
      { name: "default", ttl: 60_000, limit: process.env.NODE_ENV === "development" ? 600 : 120 },
      // The named auth bucket is global too; keep its default high and let the
      // auth controller's per-route @Throttle limits protect sign-in/signup.
      { name: "auth", ttl: 60_000, limit: process.env.NODE_ENV === "production" ? 120 : 600 },
    ]),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    CustomersModule,
    DashboardModule,
    HomesModule,
    WorkflowsModule,
    OperationsModule,
    CommunicationsModule,
    PlatformModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
