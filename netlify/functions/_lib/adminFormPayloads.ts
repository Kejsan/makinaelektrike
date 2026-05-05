import { getOptionalBoolean } from './validation';
import type { BlogPostFaq, BlogPostSection, BlogPostTranslation } from '../../../types';

type UnknownRecord = Record<string, unknown>;

const hasOwnProperty = Object.prototype.hasOwnProperty;

export const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const getRequiredRecord = (value: unknown, field: string): UnknownRecord => {
  if (!isRecord(value)) {
    throw new Error(`${field} must be an object.`);
  }

  return value;
};

export const hasOwnField = (record: UnknownRecord, field: string) =>
  hasOwnProperty.call(record, field);

interface StringFieldOptions {
  field: string;
  maxLength: number;
  allowNull?: boolean;
  allowEmpty?: boolean;
}

export const parseOptionalStringValue = (
  value: unknown,
  { field, maxLength, allowNull = false, allowEmpty = false }: StringFieldOptions,
) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    if (allowNull) {
      return null;
    }
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    if (allowEmpty) {
      return '';
    }
    if (allowNull) {
      return null;
    }
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
};

export const parseOptionalStringField = (
  record: UnknownRecord,
  field: string,
  maxLength: number,
  options: { allowNull?: boolean; allowEmpty?: boolean } = {},
) => {
  if (!hasOwnField(record, field)) {
    return undefined;
  }

  return parseOptionalStringValue(record[field], {
    field,
    maxLength,
    allowNull: options.allowNull,
    allowEmpty: options.allowEmpty,
  });
};

export const parseOptionalNumberField = (record: UnknownRecord, field: string) => {
  if (!hasOwnField(record, field)) {
    return undefined;
  }

  const value = record[field];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a valid number.`);
  }

  return parsed;
};

export const parseOptionalBooleanField = (record: UnknownRecord, field: string) => {
  if (!hasOwnField(record, field)) {
    return undefined;
  }

  return getOptionalBoolean(record[field]);
};

export const parseStringArrayField = (
  record: UnknownRecord,
  field: string,
  maxItems: number,
  maxItemLength: number,
) => {
  if (!hasOwnField(record, field)) {
    return undefined;
  }

  const value = record[field];
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }

  if (value.length > maxItems) {
    throw new Error(`${field} must contain ${maxItems} items or fewer.`);
  }

  return value.reduce<string[]>((acc, item, index) => {
    const parsed = parseOptionalStringValue(item, {
      field: `${field}[${index}]`,
      maxLength: maxItemLength,
    });
    if (parsed) {
      acc.push(parsed);
    }
    return acc;
  }, []);
};

export const parseSocialLinksField = (record: UnknownRecord, field: string) => {
  if (!hasOwnField(record, field)) {
    return undefined;
  }

  const value = record[field];
  if (!isRecord(value)) {
    throw new Error(`${field} must be an object.`);
  }

  const facebook = parseOptionalStringField(value, 'facebook', 500);
  const instagram = parseOptionalStringField(value, 'instagram', 500);
  const twitter = parseOptionalStringField(value, 'twitter', 500);
  const youtube = parseOptionalStringField(value, 'youtube', 500);

  const links = {
    ...(facebook ? { facebook } : {}),
    ...(instagram ? { instagram } : {}),
    ...(twitter ? { twitter } : {}),
    ...(youtube ? { youtube } : {}),
  };

  return Object.keys(links).length > 0 ? links : undefined;
};

const parseBlogFaqList = (value: unknown, field: string): BlogPostFaq[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }

  return value.reduce<BlogPostFaq[]>((acc, item, index) => {
    const faq = getRequiredRecord(item, `${field}[${index}]`);
    const question =
      parseOptionalStringField(faq, 'question', 1000, { allowEmpty: true }) ?? '';
    const answer =
      parseOptionalStringField(faq, 'answer', 5000, { allowEmpty: true }) ?? '';

    if (question || answer) {
      acc.push({ question, answer });
    }

    return acc;
  }, []);
};

const parseBlogSectionList = (value: unknown, field: string): BlogPostSection[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }

  return value.map((item, index) => {
    const section = getRequiredRecord(item, `${field}[${index}]`);
    const id =
      parseOptionalStringField(section, 'id', 128, { allowEmpty: true }) ?? '';
    const heading =
      parseOptionalStringField(section, 'heading', 300, { allowEmpty: true }) ?? '';
    const paragraphs = parseStringArrayField(section, 'paragraphs', 100, 5000) ?? [];
    const highlight =
      parseOptionalStringField(section, 'highlight', 2000) ?? undefined;

    let list: BlogPostSection['list'];
    if (hasOwnField(section, 'list')) {
      const listValue = section.list;
      if (listValue !== undefined && listValue !== null) {
        const listRecord = getRequiredRecord(listValue, `${field}[${index}].list`);
        const items = parseStringArrayField(listRecord, 'items', 100, 1000) ?? [];
        list = items.length > 0 ? { items } : undefined;
      }
    }

    return {
      id,
      heading,
      paragraphs,
      ...(highlight ? { highlight } : {}),
      ...(list ? { list } : {}),
    };
  });
};

const parseBlogTranslationRecord = (
  value: unknown,
  field: string,
): BlogPostTranslation => {
  const record = getRequiredRecord(value, field);

  return {
    title: parseOptionalStringField(record, 'title', 300, { allowEmpty: true }) ?? '',
    excerpt:
      parseOptionalStringField(record, 'excerpt', 5000, { allowEmpty: true }) ?? '',
    metaTitle:
      parseOptionalStringField(record, 'metaTitle', 300, { allowEmpty: true }) ?? '',
    metaDescription:
      parseOptionalStringField(record, 'metaDescription', 5000, {
        allowEmpty: true,
      }) ?? '',
    ...(parseOptionalStringField(record, 'focusKeyword', 300)
      ? { focusKeyword: parseOptionalStringField(record, 'focusKeyword', 300) }
      : {}),
    ...(parseOptionalStringField(record, 'canonicalUrl', 1000)
      ? { canonicalUrl: parseOptionalStringField(record, 'canonicalUrl', 1000) }
      : {}),
    ...(parseOptionalStringField(record, 'metaRobots', 100)
      ? { metaRobots: parseOptionalStringField(record, 'metaRobots', 100) }
      : {}),
    sections: hasOwnField(record, 'sections')
      ? parseBlogSectionList(record.sections, `${field}.sections`)
      : [],
    ...(hasOwnField(record, 'faqs') && record.faqs !== undefined
      ? { faqs: parseBlogFaqList(record.faqs, `${field}.faqs`) }
      : {}),
  };
};

export const parseBlogSectionsField = (record: UnknownRecord, field: string) => {
  if (!hasOwnField(record, field)) {
    return undefined;
  }

  return parseBlogSectionList(record[field], field);
};

export const parseBlogFaqsField = (record: UnknownRecord, field: string) => {
  if (!hasOwnField(record, field)) {
    return undefined;
  }

  return parseBlogFaqList(record[field], field);
};

export const parseBlogTranslationsField = (record: UnknownRecord, field: string) => {
  if (!hasOwnField(record, field)) {
    return undefined;
  }

  const value = record[field];
  const translations = getRequiredRecord(value, field);

  const parsed: Record<string, BlogPostTranslation> = {};

  if (hasOwnField(translations, 'en') && translations.en !== undefined && translations.en !== null) {
    parsed.en = parseBlogTranslationRecord(translations.en, `${field}.en`);
  }

  if (hasOwnField(translations, 'it') && translations.it !== undefined && translations.it !== null) {
    parsed.it = parseBlogTranslationRecord(translations.it, `${field}.it`);
  }

  return Object.keys(parsed).length > 0
    ? (parsed as { en?: BlogPostTranslation; it?: BlogPostTranslation })
    : undefined;
};
