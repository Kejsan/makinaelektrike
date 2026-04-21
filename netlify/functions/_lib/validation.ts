interface StringOptions {
  field: string;
  maxLength: number;
  required?: boolean;
}

export const getOptionalString = (
  value: unknown,
  { field, maxLength, required = false }: StringOptions,
) => {
  if (typeof value !== 'string') {
    if (required) {
      throw new Error(`${field} is required.`);
    }
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    if (required) {
      throw new Error(`${field} is required.`);
    }
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
};

export const getRequiredString = (value: unknown, field: string, maxLength: number) => {
  const trimmed = getOptionalString(value, { field, maxLength, required: true });
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
};

export const getOptionalBoolean = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }

    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }

  throw new Error('Boolean value is invalid.');
};

export const getEnumValue = <T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  field: string,
) => {
  const trimmed = getRequiredString(value, field, 32) as T;
  if (!allowedValues.includes(trimmed)) {
    throw new Error(`${field} must be one of: ${allowedValues.join(', ')}.`);
  }
  return trimmed;
};

export const getOptionalIdList = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`${field} must be a comma-separated string.`);
  }

  const ids = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (!ids.length) {
    return undefined;
  }

  if (ids.some(id => !/^\d+$/.test(id))) {
    throw new Error(`${field} must contain numeric ids only.`);
  }

  return ids.join(',');
};

export const getOptionalBoundingBox = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error('boundingBox must be a comma-separated string.');
  }

  const parts = value.split(',').map(part => Number(part.trim()));
  if (parts.length !== 4 || parts.some(part => !Number.isFinite(part))) {
    throw new Error('boundingBox must contain four numeric coordinates.');
  }

  const [topLat, leftLng, bottomLat, rightLng] = parts;
  if (
    topLat < -90 ||
    topLat > 90 ||
    bottomLat < -90 ||
    bottomLat > 90 ||
    leftLng < -180 ||
    leftLng > 180 ||
    rightLng < -180 ||
    rightLng > 180
  ) {
    throw new Error('boundingBox coordinates are out of range.');
  }

  return `${topLat},${leftLng},${bottomLat},${rightLng}`;
};
