import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/auth-context.js";

@Public()
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { status: "ok", service: "gharsync-api", version: "v1" };
  }
}
