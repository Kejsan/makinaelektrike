type Primitive = string | number | boolean;

interface FetchFunctionOptions<TBody> {
  method?: 'GET' | 'POST';
  query?: Record<string, Primitive | Primitive[] | undefined | null>;
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const FUNCTION_BASE_PATH = '/.netlify/functions';

export class FunctionJsonResponseError extends Error {
  code:
    | 'FUNCTION_HTTP_ERROR'
    | 'FUNCTION_HTML_RESPONSE'
    | 'FUNCTION_INVALID_JSON'
    | 'FUNCTION_QUOTA_EXCEEDED';
  status: number;
  functionName: string;

  constructor(
    message: string,
    options: {
      code: FunctionJsonResponseError['code'];
      status: number;
      functionName: string;
    },
  ) {
    super(message);
    this.name = 'FunctionJsonResponseError';
    this.code = options.code;
    this.status = options.status;
    this.functionName = options.functionName;
  }
}

export const isFunctionHtmlResponseError = (error: unknown) =>
  error instanceof FunctionJsonResponseError && error.code === 'FUNCTION_HTML_RESPONSE';

export const isFunctionQuotaExceededError = (error: unknown) =>
  error instanceof FunctionJsonResponseError &&
  (error.code === 'FUNCTION_QUOTA_EXCEEDED' ||
    error.status === 429 ||
    /resource[_-]exhausted|quota exceeded/i.test(error.message));

const looksLikeHtmlDocument = (value: string) => /^<!doctype\s+html/i.test(value.trim()) || /^<html[\s>]/i.test(value.trim());

const isQuotaExceededPayload = (payload: { code?: unknown; error?: unknown }) => {
  const code = typeof payload.code === 'string' ? payload.code : '';
  const error = typeof payload.error === 'string' ? payload.error : '';
  return (
    code === 'FIRESTORE_QUOTA_EXHAUSTED' ||
    /resource[_-]exhausted|quota exceeded/i.test(error)
  );
};

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
    headers: {
      ...(options.body
        ? {
            'Content-Type': 'application/json',
          }
        : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const rawText = await response.text();
  const trimmedText = rawText.trim();

  if (!response.ok) {
    let message = `${functionName} request failed: ${response.status}`;
    let code: FunctionJsonResponseError['code'] = 'FUNCTION_HTTP_ERROR';

    try {
      const payload = JSON.parse(rawText) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
      if (isQuotaExceededPayload(payload)) {
        code = 'FUNCTION_QUOTA_EXCEEDED';
      }
    } catch {
      if (rawText.trim()) {
        message = rawText.trim();
      }
    }

    throw new FunctionJsonResponseError(message, {
      code,
      status: response.status,
      functionName,
    });
  }

  if (looksLikeHtmlDocument(trimmedText)) {
    throw new FunctionJsonResponseError(
      `${functionName} returned HTML instead of JSON. Netlify functions may not be running in this local preview.`,
      {
        code: 'FUNCTION_HTML_RESPONSE',
        status: response.status,
        functionName,
      },
    );
  }

  try {
    return JSON.parse(rawText) as TResponse;
  } catch {
    throw new FunctionJsonResponseError(
      `${functionName} returned invalid JSON.`,
      {
        code: 'FUNCTION_INVALID_JSON',
        status: response.status,
        functionName,
      },
    );
  }
}
