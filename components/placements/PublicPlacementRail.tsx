import React from 'react';
import { ArrowRight, Megaphone, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PublicPlacementResolvedItem, PublicPlacementZoneResult } from '../../types';
import OptimizedImage from '../OptimizedImage';
import Link from '../LocalizedLink';
import { formatPlacementEntityTypeLabel } from '../../utils/placements';

interface PublicPlacementRailProps {
  zone?: PublicPlacementZoneResult | null;
  title?: string;
  eyebrow?: string;
  className?: string;
}

const isExternalUrl = (value?: string | null) =>
  Boolean(value && /^(https?:|mailto:|tel:)/i.test(value));

const PlacementLink: React.FC<{
  href: string;
  className?: string;
  children: React.ReactNode;
}> = ({ href, className, children }) =>
  isExternalUrl(href) ? (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <Link to={href} className={className}>
      {children}
    </Link>
  );

const PlacementCard: React.FC<{ item: PublicPlacementResolvedItem }> = ({ item }) => {
  const { t } = useTranslation();
  const badgeLabel =
    item.promotionType === 'sponsored_promotion'
      ? t('placements.sponsoredBadge', { defaultValue: 'Sponsored' })
      : t('placements.featuredBadge', { defaultValue: 'Featured' });
  const ctaLabel =
    item.ctaLabel ||
    t('placements.viewPromotion', {
      defaultValue: 'View promotion',
    });
  const entityTypeLabel = t(`placements.entityType.${item.entityType}`, {
    defaultValue: formatPlacementEntityTypeLabel(item.entityType),
  });
  const meta = item.entity?.meta ?? [];
  const imageUrl = item.imageUrl ?? null;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-gray-cyan/60 hover:shadow-neon-cyan">
      <PlacementLink href={item.destinationUrl || '#'} className="flex h-full flex-col">
        <div className="relative">
          {imageUrl ? (
            <OptimizedImage
              src={imageUrl}
              alt={item.headline}
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
              className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-56 w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(84,160,155,0.28),_rgba(2,8,23,0.96)_62%)]">
              <div className="rounded-full border border-white/10 bg-white/10 p-4 text-gray-cyan">
                {item.promotionType === 'sponsored_promotion' ? <Megaphone size={28} /> : <Sparkles size={28} />}
              </div>
            </div>
          )}
          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-gray-cyan" aria-hidden="true" />
            {badgeLabel}
          </div>
          <div className="absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/65 px-3 py-1 text-xs font-medium text-gray-200 backdrop-blur-md">
            {entityTypeLabel}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-6">
          {item.entity?.title && item.entity.title !== item.headline && (
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-cyan/90">
              {item.entity.title}
            </p>
          )}
          <h3 className="mt-2 text-2xl font-bold text-white transition-colors group-hover:text-gray-cyan">
            {item.headline}
          </h3>
          {item.entity?.subtitle && (
            <p className="mt-2 text-sm font-medium text-gray-300">{item.entity.subtitle}</p>
          )}
          {item.supportingText && (
            <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-gray-300">
              {item.supportingText}
            </p>
          )}
          {meta.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {meta.slice(0, 3).map(entry => (
                <span
                  key={`${item.campaignId}-${entry}`}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-300"
                >
                  {entry}
                </span>
              ))}
            </div>
          )}
          <div className="mt-auto pt-6">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors group-hover:text-gray-cyan">
              {ctaLabel}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </PlacementLink>
    </div>
  );
};

const PublicPlacementRail: React.FC<PublicPlacementRailProps> = ({
  zone,
  title,
  eyebrow,
  className = '',
}) => {
  if (!zone || zone.items.length === 0) {
    return null;
  }

  return (
    <section className={`py-4 ${className}`.trim()}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {(title || eyebrow || zone.zoneName) && (
          <div className="mb-8 text-center">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-cyan/90">
                {eyebrow}
              </p>
            )}
            <h2 className="mt-3 text-3xl font-bold text-white">
              {title || zone.zoneName}
            </h2>
          </div>
        )}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {zone.items.map(item => (
            <PlacementCard key={`${zone.zoneKey}-${item.campaignId}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default PublicPlacementRail;
