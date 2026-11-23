/**
 * Shared image rules for the tournament memory album.
 *
 * The browser resizes photos before upload (see lib/resize-image.ts), but the
 * server never trusts that: type, size and magic bytes are checked again here.
 * Nothing in this module imports server-only code, so the tests can use it too.
 */

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

/**
 * The bucket allows 5MB, but keeping the app limit at 2MB means a full 12-photo
 * batch still fits the 32MB Server Action body limit. Browser resizing happens
 * before upload, so 2MB is generous for a 1800px JPEG.
 */
export const MAX_MEMORY_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_PHOTOS_PER_BATCH = 12;

export type ImageExtension = "jpg" | "png" | "webp";

/**
 * Extension from the file's first bytes, not its name or declared MIME type.
 * A renamed .exe must never land in a public image bucket.
 */
export function detectImageExtension(bytes: Uint8Array): ImageExtension | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function isAcceptedImageType(type: string): type is AcceptedImageType {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/** Human-readable rejection reason, or null when the file may be uploaded. */
export function memoryFileError(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!isAcceptedImageType(file.type)) {
    return `${file.name}: use a JPG, PNG or WebP image.`;
  }
  if (file.size === 0) return `${file.name}: this file is empty.`;
  if (file.size > MAX_MEMORY_FILE_BYTES) {
    return `${file.name}: larger than 5 MB after resizing. Try fewer photos at once.`;
  }
  return null;
}

export function contentTypeFor(ext: ImageExtension): AcceptedImageType {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
