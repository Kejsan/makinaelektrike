import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  internalError,
  json,
  methodNotAllowed,
  serviceUnavailable,
} from './_lib/http';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { resolvePublicPlacementZones } from './_lib/publicPlacements';

const parseZoneKeys = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0)
    .slice(0, 12);

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const zoneKeys = parseZoneKeys(event.queryStringParameters?.zones);
    if (!zoneKeys.length) {
      return badRequest('zones query parameter is required.');
    }

    const locale = event.queryStringParameters?.locale ?? null;
    const zones = await resolvePublicPlacementZones(getAdminFirestore(), zoneKeys, locale);

    return json(
      200,
      {
        ok: true,
        zones,
        resolvedAt: new Date().toISOString(),
      },
      {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300',
      },
    );
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Public placements are not configured.');
    }

    return internalError(message);
  }
};
