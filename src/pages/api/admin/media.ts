import type { APIRoute } from 'astro';
import { apiRoute, ApiError, json } from '../../../lib/api';
import { getContentAdmin } from '../../../lib/admin-auth';
import {
  mediaLimits,
  processAndUploadImage,
  readMediaConfig,
  validateImage,
  type CropInput,
} from '../../../lib/media';

export const prerender = false;

function numberField(form: FormData, key: string): number | undefined {
  const raw = String(form.get(key) ?? '').trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export const POST: APIRoute = apiRoute(
  async (context, requestId) => {
    const { allowed } = await getContentAdmin(context);
    if (!allowed) {
      throw new ApiError({
        status: 403,
        code: 'forbidden',
        message: 'Content administrator access required.',
      });
    }

    if (!readMediaConfig()) {
      throw new ApiError({
        status: 503,
        code: 'storage_not_configured',
        message:
          'Photo storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.',
      });
    }

    const form = await context.request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new ApiError({
        status: 422,
        code: 'missing_file',
        message: 'Choose an image to upload.',
      });
    }

    const validation = validateImage({ type: file.type, size: file.size });
    if (validation) {
      throw new ApiError({
        status: validation.includes('8 MB') ? 413 : 415,
        code: 'invalid_image',
        message: validation,
      });
    }

    const alt = String(form.get('alt') ?? '').trim();
    if (!alt) {
      throw new ApiError({
        status: 422,
        code: 'missing_alt',
        message: 'Describe the image for screen readers before uploading.',
      });
    }

    const crop: CropInput = {
      left: numberField(form, 'cropLeft'),
      top: numberField(form, 'cropTop'),
      width: numberField(form, 'cropWidth'),
      height: numberField(form, 'cropHeight'),
    };

    try {
      const result = await processAndUploadImage(Buffer.from(await file.arrayBuffer()), {
        alt,
        credit: String(form.get('credit') ?? '').trim() || null,
        crop,
      });
      return json(
        {
          data: {
            ...result,
            alt,
            limits: mediaLimits,
          },
          requestId,
        },
        201,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'STORAGE_NOT_CONFIGURED') {
        throw new ApiError({
          status: 503,
          code: 'storage_not_configured',
          message: 'Photo storage is not configured.',
        });
      }
      if (error instanceof Error && error.message === 'INVALID_IMAGE') {
        throw new ApiError({
          status: 415,
          code: 'invalid_image',
          message: 'The file could not be read as an image.',
        });
      }
      throw error;
    }
  },
  { rateLimit: { limit: 20, windowMs: 60_000 } },
);
