import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
    type DocumentData,
    type QuerySnapshot,
    type Unsubscribe,
} from 'firebase/firestore';
import { firestore } from './firebase';
import {
    createCollectionMapper,
    subscribeToCollection,
    type SubscriptionOptions,
} from './api';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Listing } from '../types';
import { omitUndefined } from '../utils/object';

const listingsCollection = collection(firestore, 'listings');

const mapListingsRaw = createCollectionMapper<Listing>();

const normalizeListingStatus = (listing: Listing): Listing => {
    return listing;
    // logic can be expanded if needed like in dealers
};

const mapListings = (snapshot: QuerySnapshot<DocumentData>): Listing[] =>
    mapListingsRaw(snapshot).map(normalizeListingStatus);

export const listListings = async (): Promise<Listing[]> => {
    const snapshot = await getDocs(query(listingsCollection, orderBy('createdAt', 'desc')));
    return mapListings(snapshot);
};

export const getListingById = async (id: string): Promise<Listing | null> => {
    const snapshot = await getDoc(doc(listingsCollection, id));
    if (!snapshot.exists()) {
        return null;
    }
    return normalizeListingStatus({ id: snapshot.id, ...(snapshot.data() as Omit<Listing, 'id'>) });
};

export const createListing = async (payload: Omit<Listing, 'id'>): Promise<Listing> => {
    const sanitizedPayload = omitUndefined(payload as Record<string, unknown>);

    const docRef = await addDoc(listingsCollection, {
        ...sanitizedPayload,
        status: 'pending', // Default status
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        approvedAt: null,
        rejectedAt: null,
    });

    const snapshot = await getDoc(docRef);
    return normalizeListingStatus({ id: snapshot.id, ...(snapshot.data() as Listing) });
};

export const updateListing = async (id: string, updates: Partial<Listing>): Promise<Listing> => {
    const listingRef = doc(listingsCollection, id);
    const sanitizedUpdates = omitUndefined(updates as Record<string, unknown>);

    await updateDoc(listingRef, {
        ...sanitizedUpdates,
        updatedAt: serverTimestamp()
    });

    const snapshot = await getDoc(listingRef);
    return normalizeListingStatus({ id: snapshot.id, ...(snapshot.data() as Listing) });
};

export const deleteListing = async (id: string): Promise<void> => {
    // Soft delete or hard delete? User req said "status control for dealers to mark listings active/inactive" but also "Delete".
    // Let's implement soft delete for safety if status defaults to deleted, or hard delete.
    // Given the other entities use soft delete often, let's stick to updating status to deleted OR actual delete.
    // Requirement says: "Delete". Existing code does hard delete for models, soft for dealers.
    // Let's go with hard delete for now to keep it simple, or soft delete if we want to keep history.
    // Let's do a hard delete for now if it's draft, but maybe soft delete if it was active.
    // Actually, let's just use deleteDoc for simplicity as requested "deleteListing(id)".
    await deleteDoc(doc(listingsCollection, id));
};

export const approveListing = async (id: string): Promise<Listing> => {
    const listingRef = doc(listingsCollection, id);
    await updateDoc(listingRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        rejectedAt: null,
        rejectionReason: null,
        updatedAt: serverTimestamp(),
    });
    const snapshot = await getDoc(listingRef);
    return normalizeListingStatus({ id: snapshot.id, ...(snapshot.data() as Listing) });
};

export const rejectListing = async (id: string, reason?: string): Promise<Listing> => {
    const listingRef = doc(listingsCollection, id);
    await updateDoc(listingRef, {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectionReason: reason || null,
        approvedAt: null,
        updatedAt: serverTimestamp(),
    });
    const snapshot = await getDoc(listingRef);
    return normalizeListingStatus({ id: snapshot.id, ...(snapshot.data() as Listing) });
};

export const subscribeToListings = (
    options: SubscriptionOptions<Listing>,
): Unsubscribe => {
    const q = query(listingsCollection, orderBy('createdAt', 'desc'));
    return subscribeToCollection(q, mapListings, options);
};

export const subscribeToApprovedListings = (
    options: SubscriptionOptions<Listing>,
): Unsubscribe => {
    // Only show active and approved listings
    const q = query(listingsCollection, where('status', '==', 'approved')); // simplified, might want compound query later
    // Client side filtering for extra safety if needed or compound index
    return subscribeToCollection(q, mapListings, options);
};

export const subscribeToListingsByDealer = (
    dealerId: string,
    options: SubscriptionOptions<Listing>,
): Unsubscribe => {
    const q = query(listingsCollection, where('dealerId', '==', dealerId));
    return subscribeToCollection(q, mapListings, options);
};

export const uploadListingImage = async (userId: string, listingId: string, file: File): Promise<string> => {
    const path = `listings/${userId}/${listingId}/main_${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

export const uploadListingGalleryImage = async (userId: string, listingId: string, file: File): Promise<string> => {
    const path = `listings/${userId}/${listingId}/gallery_${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};
