import type { Model } from '../types';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
export const GEMINI_TIMEOUT_MS = 12000;

const readEnvValue = (...keys: string[]): string | undefined => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as { env?: Record<string, string> }).env : undefined;
  for (const key of keys) {
    const value = (process.env[key] ?? metaEnv?.[key]) as string | undefined;
    if (value) return value;
  }
  return undefined;
};

const apiKey = (readEnvValue('VITE_GEMINI_API_KEY', 'GEMINI_API_KEY', 'GEMINI_KEY') ?? '').trim();
const featureToggle = (readEnvValue('VITE_ENABLE_GEMINI_PREFILL') ?? 'true').toString().toLowerCase();
const searchApiKey = readEnvValue('GOOGLE_SEARCH_API_KEY', 'VITE_GOOGLE_SEARCH_API_KEY');
const searchEngineId = readEnvValue('GOOGLE_SEARCH_ENGINE_ID', 'VITE_GOOGLE_SEARCH_ENGINE_ID');
export const isGeminiConfigured = Boolean(apiKey);
export const isGeminiEnabled = isGeminiConfigured && featureToggle !== 'false';

let cachedClient: InstanceType<(typeof import('@google/genai'))['GoogleGenAI']> | null = null;

const getClient = async () => {
  if (!isGeminiConfigured) {
    throw new Error('Gemini API key is not configured.');
  }
  if (!isGeminiEnabled) {
    throw new Error('Gemini enrichment is disabled.');
  }

  if (cachedClient) return cachedClient;

  const { GoogleGenAI } = (await import('@google/genai')) as typeof import('@google/genai');
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
};

const toModelId = (brand: string, modelName: string) =>
  `${brand}-${modelName}`
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  }
  return undefined;
};

const cleanString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const stripMarkdown = (text: string): string => {
  return text
    .replace(/^```[a-z]*\n([\s\S]*?)\n```$/i, '$1') // Full-block match with newline
    .replace(/^```[a-z]*\s*([\s\S]*?)\s*```$/i, '$1') // Single line or tight block
    .trim();
};

export const buildGeminiPrompt = (brand: string, model: string) => {
  return `You are an EV data expert.
Use Google Search to confirm up-to-date values when needed.
Provide concise technical specifications for the electric vehicle ${brand} ${model}.
Respond with a SINGLE RAW JSON OBJECT using these keys only: brand, model_name, year_start, body_type, charge_port, charge_power, autocharge_supported, battery_capacity, battery_useable_capacity, battery_type, battery_voltage, range_wltp, power_kw, torque_nm,
acceleration_0_100, acceleration_0_60, top_speed, drive_type, seats, charging_ac, charging_dc, length_mm, width_mm, height_mm, wheelbase_mm, weight_kg, cargo_volume_l, notes.
If a value is unknown, omit that key entirely. Use numbers where appropriate. Do NOT wrap the JSON in markdown code blocks.`;
};

export const normalizeGeminiModel = (
  payload: Partial<Record<keyof Model, unknown>>,
  fallbackBrand: string,
  fallbackModel: string,
): Model => {
  const brand = cleanString(payload.brand) ?? fallbackBrand;
  const modelName = cleanString(payload.model_name) ?? fallbackModel;
  const id = toModelId(brand || 'unknown', modelName || 'model');

  return {
    id,
    brand: brand || 'Unknown',
    model_name: modelName || 'Unknown',
    source: 'ai',
    year_start: parseNumber(payload.year_start),
    body_type: cleanString(payload.body_type),
    charge_port: cleanString(payload.charge_port),
    charge_power: parseNumber(payload.charge_power),
    autocharge_supported: parseBoolean(payload.autocharge_supported),
    battery_capacity: parseNumber(payload.battery_capacity),
    battery_useable_capacity: parseNumber(payload.battery_useable_capacity),
    battery_type: cleanString(payload.battery_type),
    battery_voltage: parseNumber(payload.battery_voltage),
    range_wltp: parseNumber(payload.range_wltp),
    power_kw: parseNumber(payload.power_kw),
    torque_nm: parseNumber(payload.torque_nm),
    acceleration_0_100: parseNumber(payload.acceleration_0_100),
    acceleration_0_60: parseNumber(payload.acceleration_0_60),
    top_speed: parseNumber(payload.top_speed),
    drive_type: cleanString(payload.drive_type),
    seats: parseNumber(payload.seats),
    charging_ac: cleanString(payload.charging_ac),
    charging_dc: cleanString(payload.charging_dc),
    length_mm: parseNumber(payload.length_mm),
    width_mm: parseNumber(payload.width_mm),
    height_mm: parseNumber(payload.height_mm),
    wheelbase_mm: parseNumber(payload.wheelbase_mm),
    weight_kg: parseNumber(payload.weight_kg),
    cargo_volume_l: parseNumber(payload.cargo_volume_l),
    notes: cleanString(payload.notes),
    isFeatured: false,
    imageGallery: [],
    image_url: undefined,
  } satisfies Model;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Gemini request timed out')), timeoutMs);
    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });

export const enrichModelWithGemini = async (
  brand: string,
  modelName: string,
  signal?: AbortSignal,
): Promise<Model> => {
  console.log('[Gemini] Starting enrichment for:', { brand, modelName });
  console.log('[Gemini] Config check:', {
    isConfigured: isGeminiConfigured,
    isEnabled: isGeminiEnabled,
    hasApiKey: Boolean(apiKey),
  });

  const client = await getClient();

  const prompt = buildGeminiPrompt(brand, modelName);
  console.log('[Gemini] Sending prompt...');
  
  const request = client.models.generateContent({
    model: GEMINI_MODEL.startsWith('models/') ? GEMINI_MODEL : `models/${GEMINI_MODEL}`,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    // Removed unsupported generationConfig from this level
    tools: [{ googleSearch: {} }],
  } as any); // Using any to bypass potential SDK version mismatch lints


  const abortPromise = signal
    ? new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Gemini request aborted')), { once: true });
      })
    : null;

  try {
    const apiResponse = await withTimeout(abortPromise ? Promise.race([request, abortPromise]) : request, GEMINI_TIMEOUT_MS);
    console.log('[Gemini] Response received');

    // Robust text extraction
    let text = '';
    try {
      // Try the helper method first as it's the safest
      text = (apiResponse as any).response?.text?.() || '';
      if (!text && (apiResponse as any).text) {
        text = (apiResponse as any).text();
      }
    } catch (e) {
      console.warn('[Gemini] response.text() failed, falling back to manual extraction');
    }

    if (!text) {
      const structured = (apiResponse as any) ?? {};
      const candidateParts = structured.candidates ?? structured.response?.candidates;
      const parts = candidateParts?.flatMap((candidate: any) => candidate.content?.parts ?? []) ?? [];
      text = parts
        .map((part: any) => part.text?.trim())
        .filter((value: any): value is string => Boolean(value))
        .join('\n')
        .trim();
    }

    console.log('[Gemini] Raw text response length:', text?.length);
    if (text) {
      console.log('[Gemini] First 100 chars of response:', text.substring(0, 100));
    }

    if (!text || !text.trim()) {
      throw new Error('Gemini returned an empty response.');
    }

    const cleanedText = stripMarkdown(text);

    try {
      const parsed = JSON.parse(cleanedText) as Partial<Record<keyof Model, unknown>>;
      console.log('[Gemini] Parsed JSON successfully:', parsed);
      return normalizeGeminiModel(parsed, brand, modelName);
    } catch (error) {
      console.error('[Gemini] JSON parse error:', error, 'Raw text:', text, 'Cleaned text:', cleanedText);
      throw new Error(`Gemini response parsing failed: ${(error as Error).message}\nRaw text: ${text.substring(0, 200)}...`);
    }
  } catch (error) {
    console.error('[Gemini] Request failed:', error);
    throw error;
  }
};



