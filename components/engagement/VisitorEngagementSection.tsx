import React, { useMemo, useState } from 'react';
import { ArrowRight, BatteryCharging, Calculator, Car, MapPin, Route, Scale, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Link from '../LocalizedLink';
import ComparisonModal from '../ComparisonModal';
import { usePublicAnnouncementsContext } from '../../contexts/PublicAnnouncementsContext';
import type { Dealer, Listing, Model } from '../../types';

interface VisitorEngagementSectionProps {
  models: Model[];
  dealers: Dealer[];
  listings: Listing[];
  stationCount: number;
}

const bodyTypes = ['Any', 'SUV', 'Sedan', 'Hatchback', 'Crossover', 'Van'];

const VisitorEngagementSection: React.FC<VisitorEngagementSectionProps> = ({
  models,
  dealers,
  listings,
  stationCount,
}) => {
  const { t } = useTranslation();
  const { announcements, openFeed } = usePublicAnnouncementsContext();
  const [budget, setBudget] = useState(35000);
  const [rangeNeed, setRangeNeed] = useState(320);
  const [seats, setSeats] = useState(5);
  const [bodyType, setBodyType] = useState('Any');
  const [monthlyKm, setMonthlyKm] = useState(900);
  const [electricityPrice, setElectricityPrice] = useState(0.14);
  const [fuelPrice, setFuelPrice] = useState(1.75);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  const matchedModels = useMemo(() => {
    const requestedBody = bodyType.toLowerCase();
    return [...models]
      .filter(model => {
        const range = model.range_wltp ?? 0;
        const seatCount = model.seats ?? 0;
        const matchesRange = range === 0 || range >= rangeNeed * 0.85;
        const matchesSeats = seatCount === 0 || seatCount >= seats;
        const matchesBody =
          bodyType === 'Any' || (model.body_type ?? '').toLowerCase().includes(requestedBody);
        return matchesRange && matchesSeats && matchesBody;
      })
      .sort((left, right) => {
        if (left.isFeatured !== right.isFeatured) {
          return left.isFeatured ? -1 : 1;
        }
        return (right.range_wltp ?? 0) - (left.range_wltp ?? 0);
      })
      .slice(0, 3);
  }, [bodyType, models, rangeNeed, seats]);

  const routeConfidence = useMemo(() => {
    if (stationCount >= 80) return 'High';
    if (stationCount >= 40) return 'Medium';
    return 'Growing';
  }, [stationCount]);

  const evMonthlyCost = (monthlyKm / 100) * 17 * electricityPrice;
  const fuelMonthlyCost = (monthlyKm / 100) * 7 * fuelPrice;
  const monthlySavings = Math.max(fuelMonthlyCost - evMonthlyCost, 0);
  const recentUpdates = announcements.slice(0, 3);

  return (
    <section className="me-section">
      <div className="me-shell">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="me-eyebrow">
              <Sparkles className="h-4 w-4" />
              {t('engagement.eyebrow', { defaultValue: 'Interactive EV research' })}
            </p>
            <h2 className="me-heading mt-3">
              {t('engagement.title', { defaultValue: 'Make the next step clearer' })}
            </h2>
            <p className="me-copy mt-4">
              {t('engagement.description', {
                defaultValue:
                  'Use quick decision tools for model fit, comparison, charging confidence, and ownership cost before opening a dealer or listing.',
              })}
            </p>
          </div>
          <button type="button" onClick={() => setComparisonOpen(true)} className="me-button-secondary">
            <Scale className="h-4 w-4" />
            {t('engagement.openCompare', { defaultValue: 'Compare EV models' })}
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.48fr)]">
          <div className="me-card p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,0.7fr)]">
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-cyan/15 text-gray-cyan">
                    <Car className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-black text-white">
                      {t('engagement.finderTitle', { defaultValue: 'EV finder quiz' })}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {t('engagement.finderSubtitle', { defaultValue: 'Adjust the basics and see model-card matches.' })}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm text-slate-300">
                    <span className="font-semibold text-white">
                      {t('engagement.rangeNeed', { defaultValue: 'Range need' })}: {rangeNeed} km
                    </span>
                    <input
                      type="range"
                      min={120}
                      max={650}
                      step={10}
                      value={rangeNeed}
                      onChange={event => setRangeNeed(Number(event.target.value))}
                      className="mt-3 w-full accent-[#54a09b]"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    <span className="font-semibold text-white">
                      {t('engagement.budget', { defaultValue: 'Budget signal' })}: EUR {budget.toLocaleString('en-US')}
                    </span>
                    <input
                      type="range"
                      min={10000}
                      max={120000}
                      step={2500}
                      value={budget}
                      onChange={event => setBudget(Number(event.target.value))}
                      className="mt-3 w-full accent-[#54a09b]"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    <span className="font-semibold text-white">{t('engagement.seats', { defaultValue: 'Seats' })}</span>
                    <select
                      value={seats}
                      onChange={event => setSeats(Number(event.target.value))}
                      className="me-input mt-2"
                    >
                      {[2, 4, 5, 6, 7].map(value => (
                        <option key={value} value={value}>{value}+</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm text-slate-300">
                    <span className="font-semibold text-white">{t('engagement.bodyType', { defaultValue: 'Body type' })}</span>
                    <select
                      value={bodyType}
                      onChange={event => setBodyType(event.target.value)}
                      className="me-input mt-2"
                    >
                      {bodyTypes.map(value => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm font-bold text-white">
                  {t('engagement.matchesTitle', { defaultValue: 'Suggested model cards' })}
                </p>
                <div className="mt-4 space-y-2">
                  {matchedModels.length ? matchedModels.map(model => (
                    <Link
                      key={model.id}
                      to={`/models/${model.id}`}
                      className="group flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 transition hover:border-gray-cyan/50 hover:bg-gray-cyan/10"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-cyan/15 text-gray-cyan">
                        <BatteryCharging className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-white">{model.brand} {model.model_name}</span>
                        <span className="block text-xs text-slate-400">
                          {model.range_wltp ? `${model.range_wltp} km WLTP` : 'Range pending'} · {model.body_type || 'Body pending'}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-gray-cyan" />
                    </Link>
                  )) : (
                    <p className="text-sm leading-6 text-slate-400">
                      {t('engagement.noMatches', { defaultValue: 'No close matches yet. Try a lower range need or browse the full model catalog.' })}
                    </p>
                  )}
                </div>
                <Link to="/models" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-gray-cyan hover:text-white">
                  {t('engagement.browseCatalog', { defaultValue: 'Browse all model cards' })}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="me-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-cyan/15 text-gray-cyan">
                  <Route className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {t('engagement.chargingTitle', { defaultValue: 'Charging confidence' })}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {stationCount} {t('engagement.stationLabel', { defaultValue: 'mapped locations' })}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">{t('engagement.routeConfidence', { defaultValue: 'Network confidence' })}</p>
                <p className="mt-1 text-2xl font-black text-white">{routeConfidence}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {t('engagement.routeDescription', {
                    defaultValue: 'Check the map before longer routes and confirm station details before departure.',
                  })}
                </p>
              </div>
              <Link to="/albania-charging-stations" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-gray-cyan hover:text-white">
                <MapPin className="h-4 w-4" />
                {t('engagement.openMap', { defaultValue: 'Open charging map' })}
              </Link>
            </div>

            <div className="me-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-cyan/15 text-gray-cyan">
                  <Calculator className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-black text-white">
                  {t('engagement.costTitle', { defaultValue: 'Ownership cost check' })}
                </h3>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold text-slate-400">
                  Monthly km
                  <input type="number" value={monthlyKm} onChange={event => setMonthlyKm(Number(event.target.value))} className="me-input mt-1 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-400">
                  EUR/kWh
                  <input type="number" step="0.01" value={electricityPrice} onChange={event => setElectricityPrice(Number(event.target.value))} className="me-input mt-1 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-400">
                  EUR/L
                  <input type="number" step="0.01" value={fuelPrice} onChange={event => setFuelPrice(Number(event.target.value))} className="me-input mt-1 text-sm" />
                </label>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">EV</p>
                  <p className="mt-1 text-lg font-black text-white">EUR {evMonthlyCost.toFixed(0)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Fuel</p>
                  <p className="mt-1 text-lg font-black text-white">EUR {fuelMonthlyCost.toFixed(0)}</p>
                </div>
                <div className="rounded-lg border border-gray-cyan/20 bg-gray-cyan/10 p-3">
                  <p className="text-xs text-cyan-100/70">Diff.</p>
                  <p className="mt-1 text-lg font-black text-white">EUR {monthlySavings.toFixed(0)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(320px,0.4fr)]">
          <div className="me-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-white">
                  {t('engagement.marketSignals', { defaultValue: 'Marketplace signals' })}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {dealers.length} dealers · {models.length} model cards · {listings.length} listings
                </p>
              </div>
              <Link to="/listings" className="me-button-secondary">
                {t('home.heroListingsCta', { defaultValue: 'View EVs for sale' })}
              </Link>
            </div>
          </div>

          <div className="me-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-white">
                {t('engagement.recentUpdates', { defaultValue: 'Recently added' })}
              </h3>
              <button type="button" onClick={openFeed} className="text-sm font-bold text-gray-cyan hover:text-white">
                {t('engagement.viewAllUpdates', { defaultValue: 'View all' })}
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {recentUpdates.length ? recentUpdates.map(update => (
                <div key={update.id} className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-sm font-bold text-white">{update.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{update.summary}</p>
                </div>
              )) : (
                <p className="text-sm leading-6 text-slate-400">
                  {t('engagement.noRecentUpdates', { defaultValue: 'Public platform updates will appear here once published.' })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ComparisonModal
        isOpen={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        allModels={models}
      />
    </section>
  );
};

export default VisitorEngagementSection;
