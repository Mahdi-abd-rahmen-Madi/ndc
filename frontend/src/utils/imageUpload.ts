/**
 * Shared image validation and lazy-loaded compression utility.
 * Dynamically imports `browser-image-compression` only when an uploaded file
 * exceeds 1 MB, keeping the 53 kB compression library out of initial route chunks.
 */

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const COMPRESS_THRESHOLD_BYTES = 1024 * 1024; // 1 MB

export interface ImageValidationOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Format invalide. Seuls les formats PNG et JPG sont acceptés.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'Fichier trop lourd (maximum 10 Mo).';
  }
  return null;
}

export async function compressImageIfNeeded(
  file: File,
  options: ImageValidationOptions = {}
): Promise<File> {
  if (file.size <= COMPRESS_THRESHOLD_BYTES) {
    return file;
  }
  const { default: imageCompression } = await import('browser-image-compression');
  return imageCompression(file, {
    maxSizeMB: options.maxSizeMB ?? 1,
    maxWidthOrHeight: options.maxWidthOrHeight ?? 1200,
    useWebWorker: true,
  });
}

