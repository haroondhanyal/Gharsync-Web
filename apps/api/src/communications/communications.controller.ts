import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentAuth, RequirePermission, type AuthContext } from "../auth/auth-context.js";
import { OrganizationAccessGuard } from "../auth/organization-access.guard.js";
import { CommunicationsService } from "./communications.service.js";

const notificationSchema = z.object({ eventKey: z.string().min(2).max(100), channel: z.enum(["IN_APP", "EMAIL", "SMS"]), recipient: z.string().max(320).optional(), subject: z.string().max(200).optional(), body: z.string().min(1).max(4000).optional() });
const templateSchema = z.object({ eventKey: z.string().min(2).max(100), channel: z.enum(["IN_APP", "EMAIL", "SMS"]), subject: z.string().max(200).optional(), body: z.string().min(1).max(4000), enabled: z.boolean() });
const assistSchema = z.object({ task: z.enum(["summarize", "classify", "maintenance", "quote"]), text: z.string().min(1).max(6000), serviceId: z.uuid().optional() }).refine((input) => input.task !== "quote" || Boolean(input.serviceId), "Select an active service catalog entry for a quote draft.");

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly communications: CommunicationsService) {}
  @Get("status") status() { return this.communications.status(); }
  @Get() list(@CurrentAuth() auth: AuthContext) { return this.communications.list(auth); }
  @Get("templates") templates(@CurrentAuth() auth: AuthContext) { return this.communications.templates(auth); }
  @Post("templates") @UseGuards(OrganizationAccessGuard) @RequirePermission("notifications.manage") saveTemplate(@CurrentAuth() auth: AuthContext, @Body({ schema: templateSchema }) body: z.infer<typeof templateSchema>) { return this.communications.saveTemplate(auth, body); }
  @Post() create(@CurrentAuth() auth: AuthContext, @Body({ schema: notificationSchema }) body: z.infer<typeof notificationSchema>) { return this.communications.create(auth, body); }
  @Patch(":id/read") read(@CurrentAuth() auth: AuthContext, @Param("id", { schema: z.uuid() }) id: string) { return this.communications.markRead(auth, id); }
}

@Controller("ai")
@UseGuards(OrganizationAccessGuard)
export class AiController {
  constructor(private readonly communications: CommunicationsService) {}
  @Post("assist") @RequirePermission("ai.use") assist(@CurrentAuth() auth: AuthContext, @Body({ schema: assistSchema }) body: z.infer<typeof assistSchema>) { return this.communications.assist(auth, body); }
  @Get("usage") @RequirePermission("ai.use") usage(@CurrentAuth() auth: AuthContext) { return this.communications.usage(auth); }
}
