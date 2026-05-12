import type { DocumentData } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  parseJsonBody,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { requireAuthenticatedProfile } from './_lib/adminAccess';
import { requireDealerAccess } from './_lib/dealerAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import {
  decodeBase64Image,
  getRequiredUploadString,
  parseImageContentType,
  parseMediaFileName,
  parseMediaVariant,
  sanitizePathSegment,
} from './_lib/mediaUpload';
import { uploadBufferToR2 } from './_lib/r2';
import { hasPermission } from '../../utils/accessControl';

interface ModelMediaUploadBody {
  modelId?: unknown;
  variant?: unknown;
  fileName?: unknown;
  contentType?: unknown;
  dataBase64?: unknown;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ensureModelUploadAccess = async (profile: Awaited<ReturnType<typeof requireAuthenticatedProfile>>['profile'], modelId: string) => {
  const firestore = getAdminFirestore();
  const snapshot = await firestore.collection('models').doc(modelId).get();
  if (!snapshot.exists) {
    throw new Error('Model record was not found.');
  }

  const modelData = (snapshot.data() ?? {}) as DocumentData;
  if (hasPermission(profile, 'models.publish') || hasPermission(profile, 'models.merge')) {
    return;
  }

  if (typeof modelData.ownerUid === 'string' && modelData.ownerUid === profile.uid) {
    return;
  }

  if (typeof modelData.ownerDealerId === 'string' && modelData.ownerDealerId.trim()) {
    await requireDealerAccess(profile, modelData.ownerDealerId);
    return;
  }

  throw new Error('You do not have model access for this record.');
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAuthenticatedProfile(event);
    const body = parseJsonBody<ModelMediaUploadBody>(event);
    const modelId = getRequiredUploadString(body.modelId, 'modelId', 128);
    const variant = parseMediaVariant(body.variant);
    const contentType = parseImageContentType(body.contentType);
    const fileName = parseMediaFileName(body.fileName, contentType, 'model-image');
    const imageBody = decodeBase64Image(body.dataBase64, MAX_IMAGE_BYTES);

    await ensureModelUploadAccess(profile, modelId);

    const key = `models/${sanitizePathSegment(modelId)}/${variant}/${fileName}`;
    const url = await uploadBufferToR2({
      key,
      contentType,
      body: imageBody,
    });

    return json(200, {
      ok: true,
      url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error.';

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (
      message === 'Authenticated admin profile was not found.' ||
      message === 'You do not have dealer access for this record.' ||
      message === 'You do not have model access for this record.'
    ) {
      return forbidden(message);
    }
    if (message.startsWith('Missing R2 upload credentials')) {
      return serviceUnavailable('Model media uploads are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('too long') ||
      message.includes('Unsupported image format') ||
      message.includes('too large') ||
      message.includes('empty') ||
      message.includes('variant must') ||
      message.includes('Model record was not found')
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
};
