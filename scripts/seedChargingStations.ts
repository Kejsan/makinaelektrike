import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { chargingStationsData } from '../data/chargingStationsData';

// Firebase configuration - you'll need to set these environment variables
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

async function seedChargingStations() {
    console.log('Starting charging stations migration...');
    console.log(`Total stations to migrate: ${chargingStationsData.length}`);

    const stationsCollection = collection(firestore, 'charging_stations');
    let successCount = 0;
    let errorCount = 0;

    for (const station of chargingStationsData) {
        try {
            const docData = {
                address: station.address,
                plugTypes: station.plugTypes,
                chargingSpeedKw: station.chargingSpeedKw,
                pricingDetails: station.pricingDetails,
                googleMapsLink: station.googleMapsLink,
                latitude: station.latitude,
                longitude: station.longitude,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: 'migration_script',
                updatedBy: 'migration_script',
            };

            await addDoc(stationsCollection, docData);
            successCount++;
            console.log(`✓ Added: ${station.address}`);
        } catch (error) {
            errorCount++;
            console.error(`✗ Failed to add ${station.address}:`, error);
        }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total: ${chargingStationsData.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('=========================\n');

    if (successCount === chargingStationsData.length) {
        console.log('✅ All stations migrated successfully!');
    } else {
        console.log('⚠️  Some stations failed to migrate. Check errors above.');
    }

    process.exit(errorCount > 0 ? 1 : 0);
}

seedChargingStations().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
});
