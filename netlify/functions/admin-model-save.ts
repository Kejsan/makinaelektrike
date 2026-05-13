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
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import {
  getRequiredRecord,
  parseOptionalBooleanField,
  parseOptionalNumberField,
  parseOptionalStringField,
  parseStringArrayField,
} from './_lib/adminFormPayloads';
import { getRequiredString } from './_lib/validation';

interface ModelSaveBody {
  modelId?: string;
  values?: Record<string, unknown>;
}

const parseModelValues = (value: unknown) => {
  const record = getRequiredRecord(value, 'values');
  const updates: Record<string, unknown> = {};

  const brand = parseOptionalStringField(record, 'brand', 200);
  if (brand !== undefined) updates.brand = brand;

  const modelName = parseOptionalStringField(record, 'model_name', 200);
  if (modelName !== undefined) updates.model_name = modelName;

  const source = parseOptionalStringField(record, 'source', 32);
  if (source !== undefined) updates.source = source;

  const yearStart = parseOptionalNumberField(record, 'year_start');
  if (yearStart !== undefined) updates.year_start = yearStart;

  const bodyType = parseOptionalStringField(record, 'body_type', 120);
  if (bodyType !== undefined) updates.body_type = bodyType;

  const chargePort = parseOptionalStringField(record, 'charge_port', 120);
  if (chargePort !== undefined) updates.charge_port = chargePort;

  const chargePower = parseOptionalNumberField(record, 'charge_power');
  if (chargePower !== undefined) updates.charge_power = chargePower;

  const autochargeSupported = parseOptionalBooleanField(record, 'autocharge_supported');
  if (autochargeSupported !== undefined) {
    updates.autocharge_supported = autochargeSupported;
  }

  const batteryCapacity = parseOptionalNumberField(record, 'battery_capacity');
  if (batteryCapacity !== undefined) updates.battery_capacity = batteryCapacity;

  const batteryUseableCapacity = parseOptionalNumberField(record, 'battery_useable_capacity');
  if (batteryUseableCapacity !== undefined) {
    updates.battery_useable_capacity = batteryUseableCapacity;
  }

  const batteryType = parseOptionalStringField(record, 'battery_type', 120);
  if (batteryType !== undefined) updates.battery_type = batteryType;

  const batteryVoltage = parseOptionalNumberField(record, 'battery_voltage');
  if (batteryVoltage !== undefined) updates.battery_voltage = batteryVoltage;

  const rangeWltp = parseOptionalNumberField(record, 'range_wltp');
  if (rangeWltp !== undefined) updates.range_wltp = rangeWltp;

  const powerKw = parseOptionalNumberField(record, 'power_kw');
  if (powerKw !== undefined) updates.power_kw = powerKw;

  const torqueNm = parseOptionalNumberField(record, 'torque_nm');
  if (torqueNm !== undefined) updates.torque_nm = torqueNm;

  const acceleration = parseOptionalNumberField(record, 'acceleration_0_100');
  if (acceleration !== undefined) updates.acceleration_0_100 = acceleration;

  const accelerationSixty = parseOptionalNumberField(record, 'acceleration_0_60');
  if (accelerationSixty !== undefined) updates.acceleration_0_60 = accelerationSixty;

  const topSpeed = parseOptionalNumberField(record, 'top_speed');
  if (topSpeed !== undefined) updates.top_speed = topSpeed;

  const driveType = parseOptionalStringField(record, 'drive_type', 120);
  if (driveType !== undefined) updates.drive_type = driveType;

  const seats = parseOptionalNumberField(record, 'seats');
  if (seats !== undefined) updates.seats = seats;

  const chargingAc = parseOptionalStringField(record, 'charging_ac', 500);
  if (chargingAc !== undefined) updates.charging_ac = chargingAc;

  const chargingDc = parseOptionalStringField(record, 'charging_dc', 500);
  if (chargingDc !== undefined) updates.charging_dc = chargingDc;

  const lengthMm = parseOptionalNumberField(record, 'length_mm');
  if (lengthMm !== undefined) updates.length_mm = lengthMm;

  const widthMm = parseOptionalNumberField(record, 'width_mm');
  if (widthMm !== undefined) updates.width_mm = widthMm;

  const heightMm = parseOptionalNumberField(record, 'height_mm');
  if (heightMm !== undefined) updates.height_mm = heightMm;

  const wheelbaseMm = parseOptionalNumberField(record, 'wheelbase_mm');
  if (wheelbaseMm !== undefined) updates.wheelbase_mm = wheelbaseMm;

  const weightKg = parseOptionalNumberField(record, 'weight_kg');
  if (weightKg !== undefined) updates.weight_kg = weightKg;

  const cargoVolume = parseOptionalNumberField(record, 'cargo_volume_l');
  if (cargoVolume !== undefined) updates.cargo_volume_l = cargoVolume;

  const notes = parseOptionalStringField(record, 'notes', 5000);
  if (notes !== undefined) updates.notes = notes;

  const imageUrl = parseOptionalStringField(record, 'image_url', 2000);
  if (imageUrl !== undefined) updates.image_url = imageUrl;

  const isFeatured = parseOptionalBooleanField(record, 'isFeatured');
  if (isFeatured !== undefined) updates.isFeatured = isFeatured;

  const imageGallery = parseStringArrayField(record, 'imageGallery', 3, 2000);
  if (imageGallery !== undefined) updates.imageGallery = imageGallery;

  const isActive = parseOptionalBooleanField(record, 'isActive');
  if (isActive !== undefined) updates.isActive = isActive;

  return updates;
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'models.publish');
    const body = event.body ? (JSON.parse(event.body) as ModelSaveBody) : {};
    const modelId =
      body.modelId === undefined ? undefined : getRequiredString(body.modelId, 'modelId', 128);
    const isCreate = !modelId;
    const updates = parseModelValues(body.values);

    if (!isCreate && Object.keys(updates).length === 0) {
      return badRequest('At least one model save field is required.');
    }

    const firestore = getAdminFirestore();
    let resolvedModelId = modelId ?? null;
    let previousData: Record<string, unknown> = {};

    if (modelId) {
      const modelRef = firestore.collection('models').doc(modelId);
      const snapshot = await modelRef.get();
      if (!snapshot.exists) {
        return json(404, { error: 'Model not found.' });
      }
      previousData = (snapshot.data() ?? {}) as Record<string, unknown>;

      await modelRef.update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: profile.uid,
      });
      resolvedModelId = modelId;
    } else {
      const brand = typeof updates.brand === 'string' ? updates.brand : null;
      const modelName = typeof updates.model_name === 'string' ? updates.model_name : null;
      if (!brand || !modelName) {
        return badRequest('brand and model_name are required to create a model.');
      }

      const modelRef = firestore.collection('models').doc();
      await modelRef.set({
        ...updates,
        ownerUid: profile.uid,
        reviewStatus: 'approved',
        submissionSource: 'admin',
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: profile.uid,
        reviewNotes: null,
        createdBy: profile.uid,
        updatedBy: profile.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      resolvedModelId = modelRef.id;
    }

    if (!resolvedModelId) {
      return internalError('Model id could not be resolved after save.');
    }

    const savedSnapshot = await firestore.collection('models').doc(resolvedModelId).get();
    const savedData = (savedSnapshot.data() ?? {}) as Record<string, unknown>;

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'model.updated',
      entityType: 'model',
      entityId: resolvedModelId,
      target: {
        uid:
          typeof savedData.ownerUid === 'string'
            ? savedData.ownerUid
            : typeof previousData.ownerUid === 'string'
              ? previousData.ownerUid
              : null,
      },
      summary: isCreate
        ? `Created model ${resolvedModelId}.`
        : `Updated model ${resolvedModelId}.`,
      before: isCreate
        ? null
        : {
            brand: previousData.brand ?? null,
            model_name: previousData.model_name ?? null,
            isActive: previousData.isActive ?? null,
            isFeatured: previousData.isFeatured ?? null,
            image_url: previousData.image_url ?? null,
            imageGallery: previousData.imageGallery ?? [],
          },
      after: {
        brand: savedData.brand ?? null,
        model_name: savedData.model_name ?? null,
        isActive: savedData.isActive ?? null,
        isFeatured: savedData.isFeatured ?? null,
        image_url: savedData.image_url ?? null,
        imageGallery: savedData.imageGallery ?? [],
      },
      metadata: {
        operation: isCreate ? 'create' : 'update',
      },
    });

    return json(200, {
      ok: true,
      modelId: resolvedModelId,
      model: {
        id: savedSnapshot.id,
        ...(savedData as Record<string, unknown>),
      },
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
      return serviceUnavailable('Server-side model saves are not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('must be an object') ||
      message.includes('must be a string') ||
      message.includes('must be an array') ||
      message.includes('must be a valid number') ||
      message.includes('Boolean value is invalid')
    ) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
