import { FieldValue } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { getOptionalBoolean, getRequiredString } from './_lib/validation';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';

interface ModelAdminUpdateBody {
  modelId?: string;
  isActive?: boolean | string;
  isFeatured?: boolean | string;
  delete?: boolean | string;
}

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'models.publish');
    const body = event.body ? (JSON.parse(event.body) as ModelAdminUpdateBody) : {};
    const modelId = getRequiredString(body.modelId, 'modelId', 128);
    const nextIsActive =
      body.isActive === undefined ? undefined : getOptionalBoolean(body.isActive);
    const nextIsFeatured =
      body.isFeatured === undefined ? undefined : getOptionalBoolean(body.isFeatured);
    const shouldDelete =
      body.delete === undefined ? false : getOptionalBoolean(body.delete) === true;

    if (nextIsActive === undefined && nextIsFeatured === undefined && !shouldDelete) {
      return badRequest('At least one model admin update field is required.');
    }

    const firestore = getAdminFirestore();
    const modelRef = firestore.collection('models').doc(modelId);
    const snapshot = await modelRef.get();
    if (!snapshot.exists) {
      return json(404, { error: 'Model not found.' });
    }

    const previousData = (snapshot.data() ?? {}) as Record<string, unknown>;

    if (shouldDelete) {
      await modelRef.delete();
      const dealerLinks = await firestore
        .collection('dealerModels')
        .where('model_id', '==', modelId)
        .get();
      await Promise.all(dealerLinks.docs.map(doc => doc.ref.delete()));

      await writeAdminAuditLog({
        actor: buildAuditActor(profile),
        action: 'model.updated',
        entityType: 'model',
        entityId: modelId,
        target: {
          uid: typeof previousData.ownerUid === 'string' ? previousData.ownerUid : null,
        },
        summary: `Deleted model ${modelId}.`,
        before: {
          brand: previousData.brand ?? null,
          model_name: previousData.model_name ?? null,
          isActive: previousData.isActive ?? null,
          isFeatured: previousData.isFeatured ?? null,
        },
        after: {
          deleted: true,
        },
        metadata: {
          deletedDealerLinks: dealerLinks.size,
        },
      });

      return json(200, {
        ok: true,
        modelId,
        deleted: true,
      });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: profile.uid,
    };
    if (nextIsActive !== undefined) {
      updateData.isActive = nextIsActive;
    }
    if (nextIsFeatured !== undefined) {
      updateData.isFeatured = nextIsFeatured;
    }

    await modelRef.update(updateData);

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'model.updated',
      entityType: 'model',
      entityId: modelId,
      target: {
        uid: typeof previousData.ownerUid === 'string' ? previousData.ownerUid : null,
      },
      summary: `Updated model moderation flags for ${modelId}.`,
      before: {
        isActive: previousData.isActive ?? null,
        isFeatured: previousData.isFeatured ?? null,
      },
      after: {
        isActive: nextIsActive ?? previousData.isActive ?? null,
        isFeatured: nextIsFeatured ?? previousData.isFeatured ?? null,
      },
      metadata: {
        brand: previousData.brand ?? null,
        model_name: previousData.model_name ?? null,
      },
    });

    return json(200, {
      ok: true,
      modelId,
      isActive: nextIsActive ?? previousData.isActive ?? null,
      isFeatured: nextIsFeatured ?? previousData.isFeatured ?? null,
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Missing required permission')) {
      return forbidden(message);
    }
    if (message.startsWith('Authenticated admin profile was not found')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side model moderation is not configured.');
    }
    if (message.includes('required') || message.includes('Boolean value is invalid') || message.includes('At least one model admin update field')) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
