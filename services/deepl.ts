export type DeepLTargetLang = 'EN-GB' | 'EN-US' | 'IT' | 'SQ';

export async function translateText(
  text: string,
  targetLanguage: DeepLTargetLang,
  isHtml = false
): Promise<string> {
  if (!text || text.trim() === '') return text;

  const apiKey = import.meta.env.VITE_DEEPL_API_KEY;
  if (!apiKey) {
    throw new Error('DeepL API key is missing. Please set VITE_DEEPL_API_KEY in your environment variables.');
  }

  const isFreeApi = apiKey.endsWith(':fx');
  const endpoint = isFreeApi
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  try {
    const body: Record<string, any> = {
      text: [text],
      target_lang: targetLanguage,
    };

    if (isHtml) {
      body.tag_handling = 'html';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`DeepL API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.translations[0].text;
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}
