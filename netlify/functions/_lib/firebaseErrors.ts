const readString = (value: unknown) => (typeof value === 'string' ? value : '');

export const isFirestoreQuotaError = (error: unknown) => {
  const candidate = error as {
    code?: unknown;
    details?: unknown;
    message?: unknown;
  };
  const code = readString(candidate?.code).toLowerCase();
  const details = readString(candidate?.details).toLowerCase();
  const message = readString(candidate?.message).toLowerCase();
  const combined = `${code} ${details} ${message}`;

  return (
    code === '8' ||
    code === 'resource-exhausted' ||
    combined.includes('resource_exhausted') ||
    combined.includes('resource-exhausted') ||
    combined.includes('quota exceeded')
  );
};
