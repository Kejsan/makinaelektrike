import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChargingStation, ChargingStationFormValues } from '../../types';

interface ChargingStationFormProps {
    initialValues?: ChargingStation;
    onSubmit: (values: ChargingStationFormValues) => void | Promise<void>;
    onCancel: () => void;
    isSubmitting?: boolean;
}

const defaultState: ChargingStationFormValues = {
    address: '',
    plugTypes: '',
    chargingSpeedKw: '',
    operator: '',
    pricingDetails: '',
    googleMapsLink: '',
    latitude: '',
    longitude: '',
};

const isValidUrl = (value: string) => {
    if (!value) return true;
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
};

const isValidCoordinate = (value: string | number, min: number, max: number) => {
    if (value === '') return true;
    const num = Number(value);
    return !Number.isNaN(num) && num >= min && num <= max;
};

const ChargingStationForm: React.FC<ChargingStationFormProps> = ({
    initialValues,
    onSubmit,
    onCancel,
    isSubmitting,
}) => {
    const { t } = useTranslation();
    const [formState, setFormState] = useState<ChargingStationFormValues>(defaultState);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!initialValues) {
            setFormState(defaultState);
            return;
        }

        setFormState({
            address: initialValues.address ?? '',
            plugTypes: initialValues.plugTypes ?? '',
            chargingSpeedKw: initialValues.chargingSpeedKw ?? '',
            operator: initialValues.operator ?? '',
            pricingDetails: initialValues.pricingDetails ?? '',
            googleMapsLink: initialValues.googleMapsLink ?? '',
            latitude: initialValues.latitude ?? '',
            longitude: initialValues.longitude ?? '',
        });
    }, [initialValues]);

    const handleChange = (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = event.target;
        setFormState(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const validate = () => {
        const nextErrors: Record<string, string> = {};

        // Required fields
        if (!formState.address.trim()) {
            nextErrors.address = 'Address is required';
        } else if (formState.address.trim().length < 5) {
            nextErrors.address = 'Address must be at least 5 characters';
        }

        if (!formState.plugTypes.trim()) {
            nextErrors.plugTypes = 'Plug types are required';
        }

        if (!formState.chargingSpeedKw || formState.chargingSpeedKw === '') {
            nextErrors.chargingSpeedKw = 'Charging speed is required';
        } else if (Number(formState.chargingSpeedKw) <= 0) {
            nextErrors.chargingSpeedKw = 'Charging speed must be greater than 0';
        }

        // Optional but validated fields
        if (formState.googleMapsLink && !isValidUrl(formState.googleMapsLink)) {
            nextErrors.googleMapsLink = 'Enter a valid URL';
        }

        if (formState.latitude !== '' && !isValidCoordinate(formState.latitude, -90, 90)) {
            nextErrors.latitude = 'Latitude must be between -90 and 90';
        }

        if (
            formState.longitude !== '' &&
            !isValidCoordinate(formState.longitude, -180, 180)
        ) {
            nextErrors.longitude = 'Longitude must be between -180 and 180';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!validate()) {
            return;
        }

        await onSubmit(formState);
    };

    const renderInput = (
        label: string,
        name: keyof ChargingStationFormValues,
        type: string = 'text',
        placeholder?: string,
        options?: { isTextArea?: boolean; rows?: number; step?: string }
    ) => {
        const error = errors[name as string];
        const commonProps = {
            name,
            value: formState[name],
            onChange: handleChange,
            placeholder,
            className:
                'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-cyan',
        } as const;

        return (
            <label className="block text-sm text-gray-300">
                <span className="mb-1 inline-block font-medium">{label}</span>
                {options?.isTextArea ? (
                    <textarea rows={options.rows ?? 4} {...commonProps} />
                ) : (
                    <input
                        type={type}
                        step={options?.step}
                        {...commonProps}
                    />
                )}
                {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
            </label>
        );
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    {renderInput('Address *', 'address', 'text', 'e.g., Autostrada, Durrës')}
                </div>

                {renderInput('Plug Types *', 'plugTypes', 'text', 'e.g., CCS2, GB/T')}
                {renderInput('Operator', 'operator', 'text', 'e.g., iCharge Albania')}
                {renderInput('Charging Speed (kW) *', 'chargingSpeedKw', 'number', '60', { step: '0.1' })}

                <div className="sm:col-span-2">
                    {renderInput(
                        'Pricing Details',
                        'pricingDetails',
                        'text',
                        'e.g., 40 lek/kWh',
                        { isTextArea: true, rows: 3 }
                    )}
                </div>

                <div className="sm:col-span-2">
                    {renderInput(
                        'Google Maps Link',
                        'googleMapsLink',
                        'url',
                        'https://maps.app.goo.gl/...'
                    )}
                </div>

                {renderInput('Latitude', 'latitude', 'number', '41.3275', { step: 'any' })}
                {renderInput('Longitude', 'longitude', 'number', '19.8187', { step: 'any' })}
            </div>

            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-200">
                <p className="font-semibold">Tip: Getting Coordinates</p>
                <p className="mt-1 text-xs text-blue-300">
                    Right-click on Google Maps and select "What's here?" to get precise latitude and
                    longitude coordinates.
                </p>
            </div>

            <div className="flex justify-end space-x-3">
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

export default ChargingStationForm;
