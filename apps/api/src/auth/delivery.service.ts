import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class DeliveryService {
  constructor(private readonly config: ConfigService) {}

  get smsConfigured() {
    return Boolean((this.config.get<string>("SMS_PROVIDER_URL") && this.config.get<string>("SMS_PROVIDER_API_KEY")) || this.localDeliveryEnabled);
  }

  private get localDeliveryEnabled() { return this.config.get<string>("NODE_ENV") === "development" && this.config.get<string>("LOCAL_DEV_DELIVERY") !== "false"; }

  get emailConfigured() {
    return Boolean(this.config.get<string>("EMAIL_PROVIDER_URL") && this.config.get<string>("EMAIL_PROVIDER_API_KEY"));
  }

  async sendSms(to: string, message: string) {
    if (this.localDeliveryEnabled) {
      console.info(`[GharSync local SMS] ${to}: ${message}`);
      return;
    }
    const url = this.config.get<string>("SMS_PROVIDER_URL");
    const apiKey = this.config.get<string>("SMS_PROVIDER_API_KEY");
    if (!url || !apiKey) throw new ServiceUnavailableException("Phone verification delivery is not configured yet.");
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ to, message }),
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null);
    if (!response?.ok) throw new ServiceUnavailableException("The SMS provider did not confirm message delivery.");
  }

  async sendEmail(to: string, subject: string, text: string) {
    const url = this.config.get<string>("EMAIL_PROVIDER_URL");
    const apiKey = this.config.get<string>("EMAIL_PROVIDER_API_KEY");
    if (!url || !apiKey) throw new ServiceUnavailableException("Email delivery is not configured yet.");
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ to, subject, text }),
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null);
    if (!response?.ok) throw new ServiceUnavailableException("The email provider did not confirm message delivery.");
  }
}
