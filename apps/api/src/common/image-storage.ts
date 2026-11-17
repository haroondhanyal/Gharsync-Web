import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { BadRequestException } from "@nestjs/common";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" } as const;
const root = () => resolve(process.env.DOCUMENT_STORAGE_PATH ?? "../../var/documents");

export function imageMime(file: Express.Multer.File | undefined) {
  if (!file?.buffer?.length) throw new BadRequestException("Choose an image to upload.");
  if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException("Images must be 10 MB or smaller.");
  const buffer = file.buffer;
  const detected = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png"
    : buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff ? "image/jpeg"
    : buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
  if (!detected || file.mimetype !== detected) throw new BadRequestException("Upload a valid JPEG, PNG or WebP image.");
  return detected;
}

export async function saveImage(file: Express.Multer.File, mime: keyof typeof IMAGE_TYPES) {
  const storageKey = `photo-${randomUUID()}${IMAGE_TYPES[mime]}`;
  const directory = root();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(join(directory, storageKey), file.buffer, { flag: "wx", mode: 0o600 });
  return storageKey;
}

export async function deleteImage(storageKey: string | null | undefined) {
  if (storageKey && /^[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(storageKey)) await unlink(join(root(), storageKey)).catch(() => undefined);
}

export async function readImage(storageKey: string | null | undefined) {
  if (!storageKey || !/^[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(storageKey)) return null;
  return readFile(join(root(), storageKey)).catch(() => null);
}
