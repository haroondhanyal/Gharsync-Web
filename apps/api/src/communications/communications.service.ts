import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthContext } from "../auth/auth-context.js";

function commandOutput(command: string, args: string[], input?: Buffer, timeoutMs = 20_000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => { clearTimeout(timer); if (code === 0) resolve(Buffer.concat(chunks)); else reject(new Error(`${command} exited with code ${code}`)); });
    if (input) child.stdin.end(input); else child.stdin.end();
  });
}

async function extractVideoFrames(file: Express.Multer.File): Promise<string[]> {
  const directory = await mkdtemp(join(tmpdir(), "gharsync-help-video-"));
  try {
    const inputPath = join(directory, `upload${file.mimetype === "video/webm" ? ".webm" : file.mimetype === "video/quicktime" ? ".mov" : ".mp4"}`);
    await writeFile(inputPath, file.buffer, { mode: 0o600 });
    await commandOutput("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", inputPath, "-t", "20", "-vf", "fps=1/3,scale=768:-2", "-frames:v", "7", "-q:v", "5", join(directory, "frame-%02d.jpg")], undefined, 25_000);
    const frames = (await readdir(directory)).filter((name) => /^frame-\d+\.jpg$/.test(name)).sort().slice(0, 7);
    if (!frames.length) throw new Error("No video frames could be read.");
    return await Promise.all(frames.map(async (frame) => (await readFile(join(directory, frame))).toString("base64")));
  } finally { await rm(directory, { recursive: true, force: true }); }
}

@Injectable()
export class CommunicationsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async status() {
    const endpoint = this.config.get<string>("AI_PROVIDER_URL");
    const apiKey = this.config.get<string>("AI_PROVIDER_API_KEY");
    const ollamaUrl = (this.config.get<string>("OLLAMA_BASE_URL") ?? "http://127.0.0.1:11434").replace(/\/$/, "");
    const ollamaModel = this.config.get<string>("OLLAMA_MODEL") ?? "lfm3-omni";
    let ollamaReady = false;
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(1_500) });
      const tags = response.ok ? await response.json() as { models?: { name: string }[] } : undefined;
      ollamaReady = Boolean(tags?.models?.some(({ name }) => name === ollamaModel || name.startsWith(`${ollamaModel}:`)));
    } catch { /* Report the local provider as unavailable; the rest of notification status remains useful. */ }
    return {
      channels: {
        inApp: { configured: true, delivery: "immediate" },
        email: { configured: Boolean(this.config.get("EMAIL_PROVIDER_URL") && this.config.get("EMAIL_PROVIDER_API_KEY")), delivery: "provider-confirmed" },
        sms: { configured: Boolean(this.config.get("SMS_PROVIDER_URL") && this.config.get("SMS_PROVIDER_API_KEY")), delivery: "provider-confirmed" },
        push: { configured: false, delivery: "not-configured" },
        whatsapp: { configured: false, delivery: "not-configured" },
      },
      ollama: { configured: ollamaReady, model: ollamaModel },
      ai: { configured: Boolean(endpoint && apiKey) || ollamaReady, provider: endpoint && apiKey ? (this.config.get<string>("AI_PROVIDER_NAME") ?? "OpenAI-compatible endpoint") : "Ollama · local", ...(!(endpoint && apiKey) ? { model: ollamaModel } : {}) },
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
    const ollamaUrl = (this.config.get<string>("OLLAMA_BASE_URL") ?? "http://127.0.0.1:11434").replace(/\/$/, "");
    const ollamaModel = this.config.get<string>("OLLAMA_MODEL") ?? "lfm3-omni";
    const useOllama = !endpoint || !apiKey;
    {
      const [subscription, flag] = await Promise.all([
        this.prisma.subscription.findFirst({ where: { organizationId: auth.organizationId, status: { in: ["ACTIVE", "TRIAL"] }, periodEnd: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { plan: { select: { key: true } } } }),
        this.prisma.featureFlag.findUnique({ where: { key: "ai-assistant" }, select: { enabled: true } }),
      ]);
      if (!subscription || !["GROWTH", "BUSINESS"].includes(subscription.plan.key) || !flag?.enabled) throw new ForbiddenException("AI assistance requires an eligible plan and an enabled rollout flag.");
    }
    let output: string;
    let status = "FAILED";
    let provider = endpoint && apiKey ? (this.config.get<string>("AI_PROVIDER_NAME") ?? "OpenAI-compatible endpoint") : "Ollama · local";
    {
      try {
        const safeText = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]").replace(/(?:\+?92|0)\s?3\d{2}[\s-]?\d{7}/g, "[phone removed]");
        let catalogReference: { name: string; category: string; description: string | null; basePrice: string | null; minPrice: string | null; maxPrice: string | null; currency: string } | undefined;
        if (input.task === "quote") {
          if (!input.serviceId) throw new BadRequestException("Choose an active service from your catalog for a quote draft.");
          const service = await this.prisma.service.findFirst({ where: { id: input.serviceId, organizationId: auth.organizationId, isActive: true, deletedAt: null }, select: { name: true, category: true, description: true, basePrice: true, minPrice: true, maxPrice: true, organization: { select: { currency: true } } } });
          if (!service) throw new NotFoundException("The selected service is not in this organization’s active catalog.");
          catalogReference = { name: service.name, category: service.category, description: service.description, basePrice: service.basePrice?.toString() ?? null, minPrice: service.minPrice?.toString() ?? null, maxPrice: service.maxPrice?.toString() ?? null, currency: service.organization.currency };
        }
        const instructions = `Task: ${input.task}. Return a concise draft in the language of the request. Never diagnose, invent part prices, or present a quote as approved. Include uncertainty. Email and Pakistan phone patterns were redacted. For quotes use only this active catalog entry and its configured bounds; return wording only, no invented totals: ${JSON.stringify(catalogReference ?? null)}`;
        if (useOllama) {
          const response = await fetch(`${ollamaUrl}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: ollamaModel, stream: false, messages: [{ role: "system", content: instructions }, { role: "user", content: safeText }] }), signal: AbortSignal.timeout(90_000) });
          const result = await response.json() as { message?: { content?: string }; error?: string };
          if (!response.ok) throw new Error(result.error ?? `Ollama returned HTTP ${response.status}`);
          output = result.message?.content?.trim() ?? "Ollama returned no draft.";
        } else {
          const response = await fetch(endpoint!, { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ task: input.task, language: "English or Urdu as supplied", instructions, text: safeText, catalogReference }), signal: AbortSignal.timeout(15_000) });
          if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
          const result = await response.json() as { output?: string; text?: string };
          output = result.output ?? result.text ?? "Provider returned no draft.";
        }
        status = "COMPLETED";
      } catch (error) {
        output = error instanceof Error ? `Draft unavailable: ${error.message}` : "Draft unavailable.";
        status = "FAILED";
      }
    }
    await this.prisma.aiUsageLog.create({ data: { organizationId: auth.organizationId, userId: auth.userId, task: input.task, provider, status, inputCharacters: text.length, outputCharacters: output.length, metadata: { serviceId: input.serviceId ?? null } } });
    return { status, provider, output, disclaimer: "Draft assistance only. A qualified staff member must review it; it is not a diagnosis or approved quotation." };
  }

  async aiAvailability(auth: AuthContext) {
    if (!auth.organizationId) throw new ForbiddenException();
    const [subscription, flag, providerStatus] = await Promise.all([
      this.prisma.subscription.findFirst({ where: { organizationId: auth.organizationId, status: { in: ["ACTIVE", "TRIAL"] }, periodEnd: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { plan: { select: { key: true } } } }),
      this.prisma.featureFlag.findUnique({ where: { key: "ai-assistant" }, select: { enabled: true } }),
      this.status(),
    ]);
    const plan = subscription?.plan.key ?? null;
    const planEligible = plan === "GROWTH" || plan === "BUSINESS";
    const rolloutEnabled = Boolean(flag?.enabled);
    return { configured: providerStatus.ai.configured, provider: providerStatus.ai.provider, model: providerStatus.ai.model, plan, planEligible, rolloutEnabled, available: providerStatus.ai.configured && planEligible && rolloutEnabled };
  }

  async helpDesk(auth: AuthContext, input: { text?: string; history?: string }, file?: Express.Multer.File) {
    const text = input.text?.trim() ?? "";
    let history: { role: "user" | "assistant"; content: string }[] = [];
    if (input.history) {
      try {
        const parsed: unknown = JSON.parse(input.history);
        if (!Array.isArray(parsed) || parsed.length > 12) throw new Error();
        history = parsed.map((message) => {
          if (!message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string" || message.content.length > 4000) throw new Error();
          return { role: message.role as "user" | "assistant", content: message.content };
        });
      } catch { throw new BadRequestException("Chat history invalid hai."); }
    }
    if (!text && !file) throw new BadRequestException("Apna sawal likhein ya file attach karein.");
    if (text.length > 6000) throw new BadRequestException("Sawal 6,000 characters tak ho sakta hai.");
    const message: { role: string; content: string; images?: string[] } = { role: "user", content: text || "Attached file ko samjha kar sawal ka jawab dein." };
    if (file) {
      if (file.mimetype === "application/pdf") {
        if (file.buffer.subarray(0, 5).toString() !== "%PDF-") throw new BadRequestException("Yeh valid PDF file nahi lagti.");
        try { message.content += `\n\nPDF ka matn:\n${(await commandOutput("pdftotext", ["-layout", "-", "-"], file.buffer)).toString("utf8").slice(0, 30_000)}`; }
        catch { throw new BadRequestException("PDF read nahi ho saki; server par Poppler pdftotext install hona chahiye."); }
      } else if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
        const valid = file.mimetype === "image/png" ? file.buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : file.mimetype === "image/jpeg" ? file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff : file.buffer.toString("ascii", 0, 4) === "RIFF" && file.buffer.toString("ascii", 8, 12) === "WEBP";
        if (!valid) throw new BadRequestException("Image file ka format check nahi ho saka.");
        message.images = [file.buffer.toString("base64")];
      } else if (["video/mp4", "video/webm", "video/quicktime"].includes(file.mimetype)) {
        try { message.images = await extractVideoFrames(file); message.content += "\nVideo se nikale gaye frames tartib se diye gaye hain (pehle 20 seconds, har 3 seconds ka sample)."; }
        catch { throw new BadRequestException("Video frames read nahi ho sake; supported MP4/WebM/MOV video dein. Server par FFmpeg zaroori hai."); }
      } else throw new BadRequestException("Sirf image, PDF aur MP4/WebM/MOV video attach kar sakte hain.");
    }
    const baseUrl = (this.config.get<string>("OLLAMA_BASE_URL") ?? "http://127.0.0.1:11434").replace(/\/$/, "");
    const model = this.config.get<string>("OLLAMA_MODEL") ?? "lfm3-omni";
    try {
      const messages = [
        { role: "system", content: "Tum GharSync app ke help desk assistant ho. User ke sawal ka seedha, moaddab Roman Urdu jawab do; agar user English mein likhe to English bhi theek hai. App ke modules, account settings aur general home-service sawalat mein madad karo. Bina evidence diagnosis, exact price, policy ya account data ka dawa mat karo. Emergency mein qualified local professional se rabta karne ko kaho. Image/PDF/video ke bare mein sirf woh batao jo content mein nazar ya likha hai; uncertainty saaf batao. Har jawab ko human-reviewed guidance samjho." }, ...history, message,
      ];
      let activeModel = model;
      let response = await fetch(`${baseUrl}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: activeModel, stream: false, messages }), signal: AbortSignal.timeout(90_000) });
      let result = await response.json() as { message?: { content?: string }; error?: string };
      if (!response.ok && /model .* not found/i.test(result.error ?? "") && !file) {
        activeModel = "qwen3:1.7b";
        response = await fetch(`${baseUrl}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: activeModel, stream: false, messages }), signal: AbortSignal.timeout(90_000) });
        result = await response.json() as { message?: { content?: string }; error?: string };
      }
      if (!response.ok && file && /model .* not found/i.test(result.error ?? "")) throw new BadRequestException("Ollama is connected. Its image and video model is still downloading; please retry after " + model + " finishes installing.");
      if (!response.ok) throw new Error(result.error ?? `Ollama returned HTTP ${response.status}.`);
      return { reply: result.message?.content?.trim() || "Model se jawab nahi mila.", provider: "Ollama · local", model: activeModel, ...(activeModel !== model ? { notice: `${model} multimodal model is downloading. Text-only reply used ${activeModel}.` } : {}) };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const messageText = error instanceof Error && error.name === "TimeoutError" ? "Ollama ko jawab dene mein waqt lag gaya. Dobara koshish karein." : "Ollama server se rabta nahi ho saka. Ollama chala kar ollama pull " + model + " karein.";
      throw new BadRequestException(messageText);
    }
  }

  async usage(auth: AuthContext) {
    if (!auth.organizationId) throw new ForbiddenException();
    return this.prisma.aiUsageLog.findMany({ where: { organizationId: auth.organizationId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, task: true, provider: true, status: true, inputCharacters: true, outputCharacters: true, createdAt: true, user: { select: { fullName: true } } } });
  }
}
