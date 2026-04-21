import type { Model } from '../types';

export const GEMINI_MODEL = 'gemini-2.5-flash-lite';
export const GEMINI_CHAT_MODEL = 'gemini-2.5-flash';
export const GEMINI_TIMEOUT_MS = 12000;

const toModelId = (brand: string, modelName: string) =>
  `${brand}-${modelName}`
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) {
      return undefined;
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (['true', 'yes', 'y', '1'].includes(normalized)) {
      return true;
    }
    if (['false', 'no', 'n', '0'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
};

const cleanString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const stripMarkdown = (text: string): string =>
  text
    .replace(/^```[a-z]*\n([\s\S]*?)\n```$/i, '$1')
    .replace(/^```[a-z]*\s*([\s\S]*?)\s*```$/i, '$1')
    .trim();

export const buildGeminiPrompt = (brand: string, model: string) => `You are an EV data expert.
Use Google Search to confirm up-to-date values when needed.
Provide concise technical specifications for the electric vehicle ${brand} ${model}.
Respond with a SINGLE RAW JSON OBJECT using these keys only: brand, model_name, year_start, body_type, charge_port, charge_power, autocharge_supported, battery_capacity, battery_useable_capacity, battery_type, battery_voltage, range_wltp, power_kw, torque_nm,
acceleration_0_100, acceleration_0_60, top_speed, drive_type, seats, charging_ac, charging_dc, length_mm, width_mm, height_mm, wheelbase_mm, weight_kg, cargo_volume_l, notes.
If a value is unknown, omit that key entirely. Use numbers where appropriate. Do NOT wrap the JSON in markdown code blocks.`;

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

export const extractGeminiText = (apiResponse: unknown) => {
  let text = '';

  try {
    text =
      (apiResponse as { response?: { text?: () => string } }).response?.text?.() ??
      (apiResponse as { text?: () => string }).text?.() ??
      '';
  } catch {
    text = '';
  }

  if (text) {
    return text;
  }

  const structured = (apiResponse ?? {}) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    response?: {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
  };
  const candidateParts =
    structured.candidates ?? structured.response?.candidates ?? [];

  return candidateParts
    .flatMap(candidate => candidate.content?.parts ?? [])
    .map(part => part.text?.trim())
    .filter((value): value is string => Boolean(value))
    .join('\n')
    .trim();
};
