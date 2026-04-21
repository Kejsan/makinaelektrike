type Primitive = string | number | boolean;

interface FetchFunctionOptions<TBody> {
  method?: 'GET' | 'POST';
  query?: Record<string, Primitive | Primitive[] | undefined | null>;
  body?: TBody;
  signal?: AbortSignal;
}

const FUNCTION_BASE_PATH = '/.netlify/functions';

const buildFunctionUrl = (
  functionName: string,
  query?: Record<string, Primitive | Primitive[] | undefined | null>,
) => {
  const basePath = `${FUNCTION_BASE_PATH}/${functionName}`;
  const url = typeof window === 'undefined'
    ? new URL(basePath, 'http://localhost')
    : new URL(basePath, window.location.origin);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      if (Array.isArray(value)) {
        if (!value.length) {
          return;
        }
        url.searchParams.set(key, value.join(','));
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return typeof window === 'undefined'
    ? `${url.pathname}${url.search}`
    : `${url.pathname}${url.search}`;
};

export async function fetchFunctionJson<TResponse, TBody = unknown>(
  functionName: string,
  options: FetchFunctionOptions<TBody> = {},
): Promise<TResponse> {
  const method = options.method ?? 'GET';
  const response = await fetch(buildFunctionUrl(functionName, options.query), {
    method,
    headers: options.body
      ? {
          'Content-Type': 'application/json',
        }
      : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    let message = `${functionName} request failed: ${response.status}`;
    const rawText = await response.text();

    try {
      const payload = JSON.parse(rawText) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      if (rawText.trim()) {
        message = rawText.trim();
      }
    }

    throw new Error(message);
  }

  return response.json() as Promise<TResponse>;
}
