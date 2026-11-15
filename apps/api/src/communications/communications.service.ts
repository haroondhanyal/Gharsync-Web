import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthContext } from "../auth/auth-context.js";

@Injectable()
export class CommunicationsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async status() {
    return {
      channels: {
        inApp: { configured: true, delivery: "immediate" },
        email: { configured: Boolean(this.config.get("EMAIL_PROVIDER_URL") && this.config.get("EMAIL_PROVIDER_API_KEY")), delivery: "provider-confirmed" },
        sms: { configured: Boolean(this.config.get("SMS_PROVIDER_URL") && this.config.get("SMS_PROVIDER_API_KEY")), delivery: "provider-confirmed" },
        push: { configured: false, delivery: "not-configured" },
        whatsapp: { configured: false, delivery: "not-configured" },
      },
      ai: { configured: Boolean(this.config.get("AI_PROVIDER_URL") && this.config.get("AI_PROVIDER_API_KEY")), provider: this.config.get("AI_PROVIDER_NAME") ?? "OpenAI-compatible endpoint" },
    };
  }

  list(auth: AuthContext) {
    return this.prisma.notificationLog.findMany({
      where: { userId: auth.userId, ...(auth.organizationId ? { organizationId: auth.organizationId } : {}) },
      orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, eventKey: true, channel: true, status: true, subject: true, body: true, readAt: true, createdAt: true, error: true },
    });
  }

  async templates(auth: AuthContext) {
    return this.prisma.notificationTemplate.findMany({ where: { OR: [{ organizationId: auth.organizationId }, { organizationId: null }] }, orderBy: [{ eventKey: "asc" }, { channel: "asc" }], select: { id: true, eventKey: true, channel: true, subject: true, body: true, enabled: true, organizationId: true } });
  }

  async saveTemplate(auth: AuthContext, input: { eventKey: string; channel: "IN_APP" | "EMAIL" | "SMS"; subject?: string; body: string; enabled: boolean }) {
    if (!auth.organizationId || !["OWNER", "ADMIN", "MANAGER"].includes(auth.role ?? "")) throw new ForbiddenException();
    const existing = await this.prisma.notificationTemplate.findFirst({ where: { organizationId: auth.organizationId, eventKey: input.eventKey, channel: input.channel } });
    if (existing) return this.prisma.notificationTemplate.update({ where: { id: existing.id }, data: { subject: input.subject, body: input.body, enabled: input.enabled } });
    return this.prisma.notificationTemplate.create({ data: { organizationId: auth.organizationId, ...input } });
  }

  async create(auth: AuthContext, input: { eventKey: string; channel: "IN_APP" | "EMAIL" | "SMS"; recipient?: string; subject?: string; body?: string }) {
    const template = (auth.organizationId ? await this.prisma.notificationTemplate.findFirst({ where: { organizationId: auth.organizationId, eventKey: input.eventKey, channel: input.channel, enabled: true } }) : null)
      ?? await this.prisma.notificationTemplate.findFirst({ where: { organizationId: null, eventKey: input.eventKey, channel: input.channel, enabled: true } });
    const body = input.body ?? template?.body;
    if (!body) throw new BadRequestException("Message body is required when no enabled template exists.");
    const subject = input.subject ?? template?.subject ?? undefined;
    if (input.channel === "IN_APP") return this.prisma.notificationLog.create({ data: { userId: auth.userId, organizationId: auth.organizationId, eventKey: input.eventKey, channel: input.channel, status: "SENT", subject, body } });
    if (!auth.organizationId || !["OWNER", "ADMIN", "MANAGER"].includes(auth.role ?? "")) throw new ForbiddenException("Only organization managers can send external notifications.");
    if (!input.recipient) throw new BadRequestException("An email address or phone number is required for external delivery.");
    const log = await this.prisma.notificationLog.create({ data: { userId: auth.userId, organizationId: auth.organizationId, eventKey: input.eventKey, channel: input.channel, recipient: input.recipient, subject, body, status: "QUEUED" } });
    const url = this.config.get<string>(input.channel === "EMAIL" ? "EMAIL_PROVIDER_URL" : "SMS_PROVIDER_URL");
    const key = this.config.get<string>(input.channel === "EMAIL" ? "EMAIL_PROVIDER_API_KEY" : "SMS_PROVIDER_API_KEY");
    if (!url || !key) return this.prisma.notificationLog.update({ where: { id: log.id }, data: { status: "SKIPPED", error: `${input.channel} provider is not configured.` } });
    try {
      const payload = input.channel === "EMAIL" ? { to: input.recipient, subject: subject ?? "GharSync update", text: body } : { to: input.recipient, message: body };
      const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
      const provider = await response.json().catch(() => ({})) as { id?: string; messageId?: string; status?: string };
      const confirmedDelivered = provider.status?.toLocaleLowerCase() === "delivered";
      return this.prisma.notificationLog.update({ where: { id: log.id }, data: { status: confirmedDelivered ? "SENT" : "QUEUED", providerReference: provider.id ?? provider.messageId ?? null, ...(confirmedDelivered ? {} : { error: "Provider accepted the message; waiting for delivery confirmation." }) } });
    } catch (error) {
      return this.prisma.notificationLog.update({ where: { id: log.id }, data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 490) : "Provider request failed." } });
    }
  }

  async markRead(auth: AuthContext, id: string) {
    const updated = await this.prisma.notificationLog.updateMany({ where: { id, userId: auth.userId, organizationId: auth.organizationId }, data: { readAt: new Date() } });
    if (!updated.count) throw new NotFoundException("Notification not found.");
    return { status: "read" };
  }

  async assist(auth: AuthContext, input: { task: "summarize" | "classify" | "maintenance" | "quote"; text: string; serviceId?: string }) {
    if (!auth.organizationId) throw new ForbiddenException();
    const text = input.text.trim();
    if (!text) throw new BadRequestException("Describe the service request first.");
    const endpoint = this.config.get<string>("AI_PROVIDER_URL");
    const apiKey = this.config.get<string>("AI_PROVIDER_API_KEY");
    if (endpoint && apiKey) {
      const [subscription, flag] = await Promise.all([
        this.prisma.subscription.findFirst({ where: { organizationId: auth.organizationId, status: { in: ["ACTIVE", "TRIAL"] }, periodEnd: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { plan: { select: { key: true } } } }),
        this.prisma.featureFlag.findUnique({ where: { key: "ai-assistant" }, select: { enabled: true } }),
      ]);
      if (!subscription || !["GROWTH", "BUSINESS"].includes(subscription.plan.key) || !flag?.enabled) throw new ForbiddenException("AI assistance requires an eligible plan and an enabled rollout flag.");
    }
    let output: string;
    let status = "UNCONFIGURED";
    let provider = this.config.get<string>("AI_PROVIDER_NAME") ?? "OpenAI-compatible endpoint";
    if (endpoint && apiKey) {
      try {
        const safeText = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]").replace(/(?:\+?92|0)\s?3\d{2}[\s-]?\d{7}/g, "[phone removed]");
        let catalogReference: { name: string; category: string; description: string | null; basePrice: string | null; minPrice: string | null; maxPrice: string | null; currency: string } | undefined;
        if (input.task === "quote") {
          if (!input.serviceId) throw new BadRequestException("Choose an active service from your catalog for a quote draft.");
          const service = await this.prisma.service.findFirst({ where: { id: input.serviceId, organizationId: auth.organizationId, isActive: true, deletedAt: null }, select: { name: true, category: true, description: true, basePrice: true, minPrice: true, maxPrice: true, organization: { select: { currency: true } } } });
          if (!service) throw new NotFoundException("The selected service is not in this organization’s active catalog.");
          catalogReference = { name: service.name, category: service.category, description: service.description, basePrice: service.basePrice?.toString() ?? null, minPrice: service.minPrice?.toString() ?? null, maxPrice: service.maxPrice?.toString() ?? null, currency: service.organization.currency };
        }
        const response = await fetch(endpoint, { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ task: input.task, language: "English or Urdu as supplied", instructions: "Return a concise draft only. Never diagnose from images, invent part prices, or present a quote as approved. Include uncertainty. Personal email and Pakistan phone patterns have been redacted. For quote requests use only the supplied active catalog entry; do not make up item prices or totals. Return quote wording only, not a payment promise.", text: safeText, catalogReference }), signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
        const result = await response.json() as { output?: string; text?: string };
        output = result.output ?? result.text ?? "Provider returned no draft.";
        status = "COMPLETED";
      } catch (error) {
        output = error instanceof Error ? `Draft unavailable: ${error.message}` : "Draft unavailable.";
        status = "FAILED";
      }
    } else {
      output = "AI provider is not configured. Add AI_PROVIDER_URL and AI_PROVIDER_API_KEY to enable private draft assistance. No diagnosis, service recommendation, or quotation was generated.";
      status = "UNCONFIGURED";
    }
    await this.prisma.aiUsageLog.create({ data: { organizationId: auth.organizationId, userId: auth.userId, task: input.task, provider, status, inputCharacters: text.length, outputCharacters: output.length, metadata: { serviceId: input.serviceId ?? null } } });
    return { status, provider, output, disclaimer: "Draft assistance only. A qualified staff member must review it; it is not a diagnosis or approved quotation." };
  }

  async usage(auth: AuthContext) {
    if (!auth.organizationId) throw new ForbiddenException();
    return this.prisma.aiUsageLog.findMany({ where: { organizationId: auth.organizationId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, task: true, provider: true, status: true, inputCharacters: true, outputCharacters: true, createdAt: true, user: { select: { fullName: true } } } });
  }
}
