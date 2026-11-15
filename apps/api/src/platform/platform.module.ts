import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PlatformController, BillingController } from "./platform.controller.js";
import { PlatformService } from "./platform.service.js";
import { EntitlementsModule } from "./entitlements.module.js";

@Module({ imports: [AuthModule, EntitlementsModule], controllers: [BillingController, PlatformController], providers: [PlatformService], exports: [EntitlementsModule] })
export class PlatformModule {}
