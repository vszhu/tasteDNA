export const MENU_IMAGE_MAX_LONG_EDGE = 1_920;
export const MENU_IMAGE_QUALITY = 0.86;
export const MAX_MENU_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_MENU_SOURCE_BYTES = 30 * 1024 * 1024;

const RECOMPRESS_THRESHOLD_BYTES = 2.5 * 1024 * 1024;
const OPTIMIZABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface ImageOptimizationDiagnostics {
  durationMs: number;
  originalWidth?: number;
  originalHeight?: number;
  originalBytes: number;
  optimizedWidth?: number;
  optimizedHeight?: number;
  optimizedBytes: number;
  changed: boolean;
  skippedReason?: "unsupported_format" | "already_optimized" | "optimized_not_smaller";
}

export interface ImageOptimizationResult {
  file: File;
  diagnostics: ImageOptimizationDiagnostics;
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

export function isSupportedMenuImageType(type: string) {
  return OPTIMIZABLE_TYPES.has(type) || type === "image/heic" || type === "image/heif";
}

export function calculateOptimizedDimensions(width: number, height: number, maxLongEdge = MENU_IMAGE_MAX_LONG_EDGE) {
  if (width <= 0 || height <= 0) throw new Error("Image dimensions must be positive.");
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function shouldOptimizeMenuImage(width: number, height: number, bytes: number) {
  return Math.max(width, height) > MENU_IMAGE_MAX_LONG_EDGE || bytes > RECOMPRESS_THRESHOLD_BYTES;
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  const image = new window.Image();
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg", quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error(`The browser could not encode ${type}.`));
    }, type, quality);
  });
}

function optimizedFilename(originalName: string, type: string) {
  const base = originalName.replace(/\.[^.]+$/, "") || "menu";
  return `${base}.${type === "image/webp" ? "webp" : "jpg"}`;
}

export async function optimizeMenuImage(file: File): Promise<ImageOptimizationResult> {
  const started = performance.now();
  if (!OPTIMIZABLE_TYPES.has(file.type)) {
    return {
      file,
      diagnostics: {
        durationMs: Math.round(performance.now() - started),
        originalBytes: file.size,
        optimizedBytes: file.size,
        changed: false,
        skippedReason: "unsupported_format",
      },
    };
  }

  const decoded = await decodeImage(file);
  try {
    const dimensions = calculateOptimizedDimensions(decoded.width, decoded.height);
    if (!shouldOptimizeMenuImage(decoded.width, decoded.height, file.size)) {
      return {
        file,
        diagnostics: {
          durationMs: Math.round(performance.now() - started),
          originalWidth: decoded.width,
          originalHeight: decoded.height,
          originalBytes: file.size,
          optimizedWidth: decoded.width,
          optimizedHeight: decoded.height,
          optimizedBytes: file.size,
          changed: false,
          skippedReason: "already_optimized",
        },
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("The browser could not prepare the menu image.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, dimensions.width, dimensions.height);
    context.drawImage(decoded.source, 0, 0, dimensions.width, dimensions.height);

    let blob = await canvasBlob(canvas, "image/webp", MENU_IMAGE_QUALITY);
    if (blob.type !== "image/webp") blob = await canvasBlob(canvas, "image/jpeg", MENU_IMAGE_QUALITY);

    const resized = dimensions.width !== decoded.width || dimensions.height !== decoded.height;
    if (!resized && blob.size >= file.size && file.size <= MAX_MENU_UPLOAD_BYTES) {
      return {
        file,
        diagnostics: {
          durationMs: Math.round(performance.now() - started),
          originalWidth: decoded.width,
          originalHeight: decoded.height,
          originalBytes: file.size,
          optimizedWidth: decoded.width,
          optimizedHeight: decoded.height,
          optimizedBytes: file.size,
          changed: false,
          skippedReason: "optimized_not_smaller",
        },
      };
    }

    const optimized = new File([blob], optimizedFilename(file.name, blob.type), {
      type: blob.type,
      lastModified: file.lastModified,
    });
    return {
      file: optimized,
      diagnostics: {
        durationMs: Math.round(performance.now() - started),
        originalWidth: decoded.width,
        originalHeight: decoded.height,
        originalBytes: file.size,
        optimizedWidth: dimensions.width,
        optimizedHeight: dimensions.height,
        optimizedBytes: optimized.size,
        changed: true,
      },
    };
  } finally {
    decoded.cleanup();
  }
}
