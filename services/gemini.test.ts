import { describe, expect, it, vi, beforeEach } from 'vitest';

// Use a simpler mock structure
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent
      }
    }))
  };
});

const mockEnv = (key: string, value: string) => {
  process.env[key] = value;
};

describe('gemini service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockEnv('GEMINI_API_KEY', 'test-key');
    mockEnv('VITE_ENABLE_GEMINI_PREFILL', 'true');
  });

  it('normalizes Gemini payloads into Model shape with AI source', async () => {
    const { normalizeGeminiModel } = await import('./gemini');

    const model = normalizeGeminiModel(
      {
        brand: 'Tesla',
        model_name: 'Model 3',
        battery_capacity: '82',
        range_wltp: '560',
        autocharge_supported: 'true',
        charging_ac: '11 kW',
      },
      'Tesla',
      'Model 3',
    );

    expect(model).toMatchObject({
      brand: 'Tesla',
      model_name: 'Model 3',
      battery_capacity: 82,
      range_wltp: 560,
      autocharge_supported: true,
      charging_ac: '11 kW',
      source: 'ai',
      isFeatured: false,
      imageGallery: [],
    });
  });

  it('strips markdown code blocks before parsing JSON', async () => {
    const markdownResponse = '```json\n{"brand": "BYD", "model_name": "SEALION 7"}\n```';
    // Success case: response.text() returns the markdown
    mockGenerateContent.mockResolvedValueOnce({ 
      response: { text: () => markdownResponse } 
    });

    const { enrichModelWithGemini } = await import('./gemini');
    const result = await enrichModelWithGemini('BYD', 'SEALION 7');

    expect(result).toMatchObject({
      brand: 'BYD',
      model_name: 'SEALION 7',
    });
  });

  it('throws a readable error when Gemini is enabled but the response cannot be parsed', async () => {
    // Error case: response.text() returns non-json
    mockGenerateContent.mockResolvedValueOnce({ 
      response: { text: () => 'not-json' } 
    });

    const { enrichModelWithGemini } = await import('./gemini');

    try {
      await enrichModelWithGemini('Test', 'Model');
      throw new Error('Should have thrown');
    } catch (e: any) {
      expect(e.message).toMatch(/parsing failed/i);
      expect(e.message).toMatch(/Raw text:/i);
    }
  });
});





