import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Dealer,
  PlacementEntityType,
  PlacementZone,
  PromotionalCampaign,
  SponsorshipOrder,
  SponsorshipOrderFormValues,
  SponsorshipProduct,
} from '../../types';
import {
  formatPlacementEntityTypeLabel,
  PLACEMENT_ENTITY_TYPES,
  SPONSORSHIP_ORDER_STATUSES,
  SPONSORSHIP_PAYMENT_STATUSES,
} from '../../utils/placements';

interface SponsorshipOrderFormProps {
  initialValues?: SponsorshipOrder;
  dealers: Dealer[];
  zones: PlacementZone[];
  products: SponsorshipProduct[];
  campaigns: PromotionalCampaign[];
  onSubmit: (values: SponsorshipOrderFormValues) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const defaultState: SponsorshipOrderFormValues = {
  name: '',
  dealerId: '',
  sponsorshipProductId: '',
  campaignId: '',
  zoneIds: [],
  sponsoredEntityType: '',
  sponsoredEntityId: '',
  status: 'draft',
  paymentStatus: 'unpaid',
  priceAmount: '',
  currency: 'EUR',
  priceLabel: '',
  invoiceReference: '',
  startAt: '',
  endAt: '',
  paidAt: '',
  notes: '',
  internalNotes: '',
};

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

const SponsorshipOrderForm: React.FC<SponsorshipOrderFormProps> = ({
  initialValues,
  dealers,
  zones,
  products,
  campaigns,
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<SponsorshipOrderFormValues>(defaultState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initialValues) {
      setFormState(defaultState);
      setErrors({});
      return;
    }

    setFormState({
      name: initialValues.name ?? '',
      dealerId: initialValues.dealerId ?? '',
      sponsorshipProductId: initialValues.sponsorshipProductId ?? '',
      campaignId: initialValues.campaignId ?? '',
      zoneIds: initialValues.zoneIds ?? [],
      sponsoredEntityType: initialValues.sponsoredEntityType ?? '',
      sponsoredEntityId: initialValues.sponsoredEntityId ?? '',
      status: initialValues.status ?? 'draft',
      paymentStatus: initialValues.paymentStatus ?? 'unpaid',
      priceAmount: initialValues.priceAmount ?? '',
      currency: initialValues.currency ?? 'EUR',
      priceLabel: initialValues.priceLabel ?? '',
      invoiceReference: initialValues.invoiceReference ?? '',
      startAt: formatDateTimeLocal(typeof initialValues.startAt === 'string' ? initialValues.startAt : null),
      endAt: formatDateTimeLocal(typeof initialValues.endAt === 'string' ? initialValues.endAt : null),
      paidAt: formatDateTimeLocal(typeof initialValues.paidAt === 'string' ? initialValues.paidAt : null),
      notes: initialValues.notes ?? '',
      internalNotes: initialValues.internalNotes ?? '',
    });
    setErrors({});
  }, [initialValues]);

  const entityTypeOptions = useMemo(() => [...PLACEMENT_ENTITY_TYPES], []);
  const activeDealers = useMemo(
    () => dealers.filter(dealer => !dealer.isDeleted),
    [dealers],
  );
  const zoneOptions = useMemo(
    () => zones.filter(zone => zone.status !== 'archived'),
    [zones],
  );
  const productOptions = useMemo(
    () => products.filter(product => product.status !== 'archived'),
    [products],
  );
  const campaignOptions = useMemo(
    () => campaigns.filter(campaign => campaign.status !== 'archived'),
    [campaigns],
  );

  const selectedCampaign = campaignOptions.find(campaign => campaign.id === formState.campaignId) ?? null;

  useEffect(() => {
    if (!selectedCampaign) {
      return;
    }

    setFormState(prev => ({
      ...prev,
      zoneIds: prev.zoneIds.length > 0 ? prev.zoneIds : selectedCampaign.zoneIds,
      sponsoredEntityType:
        prev.sponsoredEntityType || (selectedCampaign.sponsoredEntityType ?? ''),
      sponsoredEntityId:
        prev.sponsoredEntityId || (selectedCampaign.sponsoredEntityId ?? ''),
    }));
  }, [selectedCampaign]);

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
    if (!formState.dealerId.trim()) nextErrors.dealerId = 'Choose a dealer.';
    if (!formState.sponsorshipProductId.trim()) nextErrors.sponsorshipProductId = 'Choose a sponsorship product.';
    if (!formState.zoneIds.length) nextErrors.zoneIds = 'Choose at least one placement zone.';
    if (formState.sponsoredEntityType && !formState.sponsoredEntityId.trim()) {
      nextErrors.sponsoredEntityId = 'Sponsored entity ID is required when an entity type is selected.';
    }
    if (formState.priceAmount !== '' && Number(formState.priceAmount) < 0) {
      nextErrors.priceAmount = 'Price must be zero or greater.';
    }
    if (
      (formState.status === 'reserved' || formState.status === 'paid' || formState.status === 'active') &&
      (!formState.startAt || !formState.endAt)
    ) {
      nextErrors.startAt = 'Reserved, paid, and active orders require both start and end dates.';
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
      dealerId: formState.dealerId.trim(),
      sponsorshipProductId: formState.sponsorshipProductId.trim(),
      campaignId: formState.campaignId.trim(),
      sponsoredEntityId: formState.sponsoredEntityId.trim(),
      currency: formState.currency.trim().toUpperCase(),
      priceLabel: formState.priceLabel.trim(),
      invoiceReference: formState.invoiceReference.trim(),
      notes: formState.notes.trim(),
      internalNotes: formState.internalNotes.trim(),
      priceAmount: formState.priceAmount === '' ? '' : Number(formState.priceAmount),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.sponsorshipOrderName', { defaultValue: 'Order name' })}</span>
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
            onChange={event => setFormState(prev => ({ ...prev, status: event.target.value as SponsorshipOrderFormValues['status'] }))}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          >
            {SPONSORSHIP_ORDER_STATUSES.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.dealerLabel', { defaultValue: 'Dealer' })}</span>
          <select
            value={formState.dealerId}
            onChange={event => setFormState(prev => ({ ...prev, dealerId: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          >
            <option value="">{t('admin.selectOption', { defaultValue: 'Select...' })}</option>
            {activeDealers.map(dealer => (
              <option key={dealer.id} value={dealer.id}>
                {dealer.name}
              </option>
            ))}
          </select>
          {errors.dealerId && <span className="mt-1 block text-xs text-red-400">{errors.dealerId}</span>}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.paymentStatusLabel', { defaultValue: 'Payment status' })}</span>
          <select
            value={formState.paymentStatus}
            onChange={event => setFormState(prev => ({ ...prev, paymentStatus: event.target.value as SponsorshipOrderFormValues['paymentStatus'] }))}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          >
            {SPONSORSHIP_PAYMENT_STATUSES.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.linkedCampaignLabel', { defaultValue: 'Linked campaign' })}</span>
          <select
            value={formState.campaignId}
            onChange={event => setFormState(prev => ({ ...prev, campaignId: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          >
            <option value="">{t('admin.noneLabel', { defaultValue: 'None' })}</option>
            {campaignOptions.map(campaign => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
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
        {errors.zoneIds && <span className="mt-2 block text-xs text-red-400">{errors.zoneIds}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.sponsoredEntityType', { defaultValue: 'Sponsored entity type' })}</span>
          <select
            value={formState.sponsoredEntityType}
            onChange={event => setFormState(prev => ({ ...prev, sponsoredEntityType: event.target.value as PlacementEntityType | '' }))}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          >
            <option value="">{t('admin.noneLabel', { defaultValue: 'None' })}</option>
            {entityTypeOptions.map(entityType => (
              <option key={entityType} value={entityType}>
                {formatPlacementEntityTypeLabel(entityType)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.sponsoredEntityId', { defaultValue: 'Sponsored entity ID' })}</span>
          <input
            value={formState.sponsoredEntityId}
            onChange={event => setFormState(prev => ({ ...prev, sponsoredEntityId: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.sponsoredEntityId && <span className="mt-1 block text-xs text-red-400">{errors.sponsoredEntityId}</span>}
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
          {errors.startAt && <span className="mt-1 block text-xs text-red-400">{errors.startAt}</span>}
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

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.paidAtLabel', { defaultValue: 'Paid at' })}</span>
          <input
            type="datetime-local"
            value={formState.paidAt}
            onChange={event => setFormState(prev => ({ ...prev, paidAt: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.invoiceReferenceLabel', { defaultValue: 'Invoice / reference' })}</span>
          <input
            value={formState.invoiceReference}
            onChange={event => setFormState(prev => ({ ...prev, invoiceReference: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.priceAmountLabel', { defaultValue: 'Price amount' })}</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={formState.priceAmount}
            onChange={event => setFormState(prev => ({ ...prev, priceAmount: event.target.value === '' ? '' : Number(event.target.value) }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
          {errors.priceAmount && <span className="mt-1 block text-xs text-red-400">{errors.priceAmount}</span>}
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.currencyLabel', { defaultValue: 'Currency' })}</span>
          <input
            value={formState.currency}
            onChange={event => setFormState(prev => ({ ...prev, currency: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.priceLabel', { defaultValue: 'Price label' })}</span>
          <input
            value={formState.priceLabel}
            onChange={event => setFormState(prev => ({ ...prev, priceLabel: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.customerNotesLabel', { defaultValue: 'External notes' })}</span>
          <textarea
            rows={3}
            value={formState.notes}
            onChange={event => setFormState(prev => ({ ...prev, notes: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-cyan"
          />
        </label>

        <label className="block text-sm text-gray-300">
          <span className="mb-1 inline-block font-medium">{t('admin.internalNotesLabel', { defaultValue: 'Internal notes' })}</span>
          <textarea
            rows={3}
            value={formState.internalNotes}
            onChange={event => setFormState(prev => ({ ...prev, internalNotes: event.target.value }))}
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

export default SponsorshipOrderForm;
