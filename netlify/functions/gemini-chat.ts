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
  extractGeminiText,
  GEMINI_CHAT_MODEL,
  GEMINI_TIMEOUT_MS,
} from '../../services/geminiShared';

interface ChatHistoryEntry {
  role?: 'user' | 'model';
  text?: string;
}

interface ChatRequestBody {
  message?: string;
  history?: ChatHistoryEntry[];
  modelDataSummary?: string;
  dealerDataSummary?: string;
}

const buildSystemInstruction = (modelDataSummary: string, dealerDataSummary: string) => `You are a helpful and friendly AI assistant for "Makina Elektrike", an online directory for electric vehicles in Albania.
Your goal is to help users find the right electric vehicle and dealership.
You have access to the following website data:
- AVAILABLE MODELS: ${modelDataSummary || 'No model summary provided.'}
- AVAILABLE DEALERSHIPS: ${dealerDataSummary || 'No dealer summary provided.'}
Use this information to answer questions about available cars, their specifications, and where to find them.
If a user asks a general question about EVs, answer it concisely and accurately.
Always communicate in the language of the user's latest message.
Use light markdown only when it improves readability.`;

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
    const body = event.body ? (JSON.parse(event.body) as ChatRequestBody) : {};
    const message = getRequiredString(body.message, 'message', 4000);
    const modelDataSummary = getRequiredString(
      body.modelDataSummary ?? 'No model summary provided.',
      'modelDataSummary',
      12000,
    );
    const dealerDataSummary = getRequiredString(
      body.dealerDataSummary ?? 'No dealer summary provided.',
      'dealerDataSummary',
      12000,
    );
    const history = Array.isArray(body.history) ? body.history : [];
    const client = new GoogleGenAI({ apiKey });
    const contents = history
      .filter(entry => (entry.role === 'user' || entry.role === 'model') && entry.text?.trim())
      .slice(-12)
      .map(entry => ({
        role: entry.role!,
        parts: [{ text: entry.text!.trim().slice(0, 4000) }],
      }));

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const apiResponse = await withTimeout(
      client.models.generateContent({
        model: GEMINI_CHAT_MODEL.startsWith('models/')
          ? GEMINI_CHAT_MODEL
          : `models/${GEMINI_CHAT_MODEL}`,
        config: {
          systemInstruction: buildSystemInstruction(modelDataSummary, dealerDataSummary),
        },
        contents,
      } as never),
      GEMINI_TIMEOUT_MS,
      'Gemini chat request timed out.',
    );

    const text = extractGeminiText(apiResponse);
    if (!text) {
      throw new Error('Gemini returned an empty chat response.');
    }

    return json(200, { text });
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing required environment variable')) {
      return serviceUnavailable('Gemini chat is not configured on the server.');
    }
    if (message.includes('required') || message.includes('characters')) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
