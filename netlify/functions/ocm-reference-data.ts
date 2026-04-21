import {
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

const BASE_URL = 'https://api.openchargemap.io/v3/referencedata';
const CLIENT_NAME = 'MakinaElektrike';
const TIMEOUT_MS = 12000;

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const apiKey = getRequiredEnvValue('OCM_API_KEY', 'VITE_OCM_API_KEY');
    const query = new URLSearchParams({
      client: CLIENT_NAME,
      camelcase: 'true',
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
      return upstreamError(`Failed to load Open Charge Map reference data: ${response.status} ${detail}`);
    }

    const payload = await response.json();
    return json(200, payload);
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing required environment variable')) {
      return serviceUnavailable('Open Charge Map is not configured on the server.');
    }
    return internalError(message);
  }
};
