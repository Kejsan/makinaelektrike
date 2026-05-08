import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DealerPlacementRequestFormValues,
  PlacementEntityType,
  PlacementZone,
  SponsorshipProduct,
} from '../../types';
import { formatPlacementEntityTypeLabel } from '../../utils/placements';

type DealerPlacementSupportedEntityType = Extract<PlacementEntityType, 'dealer' | 'listing' | 'model'>;

export interface DealerPlacementEntityOption {
  id: string;
  type: DealerPlacementSupportedEntityType;
  label: string;
  description?: string | null;
}

interface DealerPlacementRequestFormProps {
  products: SponsorshipProduct[];
  zones: PlacementZone[];
  entityOptionsByType: Record<DealerPlacementSupportedEntityType, DealerPlacementEntityOption[]>;
  onSubmit: (values: DealerPlacementRequestFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
}

const defaultState: DealerPlacementRequestFormValues = {
  name: '',
  sponsorshipProductId: '',
  sponsoredEntityType: '',
  sponsoredEntityId: '',
  zoneIds: [],
  startAt: '',
  endAt: '',
  notes: '',
};

const DealerPlacementRequestForm: React.FC<DealerPlacementRequestFormProps> = ({
  products,
  zones,
  entityOptionsByType,
  onSubmit,
  isSubmitting,
}) => {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<DealerPlacementRequestFormValues>(defaultState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedProduct = useMemo(
    () => products.find(product => product.id === formState.sponsorshipProductId) ?? null,
    [formState.sponsorshipProductId, products],
  );

  const availableEntityTypes = useMemo(() => {
    if (!selectedProduct) {
      return [] as DealerPlacementSupportedEntityType[];
    }

    return selectedProduct.eligibleEntityTypes.filter(
      (entityType): entityType is DealerPlacementSupportedEntityType =>
        (entityType === 'dealer' || entityType === 'listing' || entityType === 'model') &&
        (entityOptionsByType[entityType]?.length ?? 0) > 0,
    );
  }, [entityOptionsByType, selectedProduct]);

  const selectedEntityOptions = useMemo(() => {
    if (!formState.sponsoredEntityType) {
      return [] as DealerPlacementEntityOption[];
    }

    return entityOptionsByType[formState.sponsoredEntityType] ?? [];
  }, [entityOptionsByType, formState.sponsoredEntityType]);

  const availableZones = useMemo(() => {
    if (!formState.sponsoredEntityType) {
      return [] as PlacementZone[];
    }

    return zones.filter(
      zone =>
        zone.status === 'active' &&
        zone.allowSponsoredPromotions &&
        zone.allowedEntityTypes.includes(formState.sponsoredEntityType),
    );
  }, [formState.sponsoredEntityType, zones]);

  useEffect(() => {
    if (!selectedProduct) {
      setFormState(defaultState);
      setErrors({});
      return;
    }

    setFormState(prev => {
      const nextType = availableEntityTypes.includes(prev.sponsoredEntityType as DealerPlacementSupportedEntityType)
        ? prev.sponsoredEntityType
        : availableEntityTypes[0] ?? '';
      const nextEntityOptions = nextType ? entityOptionsByType[nextType] ?? [] : [];
      const nextEntityId = nextEntityOptions.some(option => option.id === prev.sponsoredEntityId)
        ? prev.sponsoredEntityId
        : nextEntityOptions[0]?.id ?? '';

      return {
        ...prev,
        sponsoredEntityType: nextType,
        sponsoredEntityId: nextEntityId,
      };
    });
  }, [availableEntityTypes, entityOptionsByType, selectedProduct]);

  useEffect(() => {
    setFormState(prev => ({
      ...prev,
      zoneIds: prev.zoneIds.filter(zoneId => availableZones.some(zone => zone.id === zoneId)),
    }));
  }, [availableZones]);

  const toggleZoneId = (zoneId: string) => {
    setFormState(prev => ({
      ...prev,
      zoneIds: prev.zoneIds.includes(zoneId)
        ? prev.zoneIds.filter(value => value !== zoneId)
        : [...prev.zoneIds, zoneId],
    }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!formState.name.trim()) {
      nextErrors.name = 'Request name is required.';
    }
    if (!formState.sponsorshipProductId) {
      nextErrors.sponsorshipProductId = 'Choose a placement product.';
    }
    if (!formState.sponsoredEntityType) {
      nextErrors.sponsoredEntityType = 'Choose what you want to promote.';
    }
    if (!formState.sponsoredEntityId) {
      nextErrors.sponsoredEntityId = 'Choose a matching dealer, listing, or model.';
    }
    if (!formState.zoneIds.length) {
      nextErrors.zoneIds = 'Choose at least one preferred placement zone.';
    }
    if (!formState.startAt || !formState.endAt) {
      nextErrors.startAt = 'Preferred start and end dates are required.';
    }
    if (formState.startAt && formState.endAt && formState.endAt < formState.startAt) {
      nextErrors.endAt = 'End date must be after the start date.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    await onSubmit({
      ...formState,
      name: formState.name.trim(),
      notes: formState.notes.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300 sm:col-span-2">
          <span className="mb-1 inline-block font-medium">
            {t('dealerDashboardPage.promoRequestName', { defaultValue: 'Request name' })}
          </span>
          <input
            value={formState.name}
            onChange={event => setFormState(prev => ({ ...prev, name: event.target.value }))}
            placeholder={t('dealerDashboardPage.promoRequestNamePlaceholder', {
              defaultValue: 'June featured dealer push',
            })}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none"
          />
          {errors.name && <span className="mt-1 block text-xs text-red-400">{errors.name}</span>}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">
            {t('dealerDashboardPage.promoProductLabel', { defaultValue: 'Placement product' })}
          </span>
          <select
            value={formState.sponsorshipProductId}
            onChange={event =>
              setFormState(prev => ({
                ...prev,
                sponsorshipProductId: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none"
          >
            <option value="">
              {t('dealerDashboardPage.selectOption', { defaultValue: 'Select...' })}
            </option>
            {products.map(product => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          {errors.sponsorshipProductId && (
            <span className="mt-1 block text-xs text-red-400">{errors.sponsorshipProductId}</span>
          )}
          {selectedProduct?.priceLabel && (
            <span className="mt-1 block text-xs text-gray-500">{selectedProduct.priceLabel}</span>
          )}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">
            {t('dealerDashboardPage.promoEntityTypeLabel', { defaultValue: 'What do you want to promote?' })}
          </span>
          <select
            value={formState.sponsoredEntityType}
            onChange={event =>
              setFormState(prev => ({
                ...prev,
                sponsoredEntityType: event.target.value as DealerPlacementSupportedEntityType | '',
                sponsoredEntityId: '',
                zoneIds: [],
              }))
            }
            disabled={!selectedProduct}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">
              {t('dealerDashboardPage.selectOption', { defaultValue: 'Select...' })}
            </option>
            {availableEntityTypes.map(entityType => (
              <option key={entityType} value={entityType}>
                {formatPlacementEntityTypeLabel(entityType)}
              </option>
            ))}
          </select>
          {errors.sponsoredEntityType && (
            <span className="mt-1 block text-xs text-red-400">{errors.sponsoredEntityType}</span>
          )}
        </label>

        <label className="block text-sm text-gray-300 sm:col-span-2">
          <span className="mb-1 inline-block font-medium">
            {t('dealerDashboardPage.promoEntityLabel', { defaultValue: 'Promoted item' })}
          </span>
          <select
            value={formState.sponsoredEntityId}
            onChange={event => setFormState(prev => ({ ...prev, sponsoredEntityId: event.target.value }))}
            disabled={!formState.sponsoredEntityType}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">
              {t('dealerDashboardPage.selectOption', { defaultValue: 'Select...' })}
            </option>
            {selectedEntityOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.sponsoredEntityId && (
            <span className="mt-1 block text-xs text-red-400">{errors.sponsoredEntityId}</span>
          )}
        </label>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-white">
            {t('dealerDashboardPage.promoZonesLabel', { defaultValue: 'Preferred placement zones' })}
          </p>
          {selectedProduct?.defaultDurationDays != null && (
            <span className="text-xs text-gray-500">
              {t('dealerDashboardPage.promoDefaultDuration', {
                defaultValue: 'Typical duration: {{days}} days',
                days: selectedProduct.defaultDurationDays,
              })}
            </span>
          )}
        </div>
        {availableZones.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            {t('dealerDashboardPage.promoNoZonesAvailable', {
              defaultValue: 'Choose a promotion target to see compatible placement zones.',
            })}
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {availableZones.map(zone => (
              <label key={zone.id} className="flex items-start gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={formState.zoneIds.includes(zone.id)}
                  onChange={() => toggleZoneId(zone.id)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-gray-cyan focus:ring-gray-cyan/50"
                />
                <span>
                  <span className="block text-white">{zone.name}</span>
                  <span className="block text-xs text-gray-500">{zone.key}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {errors.zoneIds && <span className="mt-2 block text-xs text-red-400">{errors.zoneIds}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">
            {t('dealerDashboardPage.promoStartLabel', { defaultValue: 'Preferred start' })}
          </span>
          <input
            type="datetime-local"
            value={formState.startAt}
            onChange={event => setFormState(prev => ({ ...prev, startAt: event.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none"
          />
          {errors.startAt && <span className="mt-1 block text-xs text-red-400">{errors.startAt}</span>}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">
            {t('dealerDashboardPage.promoEndLabel', { defaultValue: 'Preferred end' })}
          </span>
          <input
            type="datetime-local"
            value={formState.endAt}
            onChange={event => setFormState(prev => ({ ...prev, endAt: event.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none"
          />
          {errors.endAt && <span className="mt-1 block text-xs text-red-400">{errors.endAt}</span>}
        </label>
      </div>

      <label className="block text-sm text-gray-300">
        <span className="mb-1 inline-block font-medium">
          {t('dealerDashboardPage.promoNotesLabel', {
            defaultValue: 'Campaign and billing notes',
          })}
        </span>
        <textarea
          rows={4}
          value={formState.notes}
          onChange={event => setFormState(prev => ({ ...prev, notes: event.target.value }))}
          placeholder={t('dealerDashboardPage.promoNotesPlaceholder', {
            defaultValue:
              'Share campaign goals, preferred messaging, or any billing/reference notes for the admin team.',
          })}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-gray-cyan/50 focus:outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting || products.length === 0}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-gray-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? t('dealerDashboardPage.submittingPromoRequest', { defaultValue: 'Submitting…' })
          : t('dealerDashboardPage.submitPromoRequest', { defaultValue: 'Submit promotion request' })}
      </button>
    </form>
  );
};

export default DealerPlacementRequestForm;
