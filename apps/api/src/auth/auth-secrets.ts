import type { ConfigService } from "@nestjs/config";

const DEV_SECRETS: Record<string, string> = {
  JWT_ACCESS_SECRET: "gharsync-local-only-access-secret-do-not-deploy-2026",
  JWT_REFRESH_SECRET: "gharsync-local-only-refresh-secret-do-not-deploy-2026",
  OTP_HMAC_SECRET: "gharsync-local-only-otp-secret-do-not-deploy-2026",
};

export function authSecret(config: ConfigService, key: keyof typeof DEV_SECRETS) {
  const configured = config.get<string>(key);
  if (configured) return configured;
  if (config.get<string>("NODE_ENV") === "development" && config.get<string>("LOCAL_DEV_DELIVERY") !== "false") return DEV_SECRETS[key];
  throw new Error(`${key} must be configured.`);
}
