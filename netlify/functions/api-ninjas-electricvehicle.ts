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
import { getOptionalString } from './_lib/validation';

const BASE_URL = 'https://api.api-ninjas.com/v1/electricvehicle';
const TIMEOUT_MS = 12000;

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const apiKey = getRequiredEnvValue('API_NINJAS_KEY', 'VITE_API_NINJAS_KEY');
    const make = getOptionalString(event.queryStringParameters?.make, {
      field: 'make',
      maxLength: 80,
    });
    const model = getOptionalString(event.queryStringParameters?.model, {
      field: 'model',
      maxLength: 80,
    });

    if (!make && !model) {
      return badRequest('Provide a manufacturer or model to search.');
    }

    const query = new URLSearchParams();
    if (make) {
      query.set('make', make);
    }
    if (model) {
      query.set('model', model);
    }

    const response = await withTimeout(
      fetch(`${BASE_URL}?${query.toString()}`, {
        headers: {
          Accept: 'application/json',
          'X-Api-Key': apiKey,
        },
      }),
      TIMEOUT_MS,
      'API Ninjas request timed out.',
    );

    if (!response.ok) {
      if (response.status === 429) {
        return upstreamError('API Ninjas rate limit exceeded. Please try again later.', 429);
      }

      const detail = await readErrorMessage(response);
      return upstreamError(`API Ninjas request failed: ${response.status} ${detail}`);
    }

    const payload = await response.json();
    return json(200, payload);
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing required environment variable')) {
      return serviceUnavailable('API Ninjas is not configured on the server.');
    }
    if (message.includes('required') || message.includes('characters')) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
