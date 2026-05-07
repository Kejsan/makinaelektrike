import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  PlacementEntityType,
  PlacementZone,
  PromotionalCampaign,
  PromotionalCampaignFormValues,
  SponsorshipProduct,
} from '../../types';
import {
  formatPlacementEntityTypeLabel,
  PLACEMENT_ENTITY_TYPES,
  PROMOTIONAL_CAMPAIGN_PROMOTION_TYPES,
  PROMOTIONAL_CAMPAIGN_STATUSES,
} from '../../utils/placements';

interface PromotionalCampaignFormProps {
  initialValues?: PromotionalCampaign;
  zones: PlacementZone[];
  products: SponsorshipProduct[];
  onSubmit: (values: PromotionalCampaignFormValues) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const defaultState: PromotionalCampaignFormValues = {
  name: '',
  description: '',
  status: 'draft',
  promotionType: 'house_promotion',
  sponsoredEntityType: '',
  sponsoredEntityId: '',
  sponsorshipProductId: '',
  zoneIds: [],
  headline: '',
  supportingText: '',
  imageUrl: '',
  ctaLabel: '',
  destinationUrl: '',
  localeTargets: [],
  startAt: '',
  endAt: '',
  priority: 0,
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

const formatDateTimeLocal = (value?: string | null) => {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const pad = (input: number) => String(input).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const PromotionalCampaignForm: React.FC<PromotionalCampaignFormProps> = ({
  initialValues,
  zones,
  products,
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<PromotionalCampaignFormValues>(defaultState);
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
      name: initialValues.name ?? '',
      description: initialValues.description ?? '',
      status: initialValues.status ?? 'draft',
      promotionType: initialValues.promotionType ?? 'house_promotion',
      sponsoredEntityType: initialValues.sponsoredEntityType ?? '',
      sponsoredEntityId: initialValues.sponsoredEntityId ?? '',
      sponsorshipProductId: initialValues.sponsorshipProductId ?? '',
      zoneIds: initialValues.zoneIds ?? [],
      headline: initialValues.headline ?? '',
      supportingText: initialValues.supportingText ?? '',
      imageUrl: initialValues.imageUrl ?? '',
      ctaLabel: initialValues.ctaLabel ?? '',
      destinationUrl: initialValues.destinationUrl ?? '',
      localeTargets: initialValues.localeTargets ?? [],
      startAt: formatDateTimeLocal(typeof initialValues.startAt === 'string' ? initialValues.startAt : null),
      endAt: formatDateTimeLocal(typeof initialValues.endAt === 'string' ? initialValues.endAt : null),
      priority: initialValues.priority ?? 0,
    });
    setLocaleTargetsText((initialValues.localeTargets ?? []).join(', '));
    setErrors({});
  }, [initialValues]);

  const entityTypeOptions = useMemo(() => [...PLACEMENT_ENTITY_TYPES], []);
  const zoneOptions = useMemo(
    () => zones.filter(zone => zone.status !== 'archived'),
    [zones],
  );
  const productOptions = useMemo(
    () => products.filter(product => product.status !== 'archived'),
    [products],
  );

  const toggleZoneId = (zoneId: string) => {
    setFormState(prev => {
      const next = prev.zoneIds.includes(zoneId)
        ? prev.zoneIds.filter(value => value !== zoneId)
        : [...prev.zoneIds, zoneId];
      return {
        ...prev,
        zoneIds: next,
      };
    });
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!formState.name.trim()) nextErrors.name = 'Name is required.';
    if (formState.priority !== '' && Number(formState.priority) < 0) {
      nextErrors.priority = 'Priority must be 0 or greater.';
    }
    if (formState.promotionType === 'sponsored_promotion') {
      if (!formState.sponsoredEntityType) {
        nextErrors.sponsoredEntityType = 'Choose a sponsored entity type.';
      }
      if (!formState.sponsoredEntityId.trim()) {
        nextErrors.sponsoredEntityId = 'Sponsored entity ID is required.';
      }
      if (!formState.sponsorshipProductId.trim()) {
        nextErrors.sponsorshipProductId = 'Choose a sponsorship product.';
      }
    }
    if (
      formState.promotionType === 'house_promotion' &&
      !formState.headline.trim() &&
      !formState.destinationUrl.trim()
    ) {
      nextErrors.headline = 'House campaigns need at least a headline or destination URL.';
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
      description: formState.description.trim(),
      sponsoredEntityId: formState.sponsoredEntityId.trim(),
      sponsorshipProductId: formState.sponsorshipProductId.trim(),
      headline: formState.headline.trim(),
      supportingText: formState.supportingText.trim(),
      imageUrl: formState.imageUrl.trim(),
      ctaLabel: formState.ctaLabel.trim(),
      destinationUrl: formState.destinationUrl.trim(),
      localeTargets: parseCommaSeparated(localeTargetsText),
      priority: formState.priority === '' ? '' : Number(formState.priority),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.promotionalCampaignName', { defaultValue: 'Campaign name' })}</span>
          <input
            value={formState.name}
            onChange={event => setFormState(prev => ({ ...prev, name: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.name && <span className="mt-1 block text-xs text-red-400">{errors.name}</span>}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.placementStatus', { defaultValue: 'Status' })}</span>
          <select
            value={formState.status}
            onChange={event => setFormState(prev => ({ ...prev, status: event.target.value as PromotionalCampaignFormValues['status'] }))}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          >
            {PROMOTIONAL_CAMPAIGN_STATUSES.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-gray-300 sm:col-span-2">
          <span className="mb-1 inline-block font-medium">{t('admin.promotionalCampaignDescription', { defaultValue: 'Description' })}</span>
          <textarea
            rows={3}
            value={formState.description}
            onChange={event => setFormState(prev => ({ ...prev, description: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.promotionType', { defaultValue: 'Promotion type' })}</span>
          <select
            value={formState.promotionType}
            onChange={event => setFormState(prev => ({ ...prev, promotionType: event.target.value as PromotionalCampaignFormValues['promotionType'] }))}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          >
            {PROMOTIONAL_CAMPAIGN_PROMOTION_TYPES.map(promotionType => (
              <option key={promotionType} value={promotionType}>
                {promotionType}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.placementPriority', { defaultValue: 'Priority' })}</span>
          <input
            type="number"
            min={0}
            value={formState.priority}
            onChange={event => setFormState(prev => ({ ...prev, priority: event.target.value === '' ? '' : Number(event.target.value) }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.priority && <span className="mt-1 block text-xs text-red-400">{errors.priority}</span>}
        </label>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm font-medium text-white">
          {t('admin.zoneAssignments', { defaultValue: 'Zone assignments' })}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {zoneOptions.map(zone => (
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
      </div>

      {formState.promotionType === 'sponsored_promotion' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-gray-300">
            <span className="mb-1 inline-block font-medium">{t('admin.sponsoredEntityType', { defaultValue: 'Sponsored entity type' })}</span>
            <select
              value={formState.sponsoredEntityType}
              onChange={event => setFormState(prev => ({ ...prev, sponsoredEntityType: event.target.value as PlacementEntityType | '' }))}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
            >
              <option value="">{t('admin.selectOption', { defaultValue: 'Select...' })}</option>
              {entityTypeOptions.map(entityType => (
                <option key={entityType} value={entityType}>
                  {formatPlacementEntityTypeLabel(entityType)}
                </option>
              ))}
            </select>
            {errors.sponsoredEntityType && (
              <span className="mt-1 block text-xs text-red-400">{errors.sponsoredEntityType}</span>
            )}
          </label>

          <label className="block text-sm text-gray-300">
            <span className="mb-1 inline-block font-medium">{t('admin.sponsorshipProduct', { defaultValue: 'Sponsorship product' })}</span>
            <select
              value={formState.sponsorshipProductId}
              onChange={event => setFormState(prev => ({ ...prev, sponsorshipProductId: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
            >
              <option value="">{t('admin.selectOption', { defaultValue: 'Select...' })}</option>
              {productOptions.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            {errors.sponsorshipProductId && (
              <span className="mt-1 block text-xs text-red-400">{errors.sponsorshipProductId}</span>
            )}
          </label>

          <label className="block text-sm text-gray-300 sm:col-span-2">
            <span className="mb-1 inline-block font-medium">{t('admin.sponsoredEntityId', { defaultValue: 'Sponsored entity ID' })}</span>
            <input
              value={formState.sponsoredEntityId}
              onChange={event => setFormState(prev => ({ ...prev, sponsoredEntityId: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
            />
            {errors.sponsoredEntityId && (
              <span className="mt-1 block text-xs text-red-400">{errors.sponsoredEntityId}</span>
            )}
          </label>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.campaignHeadline', { defaultValue: 'Headline' })}</span>
          <input
            value={formState.headline}
            onChange={event => setFormState(prev => ({ ...prev, headline: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.headline && <span className="mt-1 block text-xs text-red-400">{errors.headline}</span>}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.campaignCtaLabel', { defaultValue: 'CTA label' })}</span>
          <input
            value={formState.ctaLabel}
            onChange={event => setFormState(prev => ({ ...prev, ctaLabel: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>

        <label className="block text-sm text-gray-300 sm:col-span-2">
          <span className="mb-1 inline-block font-medium">{t('admin.campaignSupportingText', { defaultValue: 'Supporting text' })}</span>
          <textarea
            rows={3}
            value={formState.supportingText}
            onChange={event => setFormState(prev => ({ ...prev, supportingText: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.campaignImageUrl', { defaultValue: 'Image URL' })}</span>
          <input
            value={formState.imageUrl}
            onChange={event => setFormState(prev => ({ ...prev, imageUrl: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.campaignDestinationUrl', { defaultValue: 'Destination URL' })}</span>
          <input
            value={formState.destinationUrl}
            onChange={event => setFormState(prev => ({ ...prev, destinationUrl: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.campaignStartAt', { defaultValue: 'Start at' })}</span>
          <input
            type="datetime-local"
            value={formState.startAt}
            onChange={event => setFormState(prev => ({ ...prev, startAt: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.campaignEndAt', { defaultValue: 'End at' })}</span>
          <input
            type="datetime-local"
            value={formState.endAt}
            onChange={event => setFormState(prev => ({ ...prev, endAt: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.endAt && <span className="mt-1 block text-xs text-red-400">{errors.endAt}</span>}
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

export default PromotionalCampaignForm;
