import admin from 'firebase-admin';
import { chargingStationsData } from '../data/chargingStationsData';
import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

async function seedChargingStations() {
    console.log('🚀 Starting secure charging stations migration (Admin SDK)...');
    console.log(`Total stations to migrate: ${chargingStationsData.length}`);

    const serviceAccountPath = path.join(process.cwd(), 'service-account.json');

    if (existsSync(serviceAccountPath)) {
        console.log('🔑 Using service-account.json for authentication...');
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        console.error('❌ Missing service-account.json!');
        console.log('\nTo run this script securely without changing database rules:');
        console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
        console.log('2. Click "Generate new private key"');
        console.log('3. Rename the downloaded file to "service-account.json"');
        console.log('4. Place it in the root directory: ' + process.cwd());
        process.exit(1);
    }

    const db = admin.firestore();
    const stationsCollection = db.collection('charging_stations');

    let successCount = 0;
    let errorCount = 0;

    for (const station of chargingStationsData) {
        try {
            // Check if station already exists by coordinates or address to prevent duplicates
            const existing = await stationsCollection
                .where('latitude', '==', station.latitude)
                .where('longitude', '==', station.longitude)
                .get();

            if (!existing.empty) {
                console.log(`⏭️ Skipping (already exists): ${station.address}`);
                continue;
            }

            const docData = {
                address: station.address,
                plugTypes: station.plugTypes,
                chargingSpeedKw: station.chargingSpeedKw,
                pricingDetails: station.pricingDetails,
                googleMapsLink: station.googleMapsLink,
                latitude: station.latitude,
                longitude: station.longitude,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: 'migration_script_admin',
                updatedBy: 'migration_script_admin',
            };

            await stationsCollection.add(docData);
            successCount++;
            console.log(`✓ Added: ${station.address}`);
        } catch (error) {
            errorCount++;
            console.error(`✗ Failed to add ${station.address}:`, error);
        }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total stations: ${chargingStationsData.length}`);
    console.log(`Newly added: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('=========================\n');

    if (errorCount === 0) {
        console.log('✅ Migration completed successfully!');
    } else {
        console.log('⚠️ Migration finished with errors.');
    }

    process.exit(errorCount > 0 ? 1 : 0);
}

seedChargingStations().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});
