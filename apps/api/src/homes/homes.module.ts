import { Module } from "@nestjs/common";
import { HomesController } from "./homes.controller.js";
import { HomesService } from "./homes.service.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsService } from "./documents.service.js";

@Module({ controllers: [HomesController, DocumentsController], providers: [HomesService, DocumentsService] })
export class HomesModule {}
