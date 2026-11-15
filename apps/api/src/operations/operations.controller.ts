import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { inventoryProductCreateSchema, stockMovementSchema, supplierCreateSchema, technicianAvailabilitySchema, technicianProfileSchema, technicianTimeOffSchema, timeOffDecisionSchema, warrantyClaimCreateSchema, warrantyClaimUpdateSchema } from "@gharsync/validation";
import { CurrentAuth, RequirePermission, type AuthContext } from "../auth/auth-context.js";
import { OrganizationAccessGuard } from "../auth/organization-access.guard.js";
import { OperationsService } from "./operations.service.js";

@Controller("workforce")
@UseGuards(OrganizationAccessGuard)
export class WorkforceController {
  constructor(private readonly operations: OperationsService) {}

  @Get("technicians") @RequirePermission("workforce.read")
  technicians(@CurrentAuth() auth: AuthContext) { return this.operations.technicians(auth); }

  @Put("me/profile") @RequirePermission("workforce.self_update")
  myProfile(@CurrentAuth() auth: AuthContext, @Body({ schema: technicianProfileSchema }) body: z.infer<typeof technicianProfileSchema>) { return this.operations.upsertMyProfile(auth, body); }

  @Put("me/availability") @RequirePermission("workforce.self_update")
  myAvailability(@CurrentAuth() auth: AuthContext, @Body({ schema: technicianAvailabilitySchema }) body: z.infer<typeof technicianAvailabilitySchema>) { return this.operations.setAvailability(auth, body); }

  @Post("me/time-off") @RequirePermission("workforce.self_update")
  timeOff(@CurrentAuth() auth: AuthContext, @Body({ schema: technicianTimeOffSchema }) body: z.infer<typeof technicianTimeOffSchema>) { return this.operations.requestTimeOff(auth, body); }

  @Put("technicians/:memberId/profile") @RequirePermission("workforce.manage")
  profile(@CurrentAuth() auth: AuthContext, @Param("memberId", { schema: z.uuid() }) memberId: string, @Body({ schema: technicianProfileSchema }) body: z.infer<typeof technicianProfileSchema>) { return this.operations.upsertProfile(auth, memberId, body); }

  @Put("technicians/:memberId/availability") @RequirePermission("workforce.manage")
  availability(@CurrentAuth() auth: AuthContext, @Param("memberId", { schema: z.uuid() }) memberId: string, @Body({ schema: technicianAvailabilitySchema }) body: z.infer<typeof technicianAvailabilitySchema>) { return this.operations.setAvailability(auth, body, memberId); }

  @Patch("time-off/:requestId") @RequirePermission("workforce.manage")
  decideTimeOff(@CurrentAuth() auth: AuthContext, @Param("requestId", { schema: z.uuid() }) id: string, @Body({ schema: timeOffDecisionSchema }) body: z.infer<typeof timeOffDecisionSchema>) { return this.operations.decideTimeOff(auth, id, body); }
}

@Controller("inventory")
@UseGuards(OrganizationAccessGuard)
export class InventoryController {
  constructor(private readonly operations: OperationsService) {}

  @Get("products") @RequirePermission("inventory.read")
  products(@CurrentAuth() auth: AuthContext) { return this.operations.products(auth); }

  @Post("products") @RequirePermission("inventory.manage")
  createProduct(@CurrentAuth() auth: AuthContext, @Body({ schema: inventoryProductCreateSchema }) body: z.infer<typeof inventoryProductCreateSchema>) { return this.operations.createProduct(auth, body); }

  @Get("suppliers") @RequirePermission("inventory.read")
  suppliers(@CurrentAuth() auth: AuthContext) { return this.operations.suppliers(auth); }

  @Post("suppliers") @RequirePermission("inventory.manage")
  createSupplier(@CurrentAuth() auth: AuthContext, @Body({ schema: supplierCreateSchema }) body: z.infer<typeof supplierCreateSchema>) { return this.operations.createSupplier(auth, body); }

  @Get("movements") @RequirePermission("inventory.read")
  movements(@CurrentAuth() auth: AuthContext) { return this.operations.movements(auth); }

  @Post("movements") @RequirePermission("inventory.manage")
  movement(@CurrentAuth() auth: AuthContext, @Body({ schema: stockMovementSchema }) body: z.infer<typeof stockMovementSchema>) { return this.operations.moveStock(auth, body); }
}

@Controller("warranty-claims")
@UseGuards(OrganizationAccessGuard)
export class WarrantyController {
  constructor(private readonly operations: OperationsService) {}

  @Get() @RequirePermission("warranty.manage")
  claims(@CurrentAuth() auth: AuthContext) { return this.operations.claims(auth); }

  @Post() @RequirePermission("warranty.manage")
  create(@CurrentAuth() auth: AuthContext, @Body({ schema: warrantyClaimCreateSchema }) body: z.infer<typeof warrantyClaimCreateSchema>) { return this.operations.createClaim(auth, body); }

  @Patch(":claimId") @RequirePermission("warranty.manage")
  update(@CurrentAuth() auth: AuthContext, @Param("claimId", { schema: z.uuid() }) id: string, @Body({ schema: warrantyClaimUpdateSchema }) body: z.infer<typeof warrantyClaimUpdateSchema>) { return this.operations.updateClaim(auth, id, body); }
}
