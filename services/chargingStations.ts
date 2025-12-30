import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
    Timestamp,
} from 'firebase/firestore';
import { firestore } from './firebase';
import type {
    ChargingStation,
    ChargingStationDocument,
    ChargingStationFormValues,
} from '../types';

const COLLECTION_NAME = 'charging_stations';

/**
 * Fetch all custom charging stations from Firestore
 */
export const fetchChargingStations = async (): Promise<ChargingStation[]> => {
    try {
        const stationsCollection = collection(firestore, COLLECTION_NAME);
        const q = query(stationsCollection, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as ChargingStation[];
    } catch (error) {
        console.error('Error fetching charging stations:', error);
        throw new Error('Failed to fetch charging stations');
    }
};

/**
 * Create a new charging station
 */
export const createChargingStation = async (
    values: ChargingStationFormValues,
    userId: string
): Promise<ChargingStation> => {
    try {
        const docData: ChargingStationDocument = {
            address: values.address.trim(),
            plugTypes: values.plugTypes.trim(),
            chargingSpeedKw: Number(values.chargingSpeedKw),
            operator: values.operator.trim() || null,
            pricingDetails: values.pricingDetails.trim() || null,
            googleMapsLink: values.googleMapsLink.trim() || null,
            latitude: values.latitude !== '' ? Number(values.latitude) : null,
            longitude: values.longitude !== '' ? Number(values.longitude) : null,
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
            createdBy: userId,
            updatedBy: userId,
        };

        const stationsCollection = collection(firestore, COLLECTION_NAME);
        const docRef = await addDoc(stationsCollection, docData);

        return {
            id: docRef.id,
            ...docData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };
    } catch (error) {
        console.error('Error creating charging station:', error);
        throw new Error('Failed to create charging station');
    }
};

/**
 * Update an existing charging station
 */
export const updateChargingStation = async (
    stationId: string,
    values: ChargingStationFormValues,
    userId: string
): Promise<void> => {
    try {
        const docRef = doc(firestore, COLLECTION_NAME, stationId);

        const updateData: Partial<ChargingStationDocument> = {
            address: values.address.trim(),
            plugTypes: values.plugTypes.trim(),
            chargingSpeedKw: Number(values.chargingSpeedKw),
            operator: values.operator.trim() || null,
            pricingDetails: values.pricingDetails.trim() || null,
            googleMapsLink: values.googleMapsLink.trim() || null,
            latitude: values.latitude !== '' ? Number(values.latitude) : null,
            longitude: values.longitude !== '' ? Number(values.longitude) : null,
            updatedAt: serverTimestamp() as Timestamp,
            updatedBy: userId,
        };

        await updateDoc(docRef, updateData);
    } catch (error) {
        console.error('Error updating charging station:', error);
        throw new Error('Failed to update charging station');
    }
};

/**
 * Delete a charging station
 */
export const deleteChargingStation = async (stationId: string): Promise<void> => {
    try {
        const docRef = doc(firestore, COLLECTION_NAME, stationId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting charging station:', error);
        throw new Error('Failed to delete charging station');
    }
};

/**
 * Convert a custom charging station to OCM-compatible format for map display
 */
export const convertToOCMFormat = (station: ChargingStation) => {
    // Skip stations without valid coordinates
    if (station.latitude === null || station.longitude === null) {
        return null;
    }

    // Generate a numeric ID from the string ID for OCM compatibility using a simple hash
    const hash = station.id.split('').reduce((acc, char) => {
        const code = char.charCodeAt(0);
        return ((acc << 5) - acc) + code | 0;
    }, 0);
    const numericId = Math.abs(hash) + 1000000;

    return {
        type: 'Feature' as const,
        geometry: {
            type: 'Point' as const,
            coordinates: [station.longitude, station.latitude],
        },
        properties: {
            id: numericId,
            title: station.address,
            addressInfo: {
                title: station.address,
                addressLine1: station.address,
                town: '',
                stateOrProvince: 'Albania',
                postcode: '',
                latitude: station.latitude,
                longitude: station.longitude,
            },
            connections: [
                {
                    id: 1,
                    connectionType: {
                        id: 1,
                        title: station.plugTypes,
                    },
                    level: {
                        id: 1,
                        title: 'Fast',
                    },
                    powerKW: station.chargingSpeedKw,
                    quantity: 1,
                },
            ],
            statusType: {
                id: 50,
                title: 'Operational',
            },
            usageType: {
                id: 1,
                title: 'Public',
            },
            usageCost: station.pricingDetails || undefined,
            operatorInfo: {
                id: 1,
                title: station.operator || 'Custom Station',
            },
            dateLastVerified: station.updatedAt?.toDate().toISOString(),
            // Custom flag to identify this as a custom station
            isCustomStation: true,
            customStationData: {
                googleMapsLink: station.googleMapsLink,
            },
        },
    };
};

/**
 * Merge custom stations with OCM stations
 */
export const mergeStationsWithOCM = (
    customStations: ChargingStation[],
    ocmStations: any[]
) => {
    // Convert custom stations to OCM format
    const convertedCustomStations = customStations
        .map(convertToOCMFormat)
        .filter((station): station is NonNullable<ReturnType<typeof convertToOCMFormat>> => station !== null);

    // Combine both arrays
    return [...ocmStations, ...convertedCustomStations];
};
