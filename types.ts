
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'dealer' | 'user' | 'pending';

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  role: UserRole;
}

export interface UserProfile extends AuthenticatedUser {
  displayName?: string | null;
  status?: 'pending' | 'approved';
  [key: string]: unknown;
}

export type DealerStatus = 'pending' | 'approved' | 'rejected' | 'deleted';

interface FirestoreTimestamps {
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type DealerStatus = 'pending' | 'approved' | 'rejected';

interface DealerCore {
  name: string;
  description?: string;
  companyName?: string;
  contactName?: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  phone?: string;
  email?: string;
  contact_phone?: string;
  contact_email?: string;
  website?: string;
  social_links?: { facebook?: string; instagram?: string; twitter?: string; youtube?: string; };
  brands: string[];
  languages: string[];
  notes?: string;
  typeOfCars: string;
  priceRange?: string;
  modelsAvailable: string[];
  image_url?: string;
  logo_url?: string | null;
  description?: string | null;
  location?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  isActive?: boolean;
  status?: DealerStatus;
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
  isFeatured?: boolean;
  imageGallery?: string[];
}

export interface DealerDocument extends DealerCore, FirestoreTimestamps {
  ownerUid?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  approved?: boolean;
  approvedAt?: Timestamp | null;
  rejectedAt?: Timestamp | null;
  rejectionReason?: string | null;
}

export interface Dealer extends DealerDocument {
  id: string;
}

interface ModelCore {
  brand: string;
  model_name: string;
  source?: 'ai' | 'api' | 'manual';
  year_start?: number;
  body_type?: string;
  charge_port?: string;
  charge_power?: number; // in kW
  autocharge_supported?: boolean;
  battery_capacity?: number; // in kWh
  battery_useable_capacity?: number; // in kWh
  battery_type?: string;
  battery_voltage?: number;
  range_wltp?: number; // in km
  power_kw?: number; // in kW
  torque_nm?: number; // in Nm
  acceleration_0_100?: number; // in s
  acceleration_0_60?: number; // in s
  top_speed?: number; // in km/h
  drive_type?: string;
  seats?: number;
  charging_ac?: string;
  charging_dc?: string;
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  wheelbase_mm?: number;
  weight_kg?: number;
  cargo_volume_l?: number;
  notes?: string;
  image_url?: string;
  isFeatured?: boolean;
  imageGallery?: string[];
}

export interface ModelOwnershipMetadata extends FirestoreTimestamps {
  ownerDealerId?: string | null;
  ownerUid?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface Model extends ModelCore, ModelOwnershipMetadata {
  id: string;
}

export interface DealerModel {
  dealer_id: string;
  model_id: string;
}

export interface FavouriteEntry extends FirestoreTimestamps {
  id: string;
  itemId: string;
  userId: string;
  role?: UserRole | null;
  collection?: string;
}

export interface BlogPostList {
  title?: string;
  ordered?: boolean;
  items: string[];
}

export interface BlogPostSection {
  id: string;
  heading: string;
  paragraphs: string[];
  list?: BlogPostList;
  highlight?: string;
}

export interface BlogPostFaq {
  question: string;
  answer: string;
}

export interface BlogPostCta {
  text: string;
  url: string;
}

interface BlogPostMetadata extends FirestoreTimestamps {
  ownerUid?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  published?: boolean;
  publishedAt?: Timestamp | null;
}

export interface BlogPost extends BlogPostMetadata {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  imageUrl: string;
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  sections: BlogPostSection[];
  faqs?: BlogPostFaq[];
  cta?: BlogPostCta;
}

// Charging Stations
export interface ChargingStationDocument {
  address: string;
  plugTypes: string; // e.g., "CCS2, GB/T"
  chargingSpeedKw: number;
  operator: string | null;
  pricingDetails: string | null;
  googleMapsLink: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface ChargingStation extends ChargingStationDocument {
  id: string;
}

export interface ChargingStationFormValues {
  address: string;
  plugTypes: string;
  chargingSpeedKw: number | '';
  operator: string;
  pricingDetails: string;
  googleMapsLink: string;
  latitude: number | '';
  longitude: number | '';
}

export type StationSource = 'custom' | 'ocm';
