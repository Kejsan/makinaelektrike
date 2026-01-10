import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'service-account.json');

console.log('Checking service account...');
if (!existsSync(serviceAccountPath)) {
    console.error('❌ Missing service-account.json at', serviceAccountPath);
    process.exit(1);
}

try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    console.log('✅ Service account loaded.');
    console.log('Project ID:', serviceAccount.project_id);
    console.log('Client Email:', serviceAccount.client_email);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });

    console.log('Initialized Firebase Admin.');

    admin.storage().getBuckets()
        .then(([buckets]) => {
            console.log('✅ Buckets found:', buckets.length);
            buckets.forEach(b => console.log(`- ${b.name}`));
        })
        .catch(error => {
            console.error('❌ Failed to list buckets.');
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            if (error.errors) {
                console.error('Detailed errors:', JSON.stringify(error.errors, null, 2));
            }
        });

} catch (err) {
    console.error('❌ Script failed:', err);
}
