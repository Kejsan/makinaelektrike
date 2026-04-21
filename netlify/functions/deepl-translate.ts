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
import { getEnumValue, getOptionalBoolean, getRequiredString } from './_lib/validation';

const TIMEOUT_MS = 20000;
const TARGET_LANGUAGES = ['EN-GB', 'EN-US', 'IT', 'SQ'] as const;

interface TranslateRequestBody {
  text?: string;
  targetLanguage?: string;
  isHtml?: boolean;
}

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const apiKey = getRequiredEnvValue('DEEPL_API_KEY', 'VITE_DEEPL_API_KEY');
    const body = event.body ? (JSON.parse(event.body) as TranslateRequestBody) : {};

    const text = getRequiredString(body.text, 'text', 50000);
    const targetLanguage = getEnumValue(body.targetLanguage, TARGET_LANGUAGES, 'targetLanguage');
    const isHtml = getOptionalBoolean(body.isHtml) ?? false;
    const endpoint = apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const response = await withTimeout(
      fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: [text],
          target_lang: targetLanguage,
          ...(isHtml ? { tag_handling: 'html' } : {}),
        }),
      }),
      TIMEOUT_MS,
      'DeepL request timed out.',
    );

    if (!response.ok) {
      const detail = await readErrorMessage(response);
      return upstreamError(`DeepL request failed: ${response.status} ${detail}`);
    }

    const payload = (await response.json()) as {
      translations?: Array<{ text?: string }>;
    };
    const translatedText = payload.translations?.[0]?.text;

    if (!translatedText) {
      return upstreamError('DeepL returned an empty translation.');
    }

    return json(200, { text: translatedText });
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing required environment variable')) {
      return serviceUnavailable('DeepL is not configured on the server.');
    }
    if (
      message.includes('required') ||
      message.includes('characters') ||
      message.includes('targetLanguage') ||
      message.includes('Boolean value')
    ) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
