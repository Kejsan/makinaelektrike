const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

const WEBP_CONTENT_TYPE = 'image/webp';

type ImageSource =
  | {
      kind: 'bitmap';
      value: ImageBitmap;
      width: number;
      height: number;
      dispose: () => void;
    }
  | {
      kind: 'image';
      value: HTMLImageElement;
      width: number;
      height: number;
      dispose: () => void;
    };

export interface OptimizeImageOptions {
  maxDimension?: number;
  targetMaxBytes?: number;
  quality?: number;
  minQuality?: number;
}

const sanitizeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const stripExtension = (name: string) => {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) {
    return name;
  }

  return name.slice(0, dotIndex);
};

const assertSupportedSourceImage = (file: File) => {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Unsupported image format. Please upload a JPEG, PNG, WebP, AVIF, or GIF file.');
  }

  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('Image is too large. Please upload a file smaller than 10 MB.');
  }
};

const readBlobAsBase64 = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read image upload payload.'));
        return;
      }

      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image upload payload.'));
    reader.readAsDataURL(file);
  });

const loadImageElement = (file: File) =>
  new Promise<ImageSource>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () =>
      resolve({
        kind: 'image',
        value: image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        dispose: () => URL.revokeObjectURL(objectUrl),
      });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read the selected image.'));
    };
    image.src = objectUrl;
  });

const loadImageSource = async (file: File): Promise<ImageSource> => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        kind: 'bitmap',
        value: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      return loadImageElement(file);
    }
  }

  return loadImageElement(file);
};

const renderCanvasBlob = (
  canvas: HTMLCanvasElement,
  quality: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('Failed to optimize the selected image.'));
          return;
        }

        resolve(blob);
      },
      WEBP_CONTENT_TYPE,
      quality,
    );
  });

export const optimizeImageForUpload = async (
  file: File,
  options: OptimizeImageOptions = {},
): Promise<File> => {
  assertSupportedSourceImage(file);

  const {
    maxDimension = 1600,
    targetMaxBytes = 900 * 1024,
    quality = 0.82,
    minQuality = 0.56,
  } = options;

  const source = await loadImageSource(file);

  try {
    const longestSide = Math.max(source.width, source.height);
    const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      throw new Error('Could not prepare image upload in this browser.');
    }

    context.drawImage(source.value, 0, 0, width, height);

    let currentQuality = quality;
    let blob = await renderCanvasBlob(canvas, currentQuality);
    while (blob.size > targetMaxBytes && currentQuality > minQuality) {
      currentQuality = Math.max(minQuality, Number((currentQuality - 0.08).toFixed(2)));
      blob = await renderCanvasBlob(canvas, currentQuality);
      if (currentQuality === minQuality) {
        break;
      }
    }

    const baseName = sanitizeFileName(stripExtension(file.name)) || 'image-upload';
    return new File([blob], `${baseName}.webp`, {
      type: WEBP_CONTENT_TYPE,
      lastModified: Date.now(),
    });
  } finally {
    source.dispose();
  }
};

export const encodeFileAsBase64 = async (file: File) => readBlobAsBase64(file);
