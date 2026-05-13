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
import type { ModelReviewStatus } from '../../types';

interface ModelAdminUpdateBody {
  modelId?: string;
  isActive?: boolean | string;
  isFeatured?: boolean | string;
  delete?: boolean | string;
  reviewStatus?: ModelReviewStatus;
  reviewNotes?: string | null;
}

const MODEL_REVIEW_STATUSES = ['approved', 'pending_review', 'rejected'] as const satisfies readonly ModelReviewStatus[];

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
    const nextReviewStatus =
      body.reviewStatus === undefined
        ? undefined
        : MODEL_REVIEW_STATUSES.includes(body.reviewStatus)
          ? body.reviewStatus
          : null;
    const reviewNotes =
      body.reviewNotes === undefined
        ? undefined
        : body.reviewNotes === null
          ? null
          : typeof body.reviewNotes === 'string'
            ? body.reviewNotes.trim().slice(0, 2000) || null
            : null;

    if (
      nextIsActive === undefined &&
      nextIsFeatured === undefined &&
      !shouldDelete &&
      nextReviewStatus === undefined &&
      reviewNotes === undefined
    ) {
      return badRequest('At least one model admin update field is required.');
    }
    if (nextReviewStatus === null) {
      return badRequest('reviewStatus must be one of: approved, pending_review, rejected.');
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
    if (nextReviewStatus !== undefined) {
      updateData.reviewStatus = nextReviewStatus;
      updateData.reviewedAt = FieldValue.serverTimestamp();
      updateData.reviewedBy = profile.uid;
      if (nextReviewStatus === 'approved' && nextIsActive === undefined) {
        updateData.isActive = true;
      }
      if (nextReviewStatus === 'rejected' && nextIsActive === undefined) {
        updateData.isActive = false;
      }
    }
    if (reviewNotes !== undefined) {
      updateData.reviewNotes = reviewNotes;
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
        reviewStatus: previousData.reviewStatus ?? null,
        reviewNotes: previousData.reviewNotes ?? null,
      },
      after: {
        isActive:
          nextIsActive ??
          (nextReviewStatus === 'approved'
            ? true
            : nextReviewStatus === 'rejected'
              ? false
              : previousData.isActive ?? null),
        isFeatured: nextIsFeatured ?? previousData.isFeatured ?? null,
        reviewStatus: nextReviewStatus ?? previousData.reviewStatus ?? null,
        reviewNotes: reviewNotes ?? previousData.reviewNotes ?? null,
      },
      metadata: {
        brand: previousData.brand ?? null,
        model_name: previousData.model_name ?? null,
      },
    });

    return json(200, {
      ok: true,
      modelId,
      isActive:
        nextIsActive ??
        (nextReviewStatus === 'approved'
          ? true
          : nextReviewStatus === 'rejected'
            ? false
            : previousData.isActive ?? null),
      isFeatured: nextIsFeatured ?? previousData.isFeatured ?? null,
      reviewStatus: nextReviewStatus ?? previousData.reviewStatus ?? null,
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
    if (
      message.includes('required') ||
      message.includes('Boolean value is invalid') ||
      message.includes('At least one model admin update field') ||
      message.includes('reviewStatus must be one of')
    ) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
