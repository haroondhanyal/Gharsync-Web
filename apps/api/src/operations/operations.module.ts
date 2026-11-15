import { Module } from "@nestjs/common";
import { WorkforceController, InventoryController, WarrantyController } from "./operations.controller.js";
import { OperationsService } from "./operations.service.js";

@Module({ controllers: [WorkforceController, InventoryController, WarrantyController], providers: [OperationsService] })
export class OperationsModule {}
