import React, { useState } from 'react';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import blogPosts from '../../data/blogPosts';
import { chargingStationsData } from '../../data/chargingStationsData';

export const MigrationTool: React.FC = () => {
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const migrateBlogPosts = async () => {
        setLoading(true);
        setStatus('Migrating blog posts...');
        try {
            const batch = writeBatch(firestore);
            blogPosts.forEach((post) => {
                const docRef = doc(collection(firestore, 'blogPosts'), post.id);
                batch.set(docRef, post);
            });
            await batch.commit();
            setStatus('Blog posts migrated successfully!');
        } catch (error: any) {
            setStatus('Error migrating blog posts: ' + error.message);
        }
        setLoading(false);
    };

    const migrateChargingStations = async () => {
        setLoading(true);
        setStatus('Migrating charging stations...');
        try {
            const batch = writeBatch(firestore);
            chargingStationsData.forEach((station) => {
                // Ensure ID is a string
                const docRef = doc(collection(firestore, 'charging_stations'), String(station.id));
                batch.set(docRef, station);
            });
            await batch.commit();
            setStatus('Charging stations migrated successfully!');
        } catch (error: any) {
            setStatus('Error migrating charging stations: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="p-8 max-w-2xl mx-auto bg-white rounded-xl shadow-lg mt-10">
            <h1 className="text-2xl font-bold mb-6 text-navy-blue">Database Migration Tool</h1>
            <p className="mb-6 text-gray-600">
                This tool will migrate hardcoded data from the files into your Firestore database.
                Make sure you are logged in as an admin.
            </p>
            
            <div className="space-y-4">
                <button
                    onClick={migrateBlogPosts}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-vivid-red text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                    Migrate Blog Posts ({blogPosts.length})
                </button>

                <button
                    onClick={migrateChargingStations}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-navy-blue text-white rounded-lg font-semibold hover:bg-blue-900 transition-colors disabled:opacity-50"
                >
                    Migrate Charging Stations ({chargingStationsData.length})
                </button>
            </div>

            {status && (
                <div className={`mt-6 p-4 rounded-lg ${status.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {status}
                </div>
            )}
        </div>
    );
};
