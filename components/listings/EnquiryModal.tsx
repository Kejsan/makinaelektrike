import React, { useEffect, useMemo, useState } from 'react';
import { Send, Phone } from 'lucide-react';
import { Listing, Dealer } from '../../types';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { createEnquiry } from '../../services/enquiries';
import OptimizedImage from '../OptimizedImage';
import { DEALERSHIP_PLACEHOLDER_IMAGE } from '../../constants/media';
import ModalLayout from '../ModalLayout';

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
        company: '',
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
                company: formData.company,
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
        <ModalLayout
            isOpen={isOpen}
            onClose={onClose}
            title={t('enquiry.title')}
            description={t('enquiry.subtitle')}
            maxWidthClass="max-w-lg"
        >
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
                        <div className="hidden" aria-hidden="true">
                            <label htmlFor="enquiry-company">{t('enquiry.honeypot')}</label>
                            <input
                                id="enquiry-company"
                                type="text"
                                name="company"
                                tabIndex={-1}
                                autoComplete="off"
                                value={formData.company}
                                onChange={e => setFormData({ ...formData, company: e.target.value })}
                            />
                        </div>
                        <div>
                            <label htmlFor="enquiry-name" className="block text-gray-400 text-xs uppercase font-bold mb-2">
                                {t('common.name')}
                            </label>
                            <input
                                id="enquiry-name"
                                type="text"
                                name="name"
                                autoComplete="name"
                                required
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gray-cyan outline-none transition"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder={t('common.namePlaceholder')}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="enquiry-email" className="block text-gray-400 text-xs uppercase font-bold mb-2">
                                    {t('common.email')}
                                </label>
                                <input
                                    id="enquiry-email"
                                    type="email"
                                    name="email"
                                    autoComplete="email"
                                    required
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gray-cyan outline-none transition"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder={t('enquiry.emailPlaceholder')}
                                />
                            </div>
                            <div>
                                <label htmlFor="enquiry-phone" className="block text-gray-400 text-xs uppercase font-bold mb-2">
                                    {t('common.phone')}
                                </label>
                                <input
                                    id="enquiry-phone"
                                    type="tel"
                                    name="phone"
                                    autoComplete="tel"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gray-cyan outline-none transition"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder={t('enquiry.phonePlaceholder')}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="enquiry-message" className="block text-gray-400 text-xs uppercase font-bold mb-2">
                                {t('common.message')}
                            </label>
                            <textarea
                                id="enquiry-message"
                                name="message"
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
        </ModalLayout>
    );
};

export default EnquiryModal;
