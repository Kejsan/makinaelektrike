import React, { useEffect, useMemo, useState } from 'react';
import { X, Send, Phone, MessageSquare } from 'lucide-react';
import { Listing, Dealer } from '../../types';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { createEnquiry } from '../../services/enquiries';
import OptimizedImage from '../OptimizedImage';
import { DEALERSHIP_PLACEHOLDER_IMAGE } from '../../constants/media';

interface EnquiryModalProps {
    listing: Listing;
    dealer: Dealer | undefined;
    isOpen: boolean;
    onClose: () => void;
}

const EnquiryModal: React.FC<EnquiryModalProps> = ({ listing, dealer, isOpen, onClose }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const initialFormData = useMemo(() => ({
        name: '',
        email: '',
        phone: '',
        message: t('enquiry.defaultMessage', {
            make: listing.make,
            model: listing.model
        })
    }), [listing.make, listing.model, t]);
    const [formData, setFormData] = useState(initialFormData);

    useEffect(() => {
        if (isOpen) {
            setFormData(initialFormData);
        }
    }, [initialFormData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await createEnquiry({
                listingId: listing.id,
                dealerId: listing.dealerId,
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                message: formData.message,
            });

            addToast(t('enquiry.success'), 'success');
            setFormData(initialFormData);
            onClose();
        } catch (error) {
            console.error('Error sending enquiry:', error);
            addToast(
                error instanceof Error
                    ? error.message
                    : t('enquiry.error'),
                'error'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
            <div className="flex min-h-full items-start justify-center py-6 sm:items-center">
            <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
                >
                    <X size={24} />
                </button>

                <div className="overflow-y-auto p-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {t('enquiry.title')}
                    </h2>
                    <p className="text-gray-400 text-sm mb-6">
                        {t('enquiry.subtitle')}
                    </p>

                    {dealer && (
                        <div className="flex items-center gap-4 mb-6 p-4 bg-white/5 rounded-xl border border-white/5">
                            <OptimizedImage
                                src={dealer.logo_url || dealer.image_url || DEALERSHIP_PLACEHOLDER_IMAGE}
                                alt={dealer.name}
                                fallbackSrc={DEALERSHIP_PLACEHOLDER_IMAGE}
                                className="w-12 h-12 rounded-full object-cover bg-white"
                            />
                            <div>
                                <h3 className="font-bold text-white">{dealer.name}</h3>
                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                                    {dealer.contact_phone && (
                                        <a href={`tel:${dealer.contact_phone}`} className="flex items-center gap-1 hover:text-gray-cyan transition">
                                            <Phone size={14} /> {dealer.contact_phone}
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-gray-400 text-xs uppercase font-bold mb-2">
                                {t('common.name')}
                            </label>
                            <input
                                type="text"
                                required
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gray-cyan outline-none transition"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder={t('common.namePlaceholder')}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-400 text-xs uppercase font-bold mb-2">
                                    {t('common.email')}
                                </label>
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gray-cyan outline-none transition"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="name@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-xs uppercase font-bold mb-2">
                                    {t('common.phone')}
                                </label>
                                <input
                                    type="tel"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gray-cyan outline-none transition"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+355 69..."
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs uppercase font-bold mb-2">
                                {t('common.message')}
                            </label>
                            <textarea
                                required
                                rows={4}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gray-cyan outline-none transition resize-none"
                                value={formData.message}
                                onChange={e => setFormData({ ...formData, message: e.target.value })}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-gray-cyan text-gray-900 font-bold rounded-xl hover:bg-cyan-400 transition flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Send size={20} />
                                    {t('enquiry.send')}
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
            </div>
        </div>
    );
};

export default EnquiryModal;
