import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Model } from '../types';
import { Heart, ArrowRight, Battery, Gauge, ShieldCheck } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites';
import { MODEL_PLACEHOLDER_IMAGE } from '../constants/media';
import OptimizedImage from './OptimizedImage';
import Link from './LocalizedLink';

const ModelCard: React.FC<{ model: Model }> = ({ model }) => {
    const { t } = useTranslation();
    const { isFavorite, toggleFavorite } = useFavorites();
    const favorited = isFavorite(model.id);
    const imageUrl = model.image_url || model.imageGallery?.[0] || MODEL_PLACEHOLDER_IMAGE;
    const battery = model.battery_capacity ? `${model.battery_capacity} kWh` : t('modelsPage.rangeUnknown');
    const range = model.range_wltp ? `${model.range_wltp} km` : t('modelsPage.rangeUnknown');
    const batteryPercent = model.battery_capacity ? Math.min(100, Math.round((model.battery_capacity / 120) * 100)) : null;
    const rangePercent = model.range_wltp ? Math.min(100, Math.round((model.range_wltp / 700) * 100)) : null;

    return (
        <div className="relative bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-lg overflow-hidden group transition-all duration-300 transform hover:-translate-y-1 hover:shadow-neon-cyan h-full flex flex-col">
             <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFavorite(model.id, 'models');
                }}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white hover:text-vivid-red transition-colors"
                aria-label={favorited ? t('common.favoriteRemove') : t('common.favoriteAdd')}
            >
                <Heart size={20} className={`${favorited ? 'fill-vivid-red text-vivid-red' : 'fill-transparent'}`} />
            </button>
            <Link to={`/models/${model.id}`} className="flex flex-col h-full">
                <div className="relative overflow-hidden h-48">
                    <OptimizedImage
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        src={imageUrl}
                        alt={`${model.brand} ${model.model_name}`}
                        fallbackSrc={MODEL_PLACEHOLDER_IMAGE}
                    />
                    {model.body_type && (
                        <div className="absolute top-4 left-4 bg-gray-cyan/80 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">{model.body_type}</div>
                    )}
                    {model.ownerDealerId && (
                        <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/80 px-3 py-1 text-xs font-semibold text-black">
                            <ShieldCheck size={14} />
                            {t('modelDetails.availableAt')}
                        </div>
                    )}
                </div>
                <div className="p-6 flex flex-col flex-grow">
                    <div className="flex-grow">
                        <p className="text-sm font-semibold text-gray-400">{model.brand}</p>
                        <h3 className="text-xl font-bold text-white mt-1">{model.model_name}</h3>
                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                            <div className="rounded-lg bg-white/5 p-4 text-center">
                                <Battery className="mx-auto text-gray-cyan mb-1" size={20}/>
                                <p className="font-bold text-white">{battery}</p>
                                {batteryPercent !== null && (
                                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                                        <div
                                            className="h-full bg-gradient-to-r from-gray-cyan via-emerald-400 to-gray-cyan transition-all"
                                            style={{ width: `${batteryPercent}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="rounded-lg bg-white/5 p-4 text-center">
                                <Gauge className="mx-auto text-gray-cyan mb-1" size={20}/>
                                <p className="font-bold text-white">{range}</p>
                                {rangePercent !== null && (
                                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-400 via-gray-cyan to-indigo-500 transition-all"
                                            style={{ width: `${rangePercent}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/10 text-right">
                        <span className="text-gray-cyan font-semibold group-hover:text-white transition-colors flex items-center justify-end text-sm">
                            {t('modelsPage.viewDetails')} <ArrowRight size={16} className="ml-2 transform group-hover:translate-x-1 transition-transform" />
                        </span>
                    </div>
                </div>
            </Link>
        </div>
    );
};

export default ModelCard;
