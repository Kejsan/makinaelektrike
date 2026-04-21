import {
  badRequest,
  internalError,
  methodNotAllowed,
  readErrorMessage,
  serviceUnavailable,
  upstreamError,
  withTimeout,
  json,
} from './_lib/http';
import type { FunctionEvent } from './_lib/http';
import { getRequiredEnvValue } from './_lib/env';
import {
  getOptionalBoundingBox,
  getOptionalIdList,
  getOptionalString,
} from './_lib/validation';

const BASE_URL = 'https://api.openchargemap.io/v3/poi';
const CLIENT_NAME = 'MakinaElektrike';
const TIMEOUT_MS = 15000;

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const apiKey = getRequiredEnvValue('OCM_API_KEY', 'VITE_OCM_API_KEY');
    const mode = getOptionalString(event.queryStringParameters?.mode, {
      field: 'mode',
      maxLength: 16,
    }) ?? 'country';
    const countryCode = getOptionalString(event.queryStringParameters?.countryCode, {
      field: 'countryCode',
      maxLength: 4,
    }) ?? 'AL';
    const boundingBox = getOptionalBoundingBox(event.queryStringParameters?.boundingBox);

    if (mode === 'bounds' && !boundingBox) {
      return badRequest('boundingBox is required when mode is "bounds".');
    }

    const query = new URLSearchParams({
      output: 'geojson',
      countrycode: countryCode,
      maxresults: '200',
      camelcase: 'true',
      client: CLIENT_NAME,
    });

    if (boundingBox) {
      query.set('boundingbox', boundingBox);
    }

    const filters: Array<[string, string | undefined]> = [
      ['operatorid', getOptionalIdList(event.queryStringParameters?.operators, 'operators')],
      ['connectiontypeid', getOptionalIdList(event.queryStringParameters?.connectionTypes, 'connectionTypes')],
      ['levelid', getOptionalIdList(event.queryStringParameters?.levels, 'levels')],
      ['usagetypeid', getOptionalIdList(event.queryStringParameters?.usageTypes, 'usageTypes')],
      ['statustypeid', getOptionalIdList(event.queryStringParameters?.statusTypes, 'statusTypes')],
    ];

    filters.forEach(([key, value]) => {
      if (value) {
        query.set(key, value);
      }
    });

    const response = await withTimeout(
      fetch(`${BASE_URL}?${query.toString()}`, {
        headers: {
          Accept: 'application/json',
          'X-API-Key': apiKey,
        },
      }),
      TIMEOUT_MS,
      'Open Charge Map request timed out.',
    );

    if (!response.ok) {
      const detail = await readErrorMessage(response);
      return upstreamError(`Failed to load charging locations: ${response.status} ${detail}`);
    }

    const payload = await response.json();
    return json(200, payload);
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing required environment variable')) {
      return serviceUnavailable('Open Charge Map is not configured on the server.');
    }
    if (
      message.includes('boundingBox') ||
      message.includes('numeric ids') ||
      message.includes('characters')
    ) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
