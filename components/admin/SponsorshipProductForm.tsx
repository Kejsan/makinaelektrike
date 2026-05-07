import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DealerPlanId,
  PlacementEntityType,
  SponsorshipProduct,
  SponsorshipProductFormValues,
} from '../../types';
import {
  formatPlacementEntityTypeLabel,
  PLACEMENT_ENTITY_TYPES,
  SPONSORSHIP_PRODUCT_STATUSES,
} from '../../utils/placements';

interface SponsorshipProductFormProps {
  initialValues?: SponsorshipProduct;
  onSubmit: (values: SponsorshipProductFormValues) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const DEALER_PLAN_OPTIONS: DealerPlanId[] = ['free', 'paid'];

const defaultState: SponsorshipProductFormValues = {
  code: '',
  name: '',
  description: '',
  eligiblePlanIds: ['paid'],
  eligibleEntityTypes: ['dealer'],
  defaultDurationDays: 30,
  priceLabel: '',
  status: 'active',
};

const SponsorshipProductForm: React.FC<SponsorshipProductFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<SponsorshipProductFormValues>(defaultState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initialValues) {
      setFormState(defaultState);
      setErrors({});
      return;
    }

    setFormState({
      code: initialValues.code ?? '',
      name: initialValues.name ?? '',
      description: initialValues.description ?? '',
      eligiblePlanIds: initialValues.eligiblePlanIds?.length
        ? initialValues.eligiblePlanIds
        : ['paid'],
      eligibleEntityTypes: initialValues.eligibleEntityTypes?.length
        ? initialValues.eligibleEntityTypes
        : ['dealer'],
      defaultDurationDays: initialValues.defaultDurationDays ?? '',
      priceLabel: initialValues.priceLabel ?? '',
      status: initialValues.status ?? 'active',
    });
    setErrors({});
  }, [initialValues]);

  const entityTypeOptions = useMemo(() => [...PLACEMENT_ENTITY_TYPES], []);

  const togglePlanId = (planId: DealerPlanId) => {
    setFormState(prev => {
      const next = prev.eligiblePlanIds.includes(planId)
        ? prev.eligiblePlanIds.filter(value => value !== planId)
        : [...prev.eligiblePlanIds, planId];
      return {
        ...prev,
        eligiblePlanIds: next,
      };
    });
  };

  const toggleEntityType = (entityType: PlacementEntityType) => {
    setFormState(prev => {
      const next = prev.eligibleEntityTypes.includes(entityType)
        ? prev.eligibleEntityTypes.filter(value => value !== entityType)
        : [...prev.eligibleEntityTypes, entityType];
      return {
        ...prev,
        eligibleEntityTypes: next,
      };
    });
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formState.code.trim()) nextErrors.code = 'Code is required.';
    if (!formState.name.trim()) nextErrors.name = 'Name is required.';
    if (!formState.eligiblePlanIds.length) {
      nextErrors.eligiblePlanIds = 'Choose at least one eligible dealer plan.';
    }
    if (!formState.eligibleEntityTypes.length) {
      nextErrors.eligibleEntityTypes = 'Choose at least one eligible content type.';
    }
    if (
      formState.defaultDurationDays !== '' &&
      Number(formState.defaultDurationDays) < 1
    ) {
      nextErrors.defaultDurationDays = 'Default duration must be at least 1 day.';
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
      code: formState.code.trim().toLowerCase(),
      name: formState.name.trim(),
      description: formState.description.trim(),
      priceLabel: formState.priceLabel.trim(),
      defaultDurationDays:
        formState.defaultDurationDays === '' ? '' : Number(formState.defaultDurationDays),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.sponsorshipProductName', { defaultValue: 'Product name' })}</span>
          <input
            value={formState.name}
            onChange={event => setFormState(prev => ({ ...prev, name: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.name && <span className="mt-1 block text-xs text-red-400">{errors.name}</span>}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.sponsorshipProductCode', { defaultValue: 'Product code' })}</span>
          <input
            value={formState.code}
            onChange={event => setFormState(prev => ({ ...prev, code: event.target.value }))}
            placeholder="homepage_dealer_spot"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.code && <span className="mt-1 block text-xs text-red-400">{errors.code}</span>}
        </label>

        <label className="block text-sm text-gray-300 sm:col-span-2">
          <span className="mb-1 inline-block font-medium">{t('admin.sponsorshipProductDescription', { defaultValue: 'Description' })}</span>
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
          {t('admin.eligibleDealerPlans', { defaultValue: 'Eligible dealer plans' })}
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          {DEALER_PLAN_OPTIONS.map(planId => (
            <label key={planId} className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={formState.eligiblePlanIds.includes(planId)}
                onChange={() => togglePlanId(planId)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-gray-cyan focus:ring-gray-cyan/50"
              />
              <span>{planId.toUpperCase()}</span>
            </label>
          ))}
        </div>
        {errors.eligiblePlanIds && (
          <span className="mt-2 block text-xs text-red-400">{errors.eligiblePlanIds}</span>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm font-medium text-white">
          {t('admin.eligibleEntityTypes', { defaultValue: 'Eligible content types' })}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {entityTypeOptions.map(entityType => (
            <label key={entityType} className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={formState.eligibleEntityTypes.includes(entityType)}
                onChange={() => toggleEntityType(entityType)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-gray-cyan focus:ring-gray-cyan/50"
              />
              <span>{formatPlacementEntityTypeLabel(entityType)}</span>
            </label>
          ))}
        </div>
        {errors.eligibleEntityTypes && (
          <span className="mt-2 block text-xs text-red-400">{errors.eligibleEntityTypes}</span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.defaultDurationDays', { defaultValue: 'Default duration (days)' })}</span>
          <input
            type="number"
            min={1}
            value={formState.defaultDurationDays}
            onChange={event => setFormState(prev => ({ ...prev, defaultDurationDays: event.target.value === '' ? '' : Number(event.target.value) }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.defaultDurationDays && (
            <span className="mt-1 block text-xs text-red-400">{errors.defaultDurationDays}</span>
          )}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.priceLabel', { defaultValue: 'Price label' })}</span>
          <input
            value={formState.priceLabel}
            onChange={event => setFormState(prev => ({ ...prev, priceLabel: event.target.value }))}
            placeholder="EUR 180 / 30 days"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>

        <label className="block text-sm text-gray-300 sm:col-span-2">
          <span className="mb-1 inline-block font-medium">{t('admin.placementStatus', { defaultValue: 'Status' })}</span>
          <select
            value={formState.status}
            onChange={event => setFormState(prev => ({ ...prev, status: event.target.value as SponsorshipProductFormValues['status'] }))}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          >
            {SPONSORSHIP_PRODUCT_STATUSES.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
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

export default SponsorshipProductForm;
