import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('gemini service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes Gemini payloads into Model shape with AI source', async () => {
    const { normalizeGeminiModel } = await import('./geminiShared');

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

  it('posts enrichment requests to the server-side function', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'byd-sealion-7',
        brand: 'BYD',
        model_name: 'SEALION 7',
        source: 'ai',
        isFeatured: false,
        imageGallery: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { enrichModelWithGemini } = await import('./gemini');
    const result = await enrichModelWithGemini('BYD', 'SEALION 7');

    expect(result).toMatchObject({
      brand: 'BYD',
      model_name: 'SEALION 7',
      source: 'ai',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/.netlify/functions/gemini-enrich-model',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('surfaces function errors with readable messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: 'Gemini response parsing failed: Unexpected token',
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { enrichModelWithGemini } = await import('./gemini');

    await expect(enrichModelWithGemini('Test', 'Model')).rejects.toThrow(
      /parsing failed/i,
    );
  });
});
