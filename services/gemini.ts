import type { Dealer, Model } from '../types';
import { fetchFunctionJson } from './serverFunctions';

export { normalizeGeminiModel } from './geminiShared';

const featureToggle = (import.meta.env.VITE_ENABLE_GEMINI_PREFILL ?? 'true')
  .toString()
  .toLowerCase();

export const isGeminiEnabled = featureToggle !== 'false';

export interface GeminiChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface GeminiChatResponse {
  text: string;
}

const summarizeModels = (models: Model[]) => {
  const limit = 60;
  const summary = models
    .slice(0, limit)
    .map(model => `${model.brand} ${model.model_name} (Type: ${model.body_type}, Range: ${model.range_wltp}km)`)
    .join(', ');

  if (models.length <= limit) {
    return summary;
  }

  return `${summary}, and ${models.length - limit} more models`;
};

const summarizeDealers = (dealers: Dealer[]) => {
  const limit = 40;
  const summary = dealers
    .slice(0, limit)
    .map(dealer => `${dealer.name} in ${dealer.city} (Brands: ${dealer.brands.join('/')})`)
    .join(', ');

  if (dealers.length <= limit) {
    return summary;
  }

  return `${summary}, and ${dealers.length - limit} more dealerships`;
};

export const enrichModelWithGemini = async (
  brand: string,
  modelName: string,
  signal?: AbortSignal,
): Promise<Model> => {
  if (!isGeminiEnabled) {
    throw new Error('Gemini enrichment is disabled.');
  }

  return fetchFunctionJson<Model, { brand: string; modelName: string }>('gemini-enrich-model', {
    method: 'POST',
    body: {
      brand,
      modelName,
    },
    signal,
  });
};

export const sendChatMessage = async (
  history: GeminiChatMessage[],
  message: string,
  context: {
    dealers: Dealer[];
    models: Model[];
  },
  signal?: AbortSignal,
) => {
  const response = await fetchFunctionJson<GeminiChatResponse, {
    history: GeminiChatMessage[];
    message: string;
    modelDataSummary: string;
    dealerDataSummary: string;
  }>('gemini-chat', {
    method: 'POST',
    body: {
      history,
      message,
      modelDataSummary: summarizeModels(context.models),
      dealerDataSummary: summarizeDealers(context.dealers),
    },
    signal,
  });

  return response.text;
};
