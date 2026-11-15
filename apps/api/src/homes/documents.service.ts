import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from "@nestjs/common";
import type { z } from "zod";
import type { documentTargetSchema } from "@gharsync/validation";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthContext } from "../auth/auth-context.js";

const MAX_BYTES = 10 * 1024 * 1024;
const MIME_EXT: Record<string, string> = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const storageRoot = () => resolve(process.env.DOCUMENT_STORAGE_PATH ?? "../../var/documents");

function verifiedMime(buffer: Buffer) {
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function safeName(value: string) {
  const name = value.split(/[\\/]/).pop()?.replace(/[\r\n\0]/g, "").trim() ?? "document";
  return name.slice(0, 240) || "document";
}

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async scopedBranch(auth: AuthContext, target: z.infer<typeof documentTargetSchema>) {
    const organizationId = auth.organizationId!;
    if (target.customerId) {
      const row = await this.prisma.customer.findFirst({ where: { id: target.customerId, organizationId, deletedAt: null, ...(auth.branchId ? { branchId: auth.branchId } : {}) }, select: { id: true, branchId: true } });
      if (row) return row.branchId;
    }
    if (target.propertyId) {
      const row = await this.prisma.property.findFirst({ where: { id: target.propertyId, organizationId, deletedAt: null, ...(auth.branchId ? { customer: { branchId: auth.branchId } } : {}) }, select: { id: true, customer: { select: { branchId: true } } } });
      if (row) return row.customer.branchId;
    }
    if (target.assetId) {
      const row = await this.prisma.asset.findFirst({ where: { id: target.assetId, organizationId, deletedAt: null, ...(auth.branchId ? { property: { customer: { branchId: auth.branchId } } } : {}) }, select: { id: true, property: { select: { customer: { select: { branchId: true } } } } } });
      if (row) return row.property.customer.branchId;
    }
    if (target.bookingId) {
      const row = await this.prisma.booking.findFirst({ where: { id: target.bookingId, organizationId, deletedAt: null, ...(auth.branchId ? { branchId: auth.branchId } : {}) }, select: { id: true, branchId: true } });
      if (row) return row.branchId;
    }
    throw new NotFoundException("Attachment target not found in this organization.");
  }

  async upload(auth: AuthContext, file: Express.Multer.File | undefined, target: z.infer<typeof documentTargetSchema>) {
    if (!auth.organizationId) throw new NotFoundException("Select an organization first.");
    if (!file?.buffer?.length) throw new BadRequestException("Choose a file to upload.");
    if (file.size > MAX_BYTES) throw new PayloadTooLargeException("Files must be 10 MB or smaller.");
    const mimeType = verifiedMime(file.buffer);
    if (!mimeType || file.mimetype !== mimeType) throw new BadRequestException("Upload a valid PDF, JPEG, PNG or WebP file.");
    const branchId = await this.scopedBranch(auth, target);
    const storageKey = `${randomUUID()}${MIME_EXT[mimeType]}`;
    const root = storageRoot();
    await mkdir(root, { recursive: true, mode: 0o700 });
    await writeFile(join(root, storageKey), file.buffer, { flag: "wx", mode: 0o600 });
    try {
      return await this.prisma.document.create({ data: {
        organizationId: auth.organizationId, branchId, uploaderId: auth.userId, ...target,
        fileName: safeName(file.originalname), storageKey, mimeType, sizeBytes: file.size,
        checksum: createHash("sha256").update(file.buffer).digest("hex"),
      }, select: { id: true, customerId: true, propertyId: true, assetId: true, bookingId: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } });
    } catch (error) {
      await unlink(join(root, storageKey)).catch(() => undefined);
      throw error;
    }
  }

  async download(auth: AuthContext, documentId: string) {
    const row = await this.prisma.document.findFirst({ where: {
      id: documentId, organizationId: auth.organizationId!, deletedAt: null,
      ...(auth.branchId ? { branchId: auth.branchId } : {}),
    }, select: { storageKey: true, fileName: true, mimeType: true, sizeBytes: true, checksum: true } });
    if (!row) throw new NotFoundException("Document not found.");
    const root = storageRoot();
    const filePath = resolve(root, row.storageKey);
    if (!filePath.startsWith(`${root}/`)) throw new NotFoundException("Document not found.");
    const buffer = await readFile(filePath).catch(() => null);
    if (!buffer || buffer.length !== row.sizeBytes || createHash("sha256").update(buffer).digest("hex") !== row.checksum) throw new NotFoundException("The stored document is unavailable.");
    return { buffer, fileName: row.fileName, mimeType: row.mimeType, sizeBytes: row.sizeBytes };
  }

  async remove(auth: AuthContext, documentId: string) {
    const row = await this.prisma.document.findFirst({ where: { id: documentId, organizationId: auth.organizationId!, deletedAt: null, ...(auth.branchId ? { branchId: auth.branchId } : {}) }, select: { id: true, storageKey: true } });
    if (!row) throw new NotFoundException("Document not found.");
    await this.prisma.document.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
    await unlink(join(storageRoot(), row.storageKey)).catch(() => undefined);
    return { status: "deleted" };
  }
}
