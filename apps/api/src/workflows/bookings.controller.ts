import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { bookingCreateSchema, bookingTransitionSchema, quoteCreateSchema, quoteDecisionSchema, technicianBookingStatusSchema } from "@gharsync/validation";
import { CurrentAuth, RequirePermission, type AuthContext } from "../auth/auth-context.js";
import { OrganizationAccessGuard } from "../auth/organization-access.guard.js";
import { WorkflowsService } from "./workflows.service.js";

@Controller("bookings")
@UseGuards(OrganizationAccessGuard)
export class BookingsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get("technicians")
  @RequirePermission("bookings.manage")
  technicians(@CurrentAuth() auth: AuthContext) { return this.workflows.listTechnicians(auth); }

  @Get()
  @RequirePermission("bookings.read")
  list(@CurrentAuth() auth: AuthContext, @Query("status") status?: string, @Query("page") page?: string) { return this.workflows.listBookings(auth, status, Math.max(1, Number(page) || 1)); }

  @Post()
  @RequirePermission("bookings.create")
  create(@CurrentAuth() auth: AuthContext, @Body({ schema: bookingCreateSchema }) body: z.infer<typeof bookingCreateSchema>) { return this.workflows.createBooking(auth, body); }

  @Get(":bookingId")
  @RequirePermission("bookings.read")
  get(@CurrentAuth() auth: AuthContext, @Param("bookingId", { schema: z.uuid() }) id: string) { return this.workflows.getBooking(auth, id); }

  @Post(":bookingId/transition")
  @RequirePermission("bookings.manage")
  transition(@CurrentAuth() auth: AuthContext, @Param("bookingId", { schema: z.uuid() }) id: string, @Body({ schema: bookingTransitionSchema }) body: z.infer<typeof bookingTransitionSchema>) { return this.workflows.transitionBooking(auth, id, body); }

  @Post(":bookingId/work-status")
  @RequirePermission("bookings.self_update")
  technicianStatus(@CurrentAuth() auth: AuthContext, @Param("bookingId", { schema: z.uuid() }) id: string, @Body({ schema: technicianBookingStatusSchema }) body: z.infer<typeof technicianBookingStatusSchema>) { return this.workflows.updateAssignedBooking(auth, id, body); }

  @Post(":bookingId/quotes")
  @RequirePermission("quotes.manage")
  quote(@CurrentAuth() auth: AuthContext, @Param("bookingId", { schema: z.uuid() }) id: string, @Body({ schema: quoteCreateSchema }) body: z.infer<typeof quoteCreateSchema>) { return this.workflows.createQuote(auth, id, body); }
}

@Controller("quotes")
@UseGuards(OrganizationAccessGuard)
export class QuotesController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Post(":quoteId/send")
  @RequirePermission("quotes.manage")
  send(@CurrentAuth() auth: AuthContext, @Param("quoteId", { schema: z.uuid() }) id: string) { return this.workflows.sendQuote(auth, id); }

  @Post(":quoteId/decision")
  @RequirePermission("quotes.manage")
  decision(@CurrentAuth() auth: AuthContext, @Param("quoteId", { schema: z.uuid() }) id: string, @Body({ schema: quoteDecisionSchema }) body: z.infer<typeof quoteDecisionSchema>) { return this.workflows.decideQuote(auth, id, body); }
}
