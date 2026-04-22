import {
    addDoc,
    collection,
    query,
    where,
    orderBy,
    serverTimestamp,
    type Unsubscribe,
} from 'firebase/firestore';
import { firestore } from './firebase';
import { createCollectionMapper, subscribeToCollection, type SubscriptionOptions } from './api';
import type { Enquiry } from '../types';

const enquiriesCollection = collection(firestore, 'enquiries');

const createEnquiryDirect = async (
    enquiry: Omit<Enquiry, 'id' | 'createdAt' | 'status'>
): Promise<void> => {
    await addDoc(enquiriesCollection, {
        ...enquiry,
        status: 'new',
        createdAt: serverTimestamp(),
    });
};

const readFunctionError = async (response: Response) => {
    try {
        const payload = (await response.json()) as { error?: string };
        return payload.error || response.statusText;
    } catch {
        return response.statusText || 'Request failed.';
    }
};

export const createEnquiry = async (enquiry: Omit<Enquiry, 'id' | 'createdAt' | 'status'>): Promise<void> => {
    const response = await fetch('/.netlify/functions/create-enquiry', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(enquiry),
    });

    if (response.ok) {
        return;
    }

    if (import.meta.env.DEV && response.status === 503) {
        await createEnquiryDirect(enquiry);
        return;
    }

    throw new Error(await readFunctionError(response));
};

const mapEnquiries = createCollectionMapper<Enquiry>();

export const subscribeToDealerEnquiries = (
    dealerId: string,
    options: SubscriptionOptions<Enquiry>
): Unsubscribe => {
    const q = query(
        enquiriesCollection,
        where('dealerId', '==', dealerId)
    );
    return subscribeToCollection(q, mapEnquiries, options);
};
