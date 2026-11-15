import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller.js";
import { BookingsController, QuotesController } from "./bookings.controller.js";
import { CommercialController } from "./commercial.controller.js";
import { WorkflowsService } from "./workflows.service.js";

@Module({ controllers: [CatalogController, BookingsController, QuotesController, CommercialController], providers: [WorkflowsService] })
export class WorkflowsModule {}
