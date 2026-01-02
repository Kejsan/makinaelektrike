import React, { ChangeEvent, useContext, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataContext } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import type { DealerDocument, DealerStatus, Model, BlogPost } from '../../types';

export type BulkImportEntity = 'dealers' | 'models' | 'blog';

type GenericRecord = Record<string, unknown>;

type Mapping = Record<string, string>;

type ParsedRow = GenericRecord;

type RowResult = {
  index: number;
  data: GenericRecord;
  errors: string[];
};

type ValueType = 'string' | 'number' | 'boolean' | 'string[]' | 'json';

interface FieldDefinition {
  key: string;
  label: string;
  required?: boolean;
  type: ValueType;
  description?: string;
  validator?: (value: unknown) => string | null;
}

interface EntityConfig {
  key: BulkImportEntity;
  label: string;
  fields: FieldDefinition[];
  templateHeaders: string[];
  instructions: string[];
  buildPayload: (values: GenericRecord) => DealerDocument | Omit<Model, 'id'> | Omit<BlogPost, 'id'>;
}


const normalizeNullableString = (value: string | null | undefined): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

interface ImportProgress {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

interface BulkImportModalProps {
  entity: BulkImportEntity;
  onClose: () => void;
}

const dealerFields: FieldDefinition[] = [
  { key: 'name', label: 'Dealer name', required: true, type: 'string' },
  { key: 'companyName', label: 'Company name', type: 'string' },
  { key: 'contactName', label: 'Contact name', type: 'string' },
  { key: 'address', label: 'Address', required: true, type: 'string' },
  { key: 'city', label: 'City', required: true, type: 'string' },
  { key: 'lat', label: 'Latitude', required: true, type: 'number', description: 'Decimal degrees (e.g. 41.3275)' },
  { key: 'lng', label: 'Longitude', required: true, type: 'number', description: 'Decimal degrees (e.g. 19.8189)' },
  { key: 'phone', label: 'Phone', type: 'string' },
  { key: 'email', label: 'Email', type: 'string' },
  { key: 'contact_phone', label: 'Contact phone', type: 'string' },
  { key: 'contact_email', label: 'Contact email', type: 'string' },
  { key: 'website', label: 'Website', type: 'string' },
  { key: 'social_links', label: 'Social links (JSON)', type: 'json', description: 'JSON object with facebook/instagram/twitter/youtube keys' },
  { key: 'brands', label: 'Brands', required: true, type: 'string[]', description: 'Comma separated list' },
  { key: 'languages', label: 'Languages', required: true, type: 'string[]', description: 'Comma separated list' },
  { key: 'notes', label: 'Notes', type: 'string' },
  { key: 'description', label: 'Description', type: 'string' },
  { key: 'typeOfCars', label: 'Type of cars', required: true, type: 'string' },
  { key: 'priceRange', label: 'Price range', type: 'string' },
  { key: 'modelsAvailable', label: 'Models available', required: true, type: 'string[]', description: 'Comma separated list' },
  { key: 'image_url', label: 'Image URL', type: 'string' },
  { key: 'logo_url', label: 'Logo URL', type: 'string' },
  { key: 'isFeatured', label: 'Is featured', type: 'boolean', description: 'Accepted values: true/false, yes/no, 1/0' },
  { key: 'imageGallery', label: 'Image gallery', type: 'string[]', description: 'Comma separated list of URLs' },
  { key: 'location', label: 'Location', type: 'string', description: 'Optional display string combining address and city' },
  { key: 'ownerUid', label: 'Owner UID', type: 'string', description: 'Optional UID of the dealer owner' },
  { key: 'createdBy', label: 'Created by UID', type: 'string' },
  { key: 'updatedBy', label: 'Updated by UID', type: 'string' },
  { key: 'approved', label: 'Approved', type: 'boolean', description: 'true/false' },
  { key: 'approvedAt', label: 'Approved at (timestamp)', type: 'string', description: 'ISO timestamp' },
  { key: 'rejectedAt', label: 'Rejected at (timestamp)', type: 'string', description: 'ISO timestamp' },
  { key: 'rejectionReason', label: 'Rejection reason', type: 'string' },
  { key: 'status', label: 'Status', type: 'string', description: "Accepted values: pending, approved, rejected" },
  { key: 'isActive', label: 'Is active', type: 'boolean', description: 'true/false' },
  { key: 'isDeleted', label: 'Is deleted', type: 'boolean', description: 'true/false' },
  { key: 'deletedAt', label: 'Deleted at (timestamp)', type: 'string', description: 'ISO timestamp' },
];

const modelFields: FieldDefinition[] = [
  { key: 'brand', label: 'Brand', required: true, type: 'string' },
  { key: 'model_name', label: 'Model name', required: true, type: 'string' },
  { key: 'year_start', label: 'Production start year', type: 'number' },
  { key: 'body_type', label: 'Body type', type: 'string' },
  { key: 'battery_capacity', label: 'Battery capacity (kWh)', type: 'number' },
  { key: 'battery_useable_capacity', label: 'Usable battery capacity (kWh)', type: 'number' },
  { key: 'battery_type', label: 'Battery type', type: 'string' },
  { key: 'battery_voltage', label: 'Battery voltage', type: 'number' },
  { key: 'range_wltp', label: 'Range WLTP (km)', type: 'number' },
  { key: 'power_kw', label: 'Power (kW)', type: 'number' },
  { key: 'torque_nm', label: 'Torque (Nm)', type: 'number' },
  { key: 'acceleration_0_100', label: '0-100 km/h (s)', type: 'number' },
  { key: 'top_speed', label: 'Top speed (km/h)', type: 'number' },
  { key: 'drive_type', label: 'Drive type', type: 'string' },
  { key: 'seats', label: 'Seats', type: 'number' },
  { key: 'charging_ac', label: 'Charging AC', type: 'string' },
  { key: 'charging_dc', label: 'Charging DC', type: 'string' },
  { key: 'notes', label: 'Notes', type: 'string' },
  { key: 'image_url', label: 'Image URL', type: 'string' },
  { key: 'isFeatured', label: 'Is featured', type: 'boolean', description: 'Accepted values: true/false, yes/no, 1/0' },
];

const blogFields: FieldDefinition[] = [
  { key: 'slug', label: 'Slug', required: true, type: 'string' },
  { key: 'title', label: 'Title', required: true, type: 'string' },
  { key: 'excerpt', label: 'Excerpt', required: true, type: 'string' },
  { key: 'author', label: 'Author', required: true, type: 'string' },
  { key: 'date', label: 'Date', required: true, type: 'string', description: 'ISO date (e.g. 2024-01-31)' },
  { key: 'readTime', label: 'Read time', required: true, type: 'string', description: 'Human readable (e.g. 5 min read)' },
  { key: 'imageUrl', label: 'Image URL', required: true, type: 'string' },
  { key: 'metaTitle', label: 'Meta title', required: true, type: 'string' },
  { key: 'metaDescription', label: 'Meta description', required: true, type: 'string' },
  { key: 'tags', label: 'Tags', required: true, type: 'string[]', description: 'Comma separated list' },
  {
    key: 'sections',
    label: 'Sections (JSON)',
    required: true,
    type: 'json',
    description: 'JSON array of { id, heading, paragraphs } objects',
    validator: value => {
      if (!Array.isArray(value)) {
        return 'Sections must be provided as a JSON array';
      }
      return null;
    },
  },
  {
    key: 'faqs',
    label: 'FAQs (JSON)',
    type: 'json',
    description: 'Optional JSON array of { question, answer } objects',
    validator: value => {
      if (value === undefined || value === null || Array.isArray(value)) {
        return null;
      }
      return 'FAQs must be a JSON array when provided';
    },
  },
  {
    key: 'cta',
    label: 'CTA (JSON)',
    type: 'json',
    description: 'Optional JSON object with { text, url }',
    validator: value => {
      if (value === undefined || value === null || typeof value === 'object') {
        return null;
      }
      return 'CTA must be a JSON object when provided';
    },
  },
  { key: 'ownerUid', label: 'Owner UID', type: 'string' },
  { key: 'createdBy', label: 'Created by UID', type: 'string' },
  { key: 'updatedBy', label: 'Updated by UID', type: 'string' },
  { key: 'published', label: 'Published', type: 'boolean', description: 'true/false' },
  { key: 'publishedAt', label: 'Published at (timestamp)', type: 'string', description: 'ISO timestamp' },
];

const dealerConfigBase = {
  key: 'dealers' as const,
  label: 'Dealers',
  fields: dealerFields,
  templateHeaders: dealerFields.map(field => field.key),
  instructions: [
    'Use comma separated lists for brands, languages, modelsAvailable, and imageGallery columns.',
    'Provide latitude and longitude in decimal degrees (for example 41.3275, 19.8189).',
    'The social_links column accepts a JSON object with facebook/instagram/twitter/youtube keys (optional).',
  ],
};

const modelConfigBase = {
  key: 'models' as const,
  label: 'Models',
  fields: modelFields,
  templateHeaders: modelFields.map(field => field.key),
  instructions: [
    'Leave numeric cells empty if a specification is unknown (battery_capacity, range_wltp, etc.).',
    'isFeatured accepts true/false values (also yes/no or 1/0).',
  ],
};

const blogConfigBase = {
  key: 'blog' as const,
  label: 'Blog posts',
  fields: blogFields,
  templateHeaders: blogFields.map(field => field.key),
  instructions: [
    'tags should be provided as a comma separated list (e.g. EV,Charging,Incentives).',
    'sections must be a JSON array of section objects ({ id, heading, paragraphs }).',
    'faqs should be provided as a JSON array of { question, answer } objects when included.',
    'cta should be a JSON object with text and url fields when included.',
  ],
};

const isEmptyValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  return false;
};

const normaliseKey = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

const buildDefaultMapping = (headers: string[], fields: FieldDefinition[]): Mapping => {
  const mapping: Mapping = {};
  const usedHeaders = new Set<string>();

  fields.forEach(field => {
    const targetKey = normaliseKey(field.key);
    const match = headers.find(header => !usedHeaders.has(header) && normaliseKey(header) === targetKey);
    if (match) {
      mapping[field.key] = match;
      usedHeaders.add(match);
    }
  });

  return mapping;
};

const convertValue = (rawValue: unknown, field: FieldDefinition, t: (key: string, options?: any) => string) => {
  if (rawValue === null || rawValue === undefined) {
    return undefined;
  }

  if (field.type === 'string') {
    return String(rawValue).trim();
  }

  if (field.type === 'number') {
    const text = String(rawValue).trim();
    if (text === '') {
      return undefined;
    }
    const num = parseFloat(text);
    if (Number.isNaN(num)) {
      throw new Error(t('admin.bulkImport.errorExpectedNumber', { defaultValue: 'Expected a numeric value' }));
    }
    return num;
  }

  if (field.type === 'boolean') {
    const text = String(rawValue).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(text)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(text)) {
      return false;
    }
    throw new Error(t('admin.bulkImport.errorExpectedBoolean', { defaultValue: 'Expected a boolean (true/false, yes/no, 1/0)' }));
  }

  if (field.type === 'string[]') {
    if (Array.isArray(rawValue)) {
      return rawValue.map(item => String(item).trim()).filter(item => item.length > 0);
    }
    const text = String(rawValue);
    const parts = text
      .split(/[,;|]/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
    return parts;
  }

  if (field.type === 'json') {
    const text = String(rawValue).trim();
    if (!text) {
      return undefined;
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(
        t('admin.bulkImport.errorInvalidJson', {
          defaultValue: 'Invalid JSON: {{message}}',
          message: (error as Error).message,
        }),
      );
    }
  }

  return rawValue;
};

const mapRowToData = (
  row: ParsedRow,
  mapping: Mapping,
  fields: FieldDefinition[],
  t: (key: string, options?: any) => string,
): RowResult => {
  const data: GenericRecord = {};
  const errors: string[] = [];

  fields.forEach(field => {
    const columnName = mapping[field.key];

    if (!columnName) {
      if (field.required) {
        errors.push(`${field.label}: no column selected`);
      }
      return;
    }

    const rawValue = row[columnName];

    if (isEmptyValue(rawValue)) {
      if (field.required) {
        errors.push(`${field.label} is required`);
      }
      return;
    }

    try {
      const converted = convertValue(rawValue, field, t);
      if (field.validator) {
        const validationError = field.validator(converted);
        if (validationError) {
          errors.push(`${field.label}: ${validationError}`);
          return;
        }
      }
      if (converted !== undefined) {
        data[field.key] = converted;
      }
    } catch (error) {
      errors.push(`${field.label}: ${(error as Error).message}`);
    }
  });

  return { index: 0, data, errors };
};

const parseCsvFile = async (file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> =>
  new Promise((resolve, reject) => {
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        if (results.errors?.length) {
          reject(new Error(results.errors[0]?.message ?? 'Unable to parse CSV file'));
          return;
        }
        const headers = results.meta.fields ?? [];
        const rows = (results.data ?? []).filter(record =>
          Object.values(record).some(value => !isEmptyValue(value))
        );
        resolve({ headers, rows });
      },
      error: error => reject(error),
    });
  });

const parseSpreadsheetFile = async (file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const sheetRows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
    header: 1,
    defval: '',
  });

  if (!sheetRows.length) {
    return { headers: [], rows: [] };
  }

  const [headerRow, ...bodyRows] = sheetRows;
  const headers = (headerRow ?? [])
    .map(cell => String(cell ?? '').trim())
    .filter(cell => cell.length > 0);

  const rows = bodyRows
    .map(rowValues => {
      const record: ParsedRow = {};
      headers.forEach((header, index) => {
        record[header] = rowValues[index];
      });
      return record;
    })
    .filter(record => Object.values(record).some(value => !isEmptyValue(value)));

  return { headers, rows };
};

const BulkImportModal: React.FC<BulkImportModalProps> = ({ entity, onClose }) => {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const { dealers, addDealer, addModel, addBlogPost } = useContext(DataContext);
  const { addToast } = useToast();

  const userUid = user?.uid ?? null;

  const activeDealer = useMemo(() => {
    if (!userUid || role !== 'dealer') {
      return null;
    }

    return (
      dealers.find(entry => entry.ownerUid === userUid || entry.id === userUid) ?? null
    );
  }, [dealers, role, userUid]);

  const entityConfigs = useMemo<Record<BulkImportEntity, EntityConfig>>(() => {
    const buildDealerPayload: EntityConfig['buildPayload'] = values => {
      const input = values as Partial<DealerDocument>;

      const status = (input.status as DealerDocument['status']) ?? (input.approved ? 'approved' : 'pending');
      const payload: DealerDocument = {
        name: input.name ?? '',
        companyName: input.companyName ?? null,
        contactName: input.contactName ?? null,
        address: input.address ?? '',
        city: input.city ?? '',
        lat: Number(input.lat ?? 0),
        lng: Number(input.lng ?? 0),
        phone: input.phone ?? null,
        email: input.email ?? null,
        contact_phone: (input.contact_phone as string | null | undefined) ?? null,
        contact_email: (input.contact_email as string | null | undefined) ?? null,
        website: input.website ?? null,
        social_links: (input.social_links as DealerDocument['social_links']) ?? null,
        brands: (input.brands as string[]) ?? [],
        languages: (input.languages as string[]) ?? [],
        notes: input.notes ?? null,
        description: input.description ?? null,
        typeOfCars: input.typeOfCars ?? '',
        priceRange: input.priceRange ?? null,
        modelsAvailable: (input.modelsAvailable as string[]) ?? [],
        image_url: input.image_url ?? null,
        logo_url: input.logo_url ?? input.image_url ?? null,
        isFeatured: input.isFeatured ?? false,
        imageGallery: (input.imageGallery as string[]) ?? [],
        location:
          (input.location as string | null | undefined) ??
          ([input.address, input.city].filter(Boolean).join(', ') || null),
        approved: (input.approved as boolean | undefined) ?? false,
        approvedAt: (input.approvedAt ?? null) as DealerDocument['approvedAt'],
        rejectedAt: (input.rejectedAt ?? null) as DealerDocument['rejectedAt'],
        rejectionReason: (input.rejectionReason as string | null | undefined) ?? null,
        ownerUid: (input.ownerUid as string | null | undefined) ?? null,
        createdBy: (input.createdBy as string | null | undefined) ?? null,
        updatedBy: (input.updatedBy as string | null | undefined) ?? null,
        createdAt: (input.createdAt ?? null) as DealerDocument['createdAt'],
        updatedAt: (input.updatedAt ?? null) as DealerDocument['updatedAt'],
        status: (input.status as DealerStatus | undefined) ?? (input.approved ? 'approved' : 'pending'),
        isActive: input.isActive ?? true,
        isDeleted: input.isDeleted ?? false,
        deletedAt: (input.deletedAt ?? null) as DealerDocument['deletedAt'],
      };

      const actorUid = normalizeNullableString(userUid);

      if (role === 'dealer' && userUid && !payload.ownerUid) {
        payload.ownerUid = userUid;
      }

      if (actorUid) {
        if (!payload.createdBy) {
          payload.createdBy = actorUid;
        }
        if (!payload.updatedBy) {
          payload.updatedBy = actorUid;
        }
      }

      return payload;
    };

    const buildModelPayload: EntityConfig['buildPayload'] = values => {
      const input = values as Partial<Omit<Model, 'id'>>;

      const payload: Omit<Model, 'id'> = {
        brand: input.brand ?? '',
        model_name: input.model_name ?? '',
        year_start: (input.year_start as number) ?? null,
        body_type: input.body_type ?? null,
        battery_capacity: (input.battery_capacity as number) ?? null,
        battery_useable_capacity: (input.battery_useable_capacity as number) ?? null,
        battery_type: input.battery_type ?? null,
        battery_voltage: (input.battery_voltage as number) ?? null,
        range_wltp: (input.range_wltp as number) ?? null,
        power_kw: (input.power_kw as number) ?? null,
        torque_nm: (input.torque_nm as number) ?? null,
        acceleration_0_100: (input.acceleration_0_100 as number) ?? null,
        top_speed: (input.top_speed as number) ?? null,
        drive_type: input.drive_type ?? null,
        seats: (input.seats as number) ?? null,
        charging_ac: input.charging_ac ?? null,
        charging_dc: input.charging_dc ?? null,
        notes: input.notes ?? null,
        image_url: input.image_url ?? null,
        isFeatured: input.isFeatured ?? false,
        ownerDealerId: (input.ownerDealerId as string | null | undefined) ?? null,
        ownerUid: (input.ownerUid as string | null | undefined) ?? null,
        createdBy: (input.createdBy as string | null | undefined) ?? null,
        updatedBy: (input.updatedBy as string | null | undefined) ?? null,
        createdAt: (input.createdAt ?? null) as Model['createdAt'],
        updatedAt: (input.updatedAt ?? null) as Model['updatedAt'],
      };

      const actorUid = normalizeNullableString(userUid);

      if (role === 'dealer' && activeDealer) {
        if (!payload.ownerDealerId) {
          payload.ownerDealerId = activeDealer.id;
        }

        const ownershipUid = actorUid ?? normalizeNullableString(activeDealer.ownerUid);
        if (ownershipUid) {
          if (!payload.ownerUid) {
            payload.ownerUid = ownershipUid;
          }
          if (!payload.createdBy) {
            payload.createdBy = ownershipUid;
          }
          if (!payload.updatedBy) {
            payload.updatedBy = ownershipUid;
          }
        }
      } else if (actorUid) {
        if (!payload.ownerUid) {
          payload.ownerUid = actorUid;
        }
      }

      if (actorUid) {
        if (!payload.createdBy) {
          payload.createdBy = actorUid;
        }
        if (!payload.updatedBy) {
          payload.updatedBy = actorUid;
        }
      }

      return payload;
    };

    const buildBlogPayload: EntityConfig['buildPayload'] = values => {
      const input = values as Partial<Omit<BlogPost, 'id'>>;
      const ownership = {
        ownerUid: normalizeNullableString(input.ownerUid as string | null | undefined),
        createdBy: normalizeNullableString(input.createdBy as string | null | undefined),
        updatedBy: normalizeNullableString(input.updatedBy as string | null | undefined),
        published: input.published,
        publishedAt: (input.publishedAt ?? null) as BlogPost['publishedAt'],
      };

      const payload = {
        slug: input.slug ?? '',
        title: input.title ?? '',
        excerpt: input.excerpt ?? '',
        author: input.author ?? '',
        date: input.date ?? '',
        readTime: input.readTime ?? '',
        imageUrl: input.imageUrl ?? '',
        metaTitle: input.metaTitle ?? '',
        metaDescription: input.metaDescription ?? '',
        tags: (input.tags as string[]) ?? [],
        sections: (input.sections as BlogPost['sections']) ?? [],
        faqs: input.faqs ?? [],
        cta: input.cta ?? null,
        ...ownership,
      } as Omit<BlogPost, 'id'>;

      const actorUid = normalizeNullableString(userUid);

      if (actorUid) {
        if (payload.ownerUid === undefined) {
          payload.ownerUid = actorUid;
        }
        if (payload.createdBy === undefined) {
          payload.createdBy = actorUid;
        }
        if (payload.updatedBy === undefined) {
          payload.updatedBy = actorUid;
        }
      }

      if (payload.published === undefined) {
        payload.published = true;
      }

      return payload;
    };

    return {
      dealers: { ...dealerConfigBase, buildPayload: buildDealerPayload },
      models: { ...modelConfigBase, buildPayload: buildModelPayload },
      blog: { ...blogConfigBase, buildPayload: buildBlogPayload },
    };
  }, [activeDealer, role, userUid]);

  const config = entityConfigs[entity];

  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({ processed: 0, succeeded: 0, failed: 0, skipped: 0 });
  const [summary, setSummary] = useState<ImportProgress | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const rowResults = useMemo(() => {
    return rows.map((row, index) => {
      const result = mapRowToData(row, mapping, config.fields, t);
      return { ...result, index };
    });
  }, [rows, mapping, config.fields]);

  const validRows = useMemo(
    () => rowResults.filter(result => result.errors.length === 0 && Object.keys(result.data).length > 0),
    [rowResults]
  );

  const invalidRows = useMemo(
    () => rowResults.filter(result => result.errors.length > 0),
    [rowResults]
  );

  const requiredFieldsMapped = useMemo(
    () => config.fields.filter(field => field.required).every(field => mapping[field.key]),
    [config.fields, mapping]
  );

  const resetState = () => {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setFileName(null);
    setFileError(null);
    setProgress({ processed: 0, succeeded: 0, failed: 0, skipped: 0 });
    setSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFileError(null);
    setSummary(null);
    setProgress({ processed: 0, succeeded: 0, failed: 0, skipped: 0 });

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let parsed: { headers: string[]; rows: ParsedRow[] } = { headers: [], rows: [] };

      if (extension === 'csv') {
        parsed = await parseCsvFile(file);
      } else if (extension === 'xlsx' || extension === 'xls') {
        parsed = await parseSpreadsheetFile(file);
      } else {
        throw new Error(t('admin.bulkImport.errorUnsupportedType', { defaultValue: 'Unsupported file type. Please upload a CSV or Excel file.' }));
      }

      if (!parsed.headers.length) {
        throw new Error(t('admin.bulkImport.errorNoHeaders', { defaultValue: 'No headers were detected in the file. Please include a header row.' }));
      }

      if (!parsed.rows.length) {
        throw new Error(t('admin.bulkImport.errorNoRows', { defaultValue: 'No data rows were found after parsing the file.' }));
      }

      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(buildDefaultMapping(parsed.headers, config.fields));
      setFileName(file.name);
    } catch (error) {
      console.error(error);
      setFileError((error as Error).message);
      setHeaders([]);
      setRows([]);
      setMapping({});
      setFileName(null);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleMappingChange = (fieldKey: string, value: string) => {
    setMapping(prev => {
      const next = { ...prev };
      if (!value) {
        delete next[fieldKey];
      } else {
        next[fieldKey] = value;
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (!rows.length || !requiredFieldsMapped) {
      addToast(t('admin.bulkImport.missingMapping', { defaultValue: 'Please map all required columns before importing.' }), 'error');
      return;
    }

    if (validRows.length === 0) {
      addToast(t('admin.bulkImport.noValidRows', { defaultValue: 'No valid rows to import.' }), 'error');
      return;
    }

    if (entity === 'models' && role === 'dealer' && !activeDealer) {
      addToast(
        t('admin.bulkImport.dealerProfileMissing', {
          defaultValue: 'Your dealer profile must be loaded before importing models.',
        }),
        'error'
      );
      return;
    }

    const action = entity === 'dealers' ? addDealer : entity === 'models' ? addModel : addBlogPost;

    setImporting(true);
    setSummary(null);
    setProgress({ processed: 0, succeeded: 0, failed: 0, skipped: invalidRows.length });

    addToast(
      t('admin.bulkImport.starting', {
        defaultValue: 'Starting import of {{count}} {{entity}}',
        count: validRows.length,
        entity: config.label.toLowerCase(),
      }),
      'info'
    );

    let succeeded = 0;
    let failed = 0;

    for (const result of validRows) {
      const payload = config.buildPayload(result.data);

      try {
        await action(payload as never);
        succeeded += 1;
      } catch (error) {
        failed += 1;
        const message = (error as Error).message ?? 'Unknown error';
        addToast(
          t('admin.bulkImport.rowFailed', {
            defaultValue: 'Row {{index}} failed: {{message}}',
            index: result.index + 2,
            message,
          }),
          'error'
        );
      } finally {
        setProgress(prev => ({
          processed: prev.processed + 1,
          succeeded,
          failed,
          skipped: invalidRows.length,
        }));
      }
    }

    setSummary({
      processed: validRows.length,
      succeeded,
      failed,
      skipped: invalidRows.length,
    });

    if (succeeded > 0 && failed === 0) {
      addToast(
        t('admin.bulkImport.success', {
          defaultValue: 'Successfully imported {{count}} {{entity}}.',
          count: succeeded,
          entity: config.label.toLowerCase(),
        }),
        'success'
      );
    } else if (succeeded > 0) {
      addToast(
        t('admin.bulkImport.partial', {
          defaultValue: 'Imported {{success}} {{entity}} with {{failed}} failures.',
          success: succeeded,
          failed,
          entity: config.label.toLowerCase(),
        }),
        'info'
      );
    } else {
      addToast(
        t('admin.bulkImport.failed', {
          defaultValue: 'Import failed. Please review the errors and try again.',
        }),
        'error'
      );
    }

    setImporting(false);
  };

  const selectedFields = useMemo(
    () => config.fields.filter(field => mapping[field.key]),
    [config.fields, mapping]
  );

  const previewRows = useMemo(() => validRows.slice(0, 5), [validRows]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-200">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-gray-cyan" />
          <div>
            <h3 className="text-base font-semibold text-white">
              {t('admin.bulkImport.templateTitle', { defaultValue: 'Template headers' })}
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              {t('admin.bulkImport.templateDescription', {
                defaultValue: 'Prepare a spreadsheet with the following column headers before uploading.',
              })}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {config.fields.map(field => (
            <div key={field.key} className="rounded-lg border border-white/10 bg-gray-900/40 p-3">
              <p className="text-sm font-semibold text-white">
                <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-gray-200">{field.key}</code>
                {field.required && <span className="ml-2 rounded-full bg-red-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-100">{t('admin.required', { defaultValue: 'Required' })}</span>}
              </p>
              <p className="mt-1 text-xs text-gray-300">{field.label}</p>
              {field.description && <p className="mt-1 text-[11px] text-gray-400">{field.description}</p>}
            </div>
          ))}
        </div>
        {config.instructions.length > 0 && (
          <div className="mt-4 rounded-lg border border-white/10 bg-gray-900/40 p-3 text-xs text-gray-300">
            <p className="font-semibold text-white">{t('admin.bulkImport.instructions', { defaultValue: 'Formatting tips' })}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {config.instructions.map((instruction, index) => (
                <li key={index}>{instruction}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-gray-200">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-white" htmlFor="bulk-upload-input">
            {t('admin.bulkImport.selectFile', { defaultValue: 'Select CSV or Excel file' })}
          </label>
          <input
            ref={fileInputRef}
            id="bulk-upload-input"
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleFileChange}
            className="block w-full cursor-pointer rounded-lg border border-white/10 bg-gray-900/60 px-4 py-2 text-sm text-gray-200 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-cyan file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
          {fileName && (
            <p className="text-xs text-gray-400">
              {t('admin.bulkImport.selectedFile', { defaultValue: 'Loaded file' })}: <span className="font-medium text-white">{fileName}</span>
            </p>
          )}
          {fileError && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{fileError}</span>
            </div>
          )}
        </div>

        {headers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">
                {t('admin.bulkImport.mappingTitle', { defaultValue: 'Map columns to fields' })}
              </h3>
              <button
                type="button"
                onClick={resetState}
                className="text-xs font-semibold uppercase tracking-wide text-gray-400 transition hover:text-white"
              >
                {t('admin.bulkImport.reset', { defaultValue: 'Reset' })}
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {config.fields.map(field => (
                <div key={field.key} className="rounded-lg border border-white/10 bg-gray-900/50 p-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-400" htmlFor={`mapping-${field.key}`}>
                    {field.label}
                    {field.required && <span className="ml-1 text-red-300">*</span>}
                  </label>
                  <select
                    id={`mapping-${field.key}`}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-gray-cyan focus:outline-none"
                    value={mapping[field.key] ?? ''}
                    onChange={event => handleMappingChange(field.key, event.target.value)}
                  >
                    <option value="">
                      {t('admin.bulkImport.skipColumn', { defaultValue: 'Skip column' })}
                    </option>
                    {headers.map(header => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {rowResults.length > 0 && (
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-base font-semibold text-white">
                {t('admin.bulkImport.previewTitle', { defaultValue: 'Validation preview' })}
              </p>
              <p className="text-xs text-gray-400">
                {t('admin.bulkImport.previewSummary', {
                  defaultValue: '{{valid}} valid rows · {{invalid}} rows with issues',
                  valid: validRows.length,
                  invalid: invalidRows.length,
                })}
              </p>
            </div>
            {importing && (
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-900/60 px-3 py-1 text-xs text-gray-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>
                  {t('admin.bulkImport.processing', {
                    defaultValue: 'Processing {{processed}} / {{total}}',
                    processed: progress.processed,
                    total: validRows.length,
                  })}
                </span>
              </div>
            )}
          </div>

          {invalidRows.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-100">
                    {t('admin.bulkImport.invalidRows', { defaultValue: 'Rows with validation errors (skipped automatically)' })}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {invalidRows.slice(0, 10).map(row => (
                      <li key={row.index}>
                        {t('admin.bulkImport.rowNumber', { defaultValue: 'Row {{row}}', row: row.index + 2 })}: {row.errors.join('; ')}
                      </li>
                    ))}
                    {invalidRows.length > 10 && (
                      <li className="italic text-amber-200">
                        {t('admin.bulkImport.additionalRows', {
                          defaultValue: '+{{count}} more rows with issues',
                          count: invalidRows.length - 10,
                        })}
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {previewRows.length > 0 && selectedFields.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-xs">
                <thead className="bg-black/40 text-gray-300">
                  <tr>
                    <th className="px-3 py-2 font-semibold uppercase tracking-wide">{t('admin.bulkImport.rowHeader', { defaultValue: 'Row' })}</th>
                    {selectedFields.map(field => (
                      <th key={field.key} className="px-3 py-2 font-semibold uppercase tracking-wide">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {previewRows.map(row => (
                    <tr key={row.index}>
                      <td className="px-3 py-2 text-gray-400">{row.index + 2}</td>
                      {selectedFields.map(field => {
                        const value = row.data[field.key];
                        let displayValue = '';
                        if (Array.isArray(value)) {
                          displayValue = value.join(', ');
                        } else if (typeof value === 'object' && value !== null) {
                          displayValue = JSON.stringify(value);
                        } else if (value !== undefined) {
                          displayValue = String(value);
                        }
                        return (
                          <td key={field.key} className="px-3 py-2 text-gray-100">
                            {displayValue || <span className="text-gray-500">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {summary && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {t('admin.bulkImport.summary', {
                  defaultValue: 'Imported {{success}} / {{total}} rows ({{failed}} failed, {{skipped}} skipped).',
                  success: summary.succeeded,
                  total: summary.processed,
                  failed: summary.failed,
                  skipped: summary.skipped,
                })}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col justify-end gap-3 border-t border-white/10 pt-4 sm:flex-row">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          disabled={importing}
        >
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={importing || validRows.length === 0 || !requiredFieldsMapped}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-cyan px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span>
            {t('admin.bulkImport.importCta', {
              defaultValue: 'Import {{count}} rows',
              count: validRows.length,
            })}
          </span>
        </button>
      </div>
    </div>
  );
};

export default BulkImportModal;
