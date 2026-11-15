import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service.js";
import { DeliveryService } from "./delivery.service.js";
import { authSecret } from "./auth-secrets.js";

@Injectable()
export class PhoneOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryService,
    private readonly config: ConfigService,
  ) {}

  private digest(userId: string, code: string) {
    const secret = authSecret(this.config, "OTP_HMAC_SECRET");
    if (!secret || Buffer.byteLength(secret) < 32) throw new Error("OTP_HMAC_SECRET must contain at least 32 bytes.");
    return createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");
  }

  async request(userId: string) {
    if (!this.delivery.smsConfigured) {
      throw new ServiceUnavailableException("Phone verification delivery is not configured yet.");
    }
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { phone: true, phoneVerifiedAt: true } });
    if (!user?.phone) throw new BadRequestException("Add a phone number before requesting verification.");
    if (user.phoneVerifiedAt) throw new ConflictException("This phone number is already verified.");
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const sent = await this.prisma.otpChallenge.count({ where: { userId, createdAt: { gte: since } } });
    if (sent >= 3) throw new HttpException("Too many verification codes requested. Try again later.", HttpStatus.TOO_MANY_REQUESTS);

    const code = this.config.get<string>("NODE_ENV") === "development" && this.config.get<string>("LOCAL_DEV_DELIVERY") !== "false"
      ? "123456"
      : String(randomInt(100_000, 1_000_000));
    const challenge = await this.prisma.otpChallenge.create({
      data: { userId, phone: user.phone, codeHash: this.digest(userId, code), expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });
    try {
      await this.delivery.sendSms(user.phone, `Your GharSync verification code is ${code}. It expires in 10 minutes.`);
    } catch (error) {
      await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      throw error;
    }
    return { status: "sent", expiresInSeconds: 600 };
  }

  async verify(userId: string, code: string) {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge) throw new BadRequestException("The verification code is invalid or expired.");
    if (challenge.attempts >= 5) throw new HttpException("Too many incorrect codes. Request a new code later.", HttpStatus.TOO_MANY_REQUESTS);
    const claim = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
    if (claim.count !== 1) throw new BadRequestException("The verification code is invalid or expired.");
    const expected = Buffer.from(challenge.codeHash, "hex");
    const actual = Buffer.from(this.digest(userId, code), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new BadRequestException("The verification code is invalid or expired.");
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const used = await tx.otpChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: now } });
      if (used.count !== 1) throw new BadRequestException("The verification code is invalid or expired.");
      await tx.user.update({ where: { id: userId }, data: { phoneVerifiedAt: now } });
    });
    return { status: "verified", verifiedAt: now.toISOString() };
  }
}
