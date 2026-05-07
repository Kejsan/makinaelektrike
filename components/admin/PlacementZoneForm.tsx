import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlacementEntityType, PlacementZone, PlacementZoneFormValues } from '../../types';
import {
  formatPlacementEntityTypeLabel,
  PLACEMENT_ENTITY_TYPES,
  PLACEMENT_ZONE_STATUSES,
} from '../../utils/placements';

interface PlacementZoneFormProps {
  initialValues?: PlacementZone;
  onSubmit: (values: PlacementZoneFormValues) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const defaultState: PlacementZoneFormValues = {
  key: '',
  name: '',
  description: '',
  pageKey: '',
  slotKey: '',
  allowedEntityTypes: ['dealer'],
  allowHousePromotions: true,
  allowSponsoredPromotions: true,
  maxAssignments: 1,
  localeTargets: [],
  status: 'active',
};

const parseCommaSeparated = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean),
    ),
  );

const PlacementZoneForm: React.FC<PlacementZoneFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<PlacementZoneFormValues>(defaultState);
  const [localeTargetsText, setLocaleTargetsText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initialValues) {
      setFormState(defaultState);
      setLocaleTargetsText('');
      setErrors({});
      return;
    }

    setFormState({
      key: initialValues.key ?? '',
      name: initialValues.name ?? '',
      description: initialValues.description ?? '',
      pageKey: initialValues.pageKey ?? '',
      slotKey: initialValues.slotKey ?? '',
      allowedEntityTypes: initialValues.allowedEntityTypes?.length
        ? initialValues.allowedEntityTypes
        : ['dealer'],
      allowHousePromotions: initialValues.allowHousePromotions !== false,
      allowSponsoredPromotions: initialValues.allowSponsoredPromotions !== false,
      maxAssignments: initialValues.maxAssignments ?? 1,
      localeTargets: initialValues.localeTargets ?? [],
      status: initialValues.status ?? 'active',
    });
    setLocaleTargetsText((initialValues.localeTargets ?? []).join(', '));
    setErrors({});
  }, [initialValues]);

  const entityTypeOptions = useMemo(() => [...PLACEMENT_ENTITY_TYPES], []);

  const toggleEntityType = (entityType: PlacementEntityType) => {
    setFormState(prev => {
      const next = prev.allowedEntityTypes.includes(entityType)
        ? prev.allowedEntityTypes.filter(value => value !== entityType)
        : [...prev.allowedEntityTypes, entityType];
      return {
        ...prev,
        allowedEntityTypes: next,
      };
    });
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formState.key.trim()) nextErrors.key = 'Key is required.';
    if (!formState.name.trim()) nextErrors.name = 'Name is required.';
    if (!formState.pageKey.trim()) nextErrors.pageKey = 'Page key is required.';
    if (!formState.slotKey.trim()) nextErrors.slotKey = 'Slot key is required.';
    if (!formState.allowedEntityTypes.length) {
      nextErrors.allowedEntityTypes = 'Choose at least one supported content type.';
    }
    if (!formState.allowHousePromotions && !formState.allowSponsoredPromotions) {
      nextErrors.allowHousePromotions = 'Enable house or sponsored promotions for this zone.';
    }
    if (formState.maxAssignments === '' || Number(formState.maxAssignments) < 1) {
      nextErrors.maxAssignments = 'Max assignments must be at least 1.';
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
      key: formState.key.trim().toLowerCase(),
      pageKey: formState.pageKey.trim().toLowerCase(),
      slotKey: formState.slotKey.trim().toLowerCase(),
      description: formState.description.trim(),
      maxAssignments: Number(formState.maxAssignments),
      localeTargets: parseCommaSeparated(localeTargetsText),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.placementZoneName', { defaultValue: 'Zone name' })}</span>
          <input
            value={formState.name}
            onChange={event => setFormState(prev => ({ ...prev, name: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.name && <span className="mt-1 block text-xs text-red-400">{errors.name}</span>}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.placementZoneKey', { defaultValue: 'Zone key' })}</span>
          <input
            value={formState.key}
            onChange={event => setFormState(prev => ({ ...prev, key: event.target.value }))}
            placeholder="home.featured_dealers"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.key && <span className="mt-1 block text-xs text-red-400">{errors.key}</span>}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.placementPageKey', { defaultValue: 'Page key' })}</span>
          <input
            value={formState.pageKey}
            onChange={event => setFormState(prev => ({ ...prev, pageKey: event.target.value }))}
            placeholder="home"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.pageKey && <span className="mt-1 block text-xs text-red-400">{errors.pageKey}</span>}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.placementSlotKey', { defaultValue: 'Slot key' })}</span>
          <input
            value={formState.slotKey}
            onChange={event => setFormState(prev => ({ ...prev, slotKey: event.target.value }))}
            placeholder="featured_rail"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.slotKey && <span className="mt-1 block text-xs text-red-400">{errors.slotKey}</span>}
        </label>

        <label className="block text-sm text-gray-300 sm:col-span-2">
          <span className="mb-1 inline-block font-medium">{t('admin.placementZoneDescription', { defaultValue: 'Description' })}</span>
          <textarea
            rows={3}
            value={formState.description}
            onChange={event => setFormState(prev => ({ ...prev, description: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm font-medium text-white">
          {t('admin.placementAllowedEntityTypes', { defaultValue: 'Allowed content types' })}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {entityTypeOptions.map(entityType => (
            <label key={entityType} className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={formState.allowedEntityTypes.includes(entityType)}
                onChange={() => toggleEntityType(entityType)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-gray-cyan focus:ring-gray-cyan/50"
              />
              <span>{formatPlacementEntityTypeLabel(entityType)}</span>
            </label>
          ))}
        </div>
        {errors.allowedEntityTypes && (
          <span className="mt-2 block text-xs text-red-400">{errors.allowedEntityTypes}</span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.maxAssignments', { defaultValue: 'Max assignments' })}</span>
          <input
            type="number"
            min={1}
            value={formState.maxAssignments}
            onChange={event => setFormState(prev => ({ ...prev, maxAssignments: event.target.value === '' ? '' : Number(event.target.value) }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.maxAssignments && <span className="mt-1 block text-xs text-red-400">{errors.maxAssignments}</span>}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.placementStatus', { defaultValue: 'Status' })}</span>
          <select
            value={formState.status}
            onChange={event => setFormState(prev => ({ ...prev, status: event.target.value as PlacementZoneFormValues['status'] }))}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          >
            {PLACEMENT_ZONE_STATUSES.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-gray-300 sm:col-span-2">
          <span className="mb-1 inline-block font-medium">{t('admin.localeTargets', { defaultValue: 'Locale targets' })}</span>
          <input
            value={localeTargetsText}
            onChange={event => setLocaleTargetsText(event.target.value)}
            placeholder="sq, en, it"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={formState.allowHousePromotions}
            onChange={event => setFormState(prev => ({ ...prev, allowHousePromotions: event.target.checked }))}
            className="h-4 w-4 rounded border-white/20 bg-white/5 text-gray-cyan focus:ring-gray-cyan/50"
          />
          <span>{t('admin.allowHousePromotions', { defaultValue: 'Allow house promotions' })}</span>
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={formState.allowSponsoredPromotions}
            onChange={event => setFormState(prev => ({ ...prev, allowSponsoredPromotions: event.target.checked }))}
            className="h-4 w-4 rounded border-white/20 bg-white/5 text-gray-cyan focus:ring-gray-cyan/50"
          />
          <span>{t('admin.allowSponsoredPromotions', { defaultValue: 'Allow sponsored promotions' })}</span>
        </label>
        {errors.allowHousePromotions && (
          <span className="mt-2 block text-xs text-red-400">{errors.allowHousePromotions}</span>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10"
        >
          {t('admin.cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-gray-cyan px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? `${t('admin.save')}...` : t('admin.save')}
        </button>
      </div>
    </form>
  );
};

export default PlacementZoneForm;
