import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../auth/auth-context.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    return { status: "ok", service: "gharsync-api", version: "v1" };
  }

  @Get("ready")
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ready", service: "gharsync-api", dependencies: { database: "ok" } };
    } catch {
      throw new ServiceUnavailableException({ status: "not_ready", service: "gharsync-api", dependencies: { database: "unavailable" } });
    }
  }
}
