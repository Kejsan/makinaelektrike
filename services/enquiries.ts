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

export const createEnquiry = async (enquiry: Omit<Enquiry, 'id' | 'createdAt' | 'status'>): Promise<void> => {
    await addDoc(enquiriesCollection, {
        ...enquiry,
        status: 'new',
        createdAt: serverTimestamp(),
    });
};

const mapEnquiries = createCollectionMapper<Enquiry>();

export const subscribeToDealerEnquiries = (
    dealerId: string,
    options: SubscriptionOptions<Enquiry>
): Unsubscribe => {
    const q = query(
        enquiriesCollection,
        where('dealerId', '==', dealerId),
        orderBy('createdAt', 'desc')
    );
    return subscribeToCollection(q, mapEnquiries, options);
};
