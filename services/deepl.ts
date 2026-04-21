import { fetchFunctionJson } from './serverFunctions';

export type DeepLTargetLang = 'EN-GB' | 'EN-US' | 'IT' | 'SQ';

export async function translateText(
  text: string,
  targetLanguage: DeepLTargetLang,
  isHtml = false
): Promise<string> {
  if (!text || text.trim() === '') return text;

  const response = await fetchFunctionJson<{ text: string }, {
    text: string;
    targetLanguage: DeepLTargetLang;
    isHtml: boolean;
  }>('deepl-translate', {
    method: 'POST',
    body: {
      text,
      targetLanguage,
      isHtml,
    },
  });

  return response.text;
}
