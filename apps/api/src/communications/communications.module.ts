import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { NotificationsController, AiController, HelpDeskController } from "./communications.controller.js";
import { CommunicationsService } from "./communications.service.js";

@Module({ imports: [AuthModule], controllers: [NotificationsController, AiController, HelpDeskController], providers: [CommunicationsService] })
export class CommunicationsModule {}
