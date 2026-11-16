import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Body, Res, UploadedFile, UseInterceptors, UseGuards, Header } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { memoryStorage } from "multer";
import { documentTargetSchema } from "@gharsync/validation";
import { CurrentAuth, RequirePermission, type AuthContext } from "../auth/auth-context.js";
import { OrganizationAccessGuard } from "../auth/organization-access.guard.js";
import { DocumentsService } from "./documents.service.js";

@Controller("documents")
@UseGuards(OrganizationAccessGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @RequirePermission("documents.manage")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  upload(@CurrentAuth() auth: AuthContext, @UploadedFile() file: Express.Multer.File | undefined, @Body({ schema: documentTargetSchema }) body: unknown) {
    const target = documentTargetSchema.parse(body);
    return this.documents.upload(auth, file, target);
  }

  @Get(":documentId/preview")
  @RequirePermission("properties.read")
  async preview(@CurrentAuth() auth: AuthContext, @Param("documentId", ParseUUIDPipe) id: string, @Res() response: Response) {
    const document = await this.documents.download(auth, id);
    if (!document.mimeType.startsWith("image/")) return response.status(415).end();
    response.setHeader("Content-Type", document.mimeType);
    response.setHeader("Content-Length", document.sizeBytes);
    response.setHeader("Content-Disposition", "inline");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.end(document.buffer);
  }

  @Get(":documentId")
  @RequirePermission("properties.read")
  async download(@CurrentAuth() auth: AuthContext, @Param("documentId", ParseUUIDPipe) id: string, @Res() response: Response) {
    const document = await this.documents.download(auth, id);
    const fileName = document.fileName.replace(/[\r\n"\\]/g, "_");
    response.setHeader("Content-Type", document.mimeType);
    response.setHeader("Content-Length", document.sizeBytes);
    response.setHeader("Content-Disposition", `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.end(document.buffer);
  }

  @Delete(":documentId")
  @RequirePermission("documents.manage")
  remove(@CurrentAuth() auth: AuthContext, @Param("documentId", ParseUUIDPipe) id: string) { return this.documents.remove(auth, id); }
}
