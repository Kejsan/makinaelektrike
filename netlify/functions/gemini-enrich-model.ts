import { GoogleGenAI } from '@google/genai';
import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  internalError,
  methodNotAllowed,
  serviceUnavailable,
  withTimeout,
  json,
} from './_lib/http';
import { getRequiredEnvValue } from './_lib/env';
import { getRequiredString } from './_lib/validation';
import {
  buildGeminiPrompt,
  extractGeminiText,
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  normalizeGeminiModel,
  stripMarkdown,
} from '../../services/geminiShared';

interface EnrichRequestBody {
  brand?: string;
  modelName?: string;
}

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const apiKey = getRequiredEnvValue(
      'GEMINI_API_KEY',
      'GEMINI_KEY',
      'VITE_GEMINI_API_KEY',
    );
    const body = event.body ? (JSON.parse(event.body) as EnrichRequestBody) : {};
    const brand = getRequiredString(body.brand, 'brand', 120);
    const modelName = getRequiredString(body.modelName, 'modelName', 120);
    const client = new GoogleGenAI({ apiKey });

    const apiResponse = await withTimeout(
      client.models.generateContent({
        model: GEMINI_MODEL.startsWith('models/') ? GEMINI_MODEL : `models/${GEMINI_MODEL}`,
        contents: [{ role: 'user', parts: [{ text: buildGeminiPrompt(brand, modelName) }] }],
        tools: [{ googleSearch: {} }],
      } as never),
      GEMINI_TIMEOUT_MS,
      'Gemini request timed out.',
    );

    const text = extractGeminiText(apiResponse);
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    const parsed = JSON.parse(stripMarkdown(text)) as Record<string, unknown>;
    return json(200, normalizeGeminiModel(parsed, brand, modelName));
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing required environment variable')) {
      return serviceUnavailable('Gemini enrichment is not configured on the server.');
    }
    if (
      message.includes('required') ||
      message.includes('characters') ||
      message.includes('Unexpected token') ||
      message.includes('Gemini returned an empty response')
    ) {
      return badRequest(
        message.includes('Unexpected token')
          ? `Gemini response parsing failed: ${message}`
          : message,
      );
    }
    return internalError(message);
  }
};
