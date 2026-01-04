import admin from 'firebase-admin';
import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

interface DealerRecord {
    ownerUid?: string | null;
}

interface ListingRecord {
    dealerId?: string;
    ownerUid?: string;
}

async function backfillDealerIds() {
    const serviceAccountPath = path.join(process.cwd(), 'service-account.json');

    if (!existsSync(serviceAccountPath)) {
        console.error('❌ Missing service-account.json!');
        console.log('\nTo run this script:');
        console.log('1. Download a Service Account key from Firebase Console > Project Settings > Service Accounts');
        console.log('2. Save it as "service-account.json" in the project root:', process.cwd());
        process.exit(1);
    }

    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });

    const db = admin.firestore();

    console.log('🔍 Loading dealer records...');
    const dealersSnapshot = await db.collection('dealers').get();

    const ownerToDealerIds = new Map<string, string[]>();
    dealersSnapshot.forEach(doc => {
        const data = doc.data() as DealerRecord;
        const ownerUid = data.ownerUid?.trim();
        if (!ownerUid) return;

        const existing = ownerToDealerIds.get(ownerUid) ?? [];
        existing.push(doc.id);
        ownerToDealerIds.set(ownerUid, existing);
    });

    console.log(`Found ${ownerToDealerIds.size} owners with dealer records.`);

    console.log('🚚 Scanning listings for mismatched dealerId values...');
    const listingsSnapshot = await db.collection('listings').get();

    let updated = 0;
    let skippedAmbiguous = 0;
    let alreadyAligned = 0;

    for (const doc of listingsSnapshot.docs) {
        const data = doc.data() as ListingRecord;
        const currentDealerId = data.dealerId?.trim();
        if (!currentDealerId) continue;

        const mappedDealers = ownerToDealerIds.get(currentDealerId);
        if (!mappedDealers) continue; // dealerId already a dealer doc ID or unknown owner

        if (mappedDealers.length !== 1) {
            skippedAmbiguous++;
            console.warn(`⚠️ Ambiguous owner mapping for listing ${doc.id} (owner ${currentDealerId}). Skipping.`);
            continue;
        }

        const correctedDealerId = mappedDealers[0];

        if (correctedDealerId === currentDealerId) {
            alreadyAligned++;
            continue;
        }

        await doc.ref.update({
            dealerId: correctedDealerId,
            ownerUid: data.ownerUid ?? currentDealerId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        updated++;
        console.log(`✅ Updated listing ${doc.id}: dealerId ${currentDealerId} -> ${correctedDealerId}`);
    }

    console.log('\n=== Backfill Summary ===');
    console.log(`Listings checked: ${listingsSnapshot.size}`);
    console.log(`Updated: ${updated}`);
    console.log(`Already aligned: ${alreadyAligned}`);
    console.log(`Skipped (ambiguous owners): ${skippedAmbiguous}`);
}

backfillDealerIds()
    .then(() => {
        console.log('Backfill complete.');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Backfill failed:', error);
        process.exit(1);
    });
