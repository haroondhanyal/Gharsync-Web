import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { NotificationsController, AiController } from "./communications.controller.js";
import { CommunicationsService } from "./communications.service.js";

@Module({ imports: [AuthModule], controllers: [NotificationsController, AiController], providers: [CommunicationsService] })
export class CommunicationsModule {}
