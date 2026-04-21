import type { Model } from '../types';
import { fetchFunctionJson } from './serverFunctions';

type QueryParams = Record<string, string | number | undefined | null>;

interface ElectricVehicleResponse {
  make?: string;
  model?: string;
  drivetrain?: string;
  drive?: string;
  body_style?: string;
  body_type?: string;
  charge_port?: string | null;
  charge_power_kw?: number | string | null;
  autocharge_supported?: boolean | string | null;
  seats?: number | string | null;
  range_km?: number | string | null;
  battery_capacity_kwh?: number | string | null;
  power_kw?: number | string | null;
  motor_power_kw?: number | string | null;
  torque_nm?: number | string | null;
  acceleration_seconds_0_to_100_kph?: number | string | null;
  acceleration_0_to_100?: number | string | null;
  acceleration_seconds_0_to_60_mph?: number | string | null;
  zero_to_sixty_mph?: number | string | null;
  top_speed_km_per_hour?: number | string | null;
  top_speed?: number | string | null;
  ac_charger_kw?: number | string | null;
  ac_charge_kw?: number | string | null;
  fast_charge_power_kw?: number | string | null;
  fast_charge_km_per_min?: number | string | null;
  efficiency_wh_per_km?: number | string | null;
  length_mm?: number | string | null;
  width_mm?: number | string | null;
  height_mm?: number | string | null;
  wheelbase_mm?: number | string | null;
  weight_kg?: number | string | null;
  cargo_volume_l?: number | string | null;
}

const buildQueryString = (params: QueryParams) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    searchParams.append(key, String(value));
  });
  return searchParams.toString();
};

const isPremiumPlaceholder = (value: unknown) =>
  typeof value === 'string' && value.toLowerCase().includes('premium');

const sanitizeString = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed || isPremiumPlaceholder(trimmed)) {
    return undefined;
  }
  return trimmed;
};

const parseNumber = (value: unknown): number | undefined => {
  if (isPremiumPlaceholder(value)) {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) {
      return undefined;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const parseBooleanFlag = (value: unknown): boolean | undefined => {
  if (isPremiumPlaceholder(value)) {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (['yes', 'true', 'y', '1'].includes(normalized)) {
      return true;
    }
    if (['no', 'false', '0'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};

const toModelId = (brand: string, modelName: string) =>
  `${brand}-${modelName}`
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();

const normalizeElectricVehicle = (vehicle: ElectricVehicleResponse): Model => {
  const brand = (vehicle.make ?? '').trim();
  const modelName = (vehicle.model ?? '').trim();
  const resolvedBrand = brand || 'Unknown';
  const resolvedModelName = modelName || 'Unknown';
  const battery_capacity = parseNumber(vehicle.battery_capacity_kwh);
  const range_wltp = parseNumber(vehicle.range_km);
  const power_kw = parseNumber(vehicle.power_kw ?? vehicle.motor_power_kw);
  const torque_nm = parseNumber(vehicle.torque_nm);
  const acceleration_0_100 = parseNumber(
    vehicle.acceleration_seconds_0_to_100_kph ?? vehicle.acceleration_0_to_100,
  );
  const acceleration_0_60 = parseNumber(
    vehicle.acceleration_seconds_0_to_60_mph ?? vehicle.zero_to_sixty_mph,
  );
  const top_speed = parseNumber(vehicle.top_speed_km_per_hour ?? vehicle.top_speed);
  const acKw = parseNumber(vehicle.ac_charger_kw ?? vehicle.ac_charge_kw);
  const dcCharge = parseNumber(vehicle.fast_charge_power_kw ?? vehicle.fast_charge_km_per_min);
  const charge_power = parseNumber(vehicle.charge_power_kw);
  const length_mm = parseNumber(vehicle.length_mm);
  const width_mm = parseNumber(vehicle.width_mm);
  const height_mm = parseNumber(vehicle.height_mm);
  const wheelbase_mm = parseNumber(vehicle.wheelbase_mm);
  const weight_kg = parseNumber(vehicle.weight_kg);
  const cargo_volume_l = parseNumber(vehicle.cargo_volume_l);
  const charge_port = sanitizeString(vehicle.charge_port);
  const autocharge_supported = parseBooleanFlag(vehicle.autocharge_supported) ?? false;

  return {
    id: toModelId(resolvedBrand, resolvedModelName),
    brand: resolvedBrand,
    model_name: resolvedModelName,
    source: 'api',
    body_type: vehicle.body_style ?? vehicle.body_type,
    charge_port,
    charge_power,
    autocharge_supported,
    battery_capacity,
    range_wltp,
    power_kw,
    torque_nm,
    acceleration_0_100,
    acceleration_0_60,
    top_speed,
    drive_type: vehicle.drive ?? vehicle.drivetrain,
    seats: parseNumber(vehicle.seats),
    charging_ac: acKw ? `${acKw} kW` : undefined,
    charging_dc: dcCharge
      ? `${dcCharge} ${vehicle.fast_charge_power_kw ? 'kW' : 'km/min'}`
      : undefined,
    length_mm,
    width_mm,
    height_mm,
    wheelbase_mm,
    weight_kg,
    cargo_volume_l,
    isFeatured: false,
    imageGallery: [],
    image_url: undefined,
    notes: vehicle.efficiency_wh_per_km
      ? `Efficiency: ${parseNumber(vehicle.efficiency_wh_per_km)} Wh/km`
      : undefined,
  } satisfies Model;
};

export async function getElectricVehicle(
  make?: string,
  model?: string,
  signal?: AbortSignal,
): Promise<Model[]> {
  const queryString = buildQueryString({ make: make?.trim(), model: model?.trim() });
  const query = Object.fromEntries(new URLSearchParams(queryString).entries());
  const vehicles = await fetchFunctionJson<ElectricVehicleResponse[]>('api-ninjas-electricvehicle', {
    query,
    signal,
  });

  return vehicles.map(normalizeElectricVehicle);
}
