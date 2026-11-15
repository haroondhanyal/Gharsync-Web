import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module.js";
import { CustomersModule } from "./customers/customers.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { JwtAuthGuard } from "./auth/jwt-auth.guard.js";
import { HealthController } from "./health/health.controller.js";
import { OrganizationsModule } from "./organizations/organizations.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    ThrottlerModule.forRoot([
      { name: "default", ttl: 60_000, limit: 120 },
      { name: "auth", ttl: 60_000, limit: 8 },
    ]),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    CustomersModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
