import type { FeatureCollection, Point } from 'geojson';
import { fetchFunctionJson } from './serverFunctions';

export interface OCMOperator {
  id: number;
  title: string;
}

export interface OCMConnectionType {
  id: number;
  title: string;
}

export interface OCMLevel {
  id: number;
  title: string;
  comments?: string | null;
}

export interface OCMUsageType {
  id: number;
  title: string;
}

export interface OCMStatusType {
  id: number;
  title: string;
  isOperational?: boolean;
}

export interface OCMReferenceData {
  Operators: OCMOperator[];
  ConnectionTypes: OCMConnectionType[];
  Levels: OCMLevel[];
  UsageTypes: OCMUsageType[];
  StatusTypes: OCMStatusType[];
}

export type StationFeatureCollection = FeatureCollection<Point, StationProperties>;

export interface StationProperties {
  id: number;
  uuid?: string;
  title?: string;
  addressInfo: {
    title?: string;
    addressLine1?: string;
    addressLine2?: string;
    town?: string;
    stateOrProvince?: string;
    postcode?: string;
    country?: {
      isoCode?: string;
      title?: string;
    };
    latitude: number;
    longitude: number;
    contactTelephone1?: string;
    contactTelephone2?: string;
    relatedURL?: string;
  };
  operatorInfo?: {
    id?: number;
    title?: string;
    websiteURL?: string;
    phonePrimaryContact?: string;
  };
  statusType?: {
    id?: number;
    title?: string;
    isOperational?: boolean;
  };
  usageType?: {
    id?: number;
    title?: string;
  };
  usageCost?: string | null;
  dateLastVerified?: string | null;
  dataProvider?: {
    title?: string;
  };
  connections?: Array<{
    id: number;
    connectionType?: {
      id?: number;
      title?: string;
      formalName?: string | null;
    };
    level?: {
      id?: number;
      title?: string;
    };
    powerKW?: number | null;
    amps?: number | null;
    voltage?: number | null;
    quantity?: number | null;
  }>;
  mediaItems?: Array<{
    id: number;
    itemURL: string;
    isEnabled?: boolean;
    comment?: string | null;
  }>;
  generalComments?: string | null;
}

export async function fetchReferenceData(signal?: AbortSignal): Promise<OCMReferenceData> {
  return fetchFunctionJson<OCMReferenceData>('ocm-reference-data', { signal });
}

interface FetchStationsOptions {
  mode: 'country' | 'bounds';
  countryCode?: string;
  boundingBox?: string;
  filters?: {
    operators?: number[];
    connectionTypes?: number[];
    levels?: number[];
    usageTypes?: number[];
    statusTypes?: number[];
  };
  signal?: AbortSignal;
}

export async function fetchStations({
  mode,
  countryCode = 'AL',
  boundingBox,
  filters,
  signal,
}: FetchStationsOptions): Promise<StationFeatureCollection> {
  return fetchFunctionJson<StationFeatureCollection>('ocm-stations', {
    query: {
      mode,
      countryCode,
      boundingBox,
      operators: filters?.operators,
      connectionTypes: filters?.connectionTypes,
      levels: filters?.levels,
      usageTypes: filters?.usageTypes,
      statusTypes: filters?.statusTypes,
    },
    signal,
  });
}
