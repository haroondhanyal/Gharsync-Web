import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { DeliveryService } from "./delivery.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { OrganizationAccessGuard } from "./organization-access.guard.js";
import { PasswordHasherService } from "./password-hasher.service.js";
import { PhoneOtpService } from "./phone-otp.service.js";
import { authSecret } from "./auth-secrets.js";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: authSecret(config, "JWT_ACCESS_SECRET"),
        signOptions: { issuer: "gharsync-api", audience: "gharsync-web" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, DeliveryService, JwtAuthGuard, OrganizationAccessGuard, PasswordHasherService, PhoneOtpService],
  exports: [JwtModule, AuthService, DeliveryService, JwtAuthGuard, OrganizationAccessGuard],
})
export class AuthModule {}
