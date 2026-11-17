import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const maxBytes = 8 * 1024 * 1024;
const widths = [480, 960, 1600] as const;

export interface MediaConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

export function readMediaConfig(): MediaConfig | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() || 'auto';
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl:
      process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, '') || `${endpoint}/${bucket}`,
  };
}

export function validateImage(file: { type: string; size: number }) {
  if (!allowedTypes.has(file.type)) {
    return 'Upload a JPEG, PNG, WebP, or AVIF image.';
  }
  if (file.size <= 0) return 'The image is empty.';
  if (file.size > maxBytes) return 'The image must be 8 MB or smaller.';
  return null;
}

export interface CropInput {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export async function processAndUploadImage(
  input: Buffer,
  options: { alt: string; credit?: string | null; crop?: CropInput },
) {
  const config = readMediaConfig();
  if (!config) {
    throw new Error('STORAGE_NOT_CONFIGURED');
  }

  const image = sharp(input, { failOn: 'error' }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('INVALID_IMAGE');
  }

  let pipeline = image;
  if (options.crop?.width && options.crop?.height) {
    pipeline = pipeline.extract({
      left: Math.max(0, Math.round(options.crop.left ?? 0)),
      top: Math.max(0, Math.round(options.crop.top ?? 0)),
      width: Math.round(options.crop.width),
      height: Math.round(options.crop.height),
    });
  }

  const id = randomUUID();
  const year = new Date().getUTCFullYear();
  const prefix = `destinations/${year}/${id}`;
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const variants: Record<string, string> = {};
  let largeWidth = 0;
  let largeHeight = 0;

  for (const width of widths) {
    const output = await pipeline
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    const key = `${prefix}-${width}.webp`;
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: output.data,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: {
          alt: options.alt.slice(0, 200),
          ...(options.credit ? { credit: options.credit.slice(0, 200) } : {}),
        },
      }),
    );

    variants[String(width)] = `${config.publicBaseUrl}/${key}`;
    largeWidth = output.info.width;
    largeHeight = output.info.height;
  }

  return {
    id,
    url: variants['1600'] ?? variants['960'] ?? variants['480'],
    variants,
    width: largeWidth,
    height: largeHeight,
  };
}

export const mediaLimits = { maxBytes, allowedTypes: [...allowedTypes], widths };
