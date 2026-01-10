import { readFileSync, existsSync } from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'service-account.json');

if (existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    console.log('Service Account Project ID:', serviceAccount.project_id);
} else {
    console.log('Service Account not found.');
}
