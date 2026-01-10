import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'service-account.json');

if (!existsSync(serviceAccountPath)) {
    console.error('❌ Missing service-account.json!');
    process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

async function listBuckets() {
    try {
        console.log('🔍 Listing buckets...');
        const [buckets] = await admin.storage().getBuckets();
        if (buckets.length === 0) {
            console.log('⚠️ No buckets found.');
        } else {
            console.log('✅ Available buckets:');
            buckets.forEach(b => console.log(`- ${b.name}`));
        }
    } catch (error) {
        console.error('❌ Failed to list buckets:', error);
    }
}

listBuckets();
