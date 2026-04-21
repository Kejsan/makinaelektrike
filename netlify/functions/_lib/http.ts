export interface FunctionEvent {
  httpMethod?: string;
  path?: string;
  rawUrl?: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
}

export interface FunctionResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export const json = (
  statusCode: number,
  payload: unknown,
  headers: Record<string, string> = {},
): FunctionResponse => ({
  statusCode,
  headers: {
    ...DEFAULT_HEADERS,
    ...headers,
  },
  body: JSON.stringify(payload),
});

export const badRequest = (error: string) => json(400, { error });

export const methodNotAllowed = (allowedMethods: string[]) =>
  json(
    405,
    { error: `Method not allowed. Use ${allowedMethods.join(', ')}.` },
    { Allow: allowedMethods.join(', ') },
  );

export const serviceUnavailable = (error: string) => json(503, { error });

export const upstreamError = (error: string, statusCode = 502) =>
  json(statusCode, { error });

export const internalError = (error = 'Internal server error.') => json(500, { error });

export const parseJsonBody = <T>(event: FunctionEvent): T => {
  if (!event.body) {
    return {} as T;
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  return JSON.parse(rawBody) as T;
};

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = 'Request timed out.',
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);

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

export const readErrorMessage = async (response: Response) => {
  try {
    const text = await response.text();
    return text.trim() || response.statusText;
  } catch {
    return response.statusText;
  }
};
