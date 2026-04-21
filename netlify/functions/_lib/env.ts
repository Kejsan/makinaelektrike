export const getOptionalEnvValue = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
};

export const getRequiredEnvValue = (...keys: string[]) => {
  const value = getOptionalEnvValue(...keys);

  if (!value) {
    throw new Error(`Missing required environment variable: ${keys.join(' or ')}`);
  }

  return value;
};
