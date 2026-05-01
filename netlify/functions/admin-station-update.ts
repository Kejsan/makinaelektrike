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
import { getOptionalBoolean, getOptionalString, getRequiredString } from './_lib/validation';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { buildAuditActor, writeAdminAuditLog } from './_lib/auditLog';
import type { ChargingStationFormValues } from '../../types';

interface StationUpdateBody {
  action?: 'create' | 'update' | 'delete';
  stationId?: string;
  values?: ChargingStationFormValues;
}

const STATION_ACTIONS = ['create', 'update', 'delete'] as const;

const parseRequiredNumber = (value: unknown, field: string) => {
  if (value === '' || value === undefined || value === null) {
    throw new Error(`${field} is required.`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a valid number.`);
  }

  return parsed;
};

const parseOptionalNumber = (value: unknown, field: string) => {
  if (value === '' || value === undefined || value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a valid number.`);
  }

  return parsed;
};

const normalizeStationValues = (values: ChargingStationFormValues) => ({
  address: getRequiredString(values.address, 'address', 500),
  plugTypes: getRequiredString(values.plugTypes, 'plugTypes', 200),
  chargingSpeedKw: parseRequiredNumber(values.chargingSpeedKw, 'chargingSpeedKw'),
  operator: getOptionalString(values.operator, { field: 'operator', maxLength: 200 }) ?? null,
  pricingDetails:
    getOptionalString(values.pricingDetails, { field: 'pricingDetails', maxLength: 1000 }) ?? null,
  googleMapsLink:
    getOptionalString(values.googleMapsLink, { field: 'googleMapsLink', maxLength: 1000 }) ?? null,
  latitude: parseOptionalNumber(values.latitude, 'latitude'),
  longitude: parseOptionalNumber(values.longitude, 'longitude'),
  isActive:
    values.isActive === undefined ? true : getOptionalBoolean(values.isActive) ?? true,
});

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const { profile } = await requireAdminPermission(event, 'stations.edit');
    const body = event.body ? (JSON.parse(event.body) as StationUpdateBody) : {};
    const action = getRequiredString(body.action, 'action', 32) as StationUpdateBody['action'];
    if (!STATION_ACTIONS.includes(action ?? 'create')) {
      throw new Error(`action must be one of: ${STATION_ACTIONS.join(', ')}.`);
    }

    const firestore = getAdminFirestore();

    if (action === 'delete') {
      const stationId = getRequiredString(body.stationId, 'stationId', 128);
      const stationRef = firestore.collection('charging_stations').doc(stationId);
      const snapshot = await stationRef.get();
      if (!snapshot.exists) {
        return json(404, { error: 'Charging station not found.' });
      }
      const previousData = (snapshot.data() ?? {}) as Record<string, unknown>;
      await stationRef.delete();
      await writeAdminAuditLog({
        actor: buildAuditActor(profile),
        action: 'charging_station.updated',
        entityType: 'charging_station',
        entityId: stationId,
        summary: `Deleted charging station ${stationId}.`,
        before: {
          address: previousData.address ?? null,
          operator: previousData.operator ?? null,
          isActive: previousData.isActive ?? null,
        },
        after: {
          deleted: true,
        },
      });

      return json(200, {
        ok: true,
        stationId,
        deleted: true,
      });
    }

    if (!body.values) {
      return badRequest('values is required.');
    }

    const values = normalizeStationValues(body.values);

    if (action === 'create') {
      const docRef = await firestore.collection('charging_stations').add({
        ...values,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: profile.uid,
        updatedBy: profile.uid,
      });

      await writeAdminAuditLog({
        actor: buildAuditActor(profile),
        action: 'charging_station.updated',
        entityType: 'charging_station',
        entityId: docRef.id,
        summary: `Created charging station ${docRef.id}.`,
        after: values,
      });

      return json(200, {
        ok: true,
        stationId: docRef.id,
      });
    }

    const stationId = getRequiredString(body.stationId, 'stationId', 128);
    const stationRef = firestore.collection('charging_stations').doc(stationId);
    const snapshot = await stationRef.get();
    if (!snapshot.exists) {
      return json(404, { error: 'Charging station not found.' });
    }
    const previousData = (snapshot.data() ?? {}) as Record<string, unknown>;

    await stationRef.update({
      ...values,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: profile.uid,
    });

    await writeAdminAuditLog({
      actor: buildAuditActor(profile),
      action: 'charging_station.updated',
      entityType: 'charging_station',
      entityId: stationId,
      summary: `Updated charging station ${stationId}.`,
      before: {
        address: previousData.address ?? null,
        operator: previousData.operator ?? null,
        plugTypes: previousData.plugTypes ?? null,
        chargingSpeedKw: previousData.chargingSpeedKw ?? null,
        isActive: previousData.isActive ?? null,
      },
      after: values,
    });

    return json(200, {
      ok: true,
      stationId,
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
      return serviceUnavailable('Server-side charging-station moderation is not configured.');
    }
    if (
      message.includes('required') ||
      message.includes('must be one of') ||
      message.includes('valid number') ||
      message.includes('Boolean value is invalid') ||
      message.includes('values is required')
    ) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
