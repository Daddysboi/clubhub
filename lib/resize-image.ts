/**
 * Browser-side photo prep for bulk memory uploads.
 *
 * Phone photos are often 4–10 MB each; a batch of them would blow straight
 * through the Server Action body limit. Resizing here keeps the upload small,
 * strips EXIF (location data the organiser never asked for), and normalises
 * orientation before the image ever reaches the server.
 *
 * Client-only: imported by the admin upload panel, never by a Server Action.
 */

const MAX_DIMENSION = 1800;
const TARGET_BYTES = 4_500_000;
const QUALITY_STEPS = [0.85, 0.7, 0.55] as const;

export type PreparedImage = {
  file: File;
  width: number;
  height: number;
};

type ImageSource = CanvasImageSource & { width: number; height: number };

function loadWithImageElement(file: File): Promise<ImageSource> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}. Try a JPG, PNG or WebP.`));
    };
    img.src = url;
  });
}

async function decode(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      // Respect the phone's orientation tag. decode() keeps the source object
      // valid until drawImage finishes; close() is called by the caller.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Safari/older browsers may not decode some formats this way.
    }
  }
  return loadWithImageElement(file);
}

function release(source: ImageSource) {
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) source.close();
}

export async function prepareMemoryImage(file: File): Promise<PreparedImage> {
  const source = await decode(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot resize images.");

    // Photos have no meaningful transparency; a white ground keeps PNGs with
    // alpha from turning into a black rectangle once encoded as JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    let blob: Blob | null = null;
    for (const quality of QUALITY_STEPS) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= TARGET_BYTES) break;
    }
    if (!blob) throw new Error(`Could not resize ${file.name}.`);

    const base = file.name.replace(/\.[^.]+$/, "") || "memory";
    return {
      file: new File([blob], `${base}.jpg`, { type: "image/jpeg" }),
      width,
      height,
    };
  } finally {
    release(source);
  }
}
