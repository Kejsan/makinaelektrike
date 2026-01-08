import React, { useState, useMemo } from 'react';
import { Model } from '../types';
import { X, Search, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MODEL_PLACEHOLDER_IMAGE } from '../constants/media';
import {
  modalCloseButtonClass,
  modalContainerClass,
  modalHeaderClass,
  modalOverlayClass,
} from '../constants/modalStyles';

interface ComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    allModels: Model[];
}

const ComparisonModal: React.FC<ComparisonModalProps> = ({ isOpen, onClose, allModels }) => {
    const { t } = useTranslation();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const handleSelectModel = (id: string) => {
        setSelectedIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(item => item !== id);
            }
            if (prev.length < 3) {
                return [...prev, id];
            }
            return prev;
        });
    };
    
    const clearSelection = () => setSelectedIds([]);

    const selectedModels = useMemo(() => 
        (allModels || []).filter(m => selectedIds.includes(m.id)), 
        [allModels, selectedIds]
    );

    const filteredListModels = useMemo(() => 
        (allModels || []).filter(m => 
            (m.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (m.model_name || '').toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => (a.brand || '').localeCompare(b.brand || '') || (a.model_name || '').localeCompare(b.model_name || '')),
        [allModels, searchTerm]
    );
    
    const comparisonSpecs = useMemo(() => [
        { key: 'brand', label: t('modelDetails.brand') },
        { key: 'model_name', label: t('modelsPage.sortOptions.model_asc').replace(' (A-Z)','') },
        { key: 'body_type', label: t('modelsPage.bodyType') },
        { key: 'battery_capacity', label: t('modelDetails.battery'), unit: ' kWh' },
        { key: 'range_wltp', label: t('modelDetails.range'), unit: ' km' },
        { key: 'power_kw', label: t('modelDetails.power'), unit: ' kW' },
        { key: 'torque_nm', label: t('modelDetails.torque'), unit: ' Nm' },
        { key: 'acceleration_0_100', label: t('modelDetails.acceleration'), unit: ' s' },
        { key: 'top_speed', label: t('modelDetails.topSpeed'), unit: ' km/h' },
        { key: 'drive_type', label: t('modelDetails.drive') },
        { key: 'seats', label: t('modelDetails.seats') },
        { key: 'charging_ac', label: t('modelDetails.chargingAC') },
        { key: 'charging_dc', label: t('modelDetails.chargingDC') },
    ], [t]);


    if (!isOpen) return null;

    return (
        <div className={modalOverlayClass} role="dialog" aria-modal="true">
            <div className={`${modalContainerClass} max-w-7xl h-[90vh] w-full bg-navy-blue/80 backdrop-blur-2xl border border-gray-cyan/30 flex flex-col`}>
                {/* Header */}
                <div className={`${modalHeaderClass} flex-shrink-0 border-b border-white/10 p-4`}
                >
                    <div>
                        <h2 className="text-2xl font-bold text-white">{t('compare.title')}</h2>
                        <p className="text-sm text-gray-400">{t('compare.selectPrompt')}</p>
                    </div>
                    <button onClick={onClose} className={modalCloseButtonClass} aria-label="Close">
                        <X size={24} />
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-x-6 overflow-hidden p-4">
                    {/* Left: Model Selector */}
                    <div className="lg:col-span-1 flex flex-col overflow-hidden h-full">
                        <div className="relative mb-4 flex-shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder={t('compare.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-full bg-white/10 border-gray-600 rounded-md shadow-sm focus:ring-gray-cyan focus:border-gray-cyan text-white py-2.5"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                            {filteredListModels.map(model => {
                                const isSelected = selectedIds.includes(model.id);
                                const isDisabled = !isSelected && selectedIds.length >= 3;
                                return (
                                    <div key={model.id}
                                        onClick={() => !isDisabled && handleSelectModel(model.id)}
                                        className={`flex items-center p-2 rounded-lg cursor-pointer transition-all border ${
                                            isSelected ? 'bg-gray-cyan/20 border-gray-cyan' : 'bg-white/5 border-transparent hover:border-gray-600'
                                        } ${ isDisabled ? 'opacity-50 cursor-not-allowed' : '' }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={isDisabled}
                                            readOnly
                                            className="w-5 h-5 rounded text-gray-cyan bg-gray-700 border-gray-600 focus:ring-gray-cyan"
                                        />
                                        <img
                                            src={model.image_url || MODEL_PLACEHOLDER_IMAGE}
                                            alt={model.model_name}
                                            className="w-16 h-10 object-cover rounded-md mx-3"
                                        />
                                        <div className="flex-1">
                                            <p className="font-semibold text-white text-sm">{model.brand}</p>
                                            <p className="text-gray-300 text-xs">{model.model_name}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Right: Comparison Table */}
                    <div className="lg:col-span-2 overflow-auto h-full mt-4 lg:mt-0">
                        {selectedModels.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-center text-gray-400">
                                <p>{t('compare.noModelsSelected')}</p>
                            </div>
                        ) : (
                            <div className="w-full min-w-[600px]">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-navy-blue/90 backdrop-blur-sm">
                                        <tr>
                                            <th className="p-3 text-sm font-semibold text-gray-300 w-1/4">
                                                <button onClick={clearSelection} className="flex items-center gap-2 text-vivid-red hover:text-opacity-80 transition-opacity">
                                                  <Trash2 size={16}/>
                                                  {t('compare.clear')}
                                                </button>
                                            </th>
                                            {selectedModels.map(model => (
                                                <th key={model.id} className="p-3 text-center border-l border-white/10">
                                                    <img
                                                        src={model.image_url || MODEL_PLACEHOLDER_IMAGE}
                                                        alt={model.model_name}
                                                        className="w-full h-24 object-cover rounded-lg mb-2"
                                                    />
                                                    <p className="font-bold text-white text-base">{model.brand} {model.model_name}</p>
                                                     <button onClick={() => handleSelectModel(model.id)} className="text-xs text-vivid-red hover:underline mt-1">{t('compare.remove')}</button>
                                                </th>
                                            ))}
                                            {/* Fill empty columns */}
                                            {[...Array(3 - selectedModels.length)].map((_, i) => <th key={`placeholder-${i}`} className="p-3 border-l border-white/10"></th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {comparisonSpecs.map(spec => (
                                            <tr key={spec.key} className="hover:bg-white/5">
                                                <td className="p-3 text-sm font-medium text-gray-300">{spec.label}</td>
                                                {selectedModels.map(model => (
                                                    <td key={`${model.id}-${spec.key}`} className="p-3 text-center text-white border-l border-white/10">
                                                        {model[spec.key as keyof Model] ? 
                                                            `${model[spec.key as keyof Model]}${spec.unit || ''}` : 'N/A'
                                                        }
                                                    </td>
                                                ))}
                                                {[...Array(3 - selectedModels.length)].map((_, i) => <td key={`placeholder-cell-${i}`} className="p-3 border-l border-white/10"></td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComparisonModal;
