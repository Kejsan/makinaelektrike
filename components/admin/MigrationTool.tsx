import React, { useState } from 'react';
import { collection, doc, getDocs, writeBatch, query, orderBy } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import blogPosts from '../../data/blogPosts';
import { chargingStationsData } from '../../data/chargingStationsData';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Download, Database, FileJson, FileSpreadsheet, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export const MigrationTool: React.FC = () => {
    const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' | null }>({ message: '', type: null });
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState<string | null>(null);

    const showStatus = (message: string, type: 'info' | 'success' | 'error') => {
        setStatus({ message, type });
        if (type === 'success') {
            setTimeout(() => setStatus({ message: '', type: null }), 5000);
        }
    };

    const migrateBlogPosts = async () => {
        setLoading(true);
        showStatus('Migrating blog posts...', 'info');
        try {
            const batch = writeBatch(firestore);
            blogPosts.forEach((post) => {
                const docRef = doc(collection(firestore, 'blogPosts'), post.id);
                batch.set(docRef, post);
            });
            await batch.commit();
            showStatus('Blog posts migrated successfully!', 'success');
        } catch (error: any) {
            showStatus('Error migrating blog posts: ' + error.message, 'error');
        }
        setLoading(false);
    };

    const migrateChargingStations = async () => {
        setLoading(true);
        showStatus('Migrating charging stations...', 'info');
        try {
            const batch = writeBatch(firestore);
            chargingStationsData.forEach((station) => {
                const docRef = doc(collection(firestore, 'charging_stations'), String(station.id));
                batch.set(docRef, station);
            });
            await batch.commit();
            showStatus('Charging stations migrated successfully!', 'success');
        } catch (error: any) {
            showStatus('Error migrating charging stations: ' + error.message, 'error');
        }
        setLoading(false);
    };

    const exportData = async (type: 'dealers' | 'models' | 'listings' | 'blogPosts' | 'charging_stations', format: 'json' | 'csv' | 'xlsx' | 'pdf') => {
        setExportLoading(`${type}-${format}`);
        try {
            let collectionName = type;
            if (type === 'charging_stations') collectionName = 'charging_stations';
            
            const q = query(collection(firestore, collectionName));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (data.length === 0) {
                showStatus(`No data found for ${type}`, 'error');
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `export-${type}-${timestamp}`;

            if (format === 'json') {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                downloadFile(blob, `${filename}.json`);
            } else if (format === 'csv') {
                const csv = Papa.unparse(data);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                downloadFile(blob, `${filename}.csv`);
            } else if (format === 'xlsx') {
                const worksheet = XLSX.utils.json_to_sheet(data);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
                XLSX.writeFile(workbook, `${filename}.xlsx`);
            } else if (format === 'pdf') {
                generatePDF(data, type);
            }

            showStatus(`Exported ${data.length} items to ${format.toUpperCase()}`, 'success');
        } catch (error: any) {
            showStatus(`Export failed: ${error.message}`, 'error');
        } finally {
            setExportLoading(null);
        }
    };

    const downloadFile = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const generatePDF = (data: any[], type: string) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const headers = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
        
        const html = `
            <html>
                <head>
                    <title>Export ${type}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        h1 { color: #0b132b; text-transform: capitalize; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { bg-color: #f2f2f2; }
                        tr:nth-child(even) { background-color: #f9f9f9; }
                    </style>
                </head>
                <body>
                    <h1>${type.replace(/_/g, ' ')} Data Export</h1>
                    <p>Generated on: ${new Date().toLocaleString()}</p>
                    <table>
                        <thead>
                            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${data.map(row => `
                                <tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    };

    const exportOptions = [
        { id: 'dealers', label: 'Dealers', icon: <Database size={18} /> },
        { id: 'models', label: 'Models', icon: <Database size={18} /> },
        { id: 'listings', label: 'Listings', icon: <Database size={18} /> },
        { id: 'blogPosts', label: 'Blog Posts', icon: <Database size={18} /> },
        { id: 'charging_stations', label: 'Charging Stations', icon: <Database size={18} /> },
    ] as const;

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto pb-20">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-white mb-2">Data Management Center</h1>
                <p className="text-gray-400">Manage database migrations and export platform data in multiple formats.</p>
            </div>

            {status.message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 border ${
                    status.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                    status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
                    'bg-blue-500/10 border-blue-500/20 text-blue-400'
                }`}>
                    {status.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    <span className="font-medium text-sm">{status.message}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Migration Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-vivid-red/10 rounded-lg text-vivid-red">
                                <Database size={20} />
                            </div>
                            <h2 className="text-xl font-bold text-white">Initial Seed</h2>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">
                            Migrate hardcoded data from local files into your Firestore database. Use this for fresh installations.
                        </p>
                        
                        <div className="space-y-3">
                            <button
                                onClick={migrateBlogPosts}
                                disabled={loading}
                                className="w-full py-3 px-4 bg-white/5 border border-white/10 text-white rounded-xl font-semibold hover:bg-white/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                                Seed Blog Posts ({blogPosts.length})
                            </button>

                            <button
                                onClick={migrateChargingStations}
                                disabled={loading}
                                className="w-full py-3 px-4 bg-white/5 border border-white/10 text-white rounded-xl font-semibold hover:bg-white/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                                Seed Charging Stations ({chargingStationsData.length})
                            </button>
                        </div>
                    </div>
                </div>

                {/* Export Section */}
                <div className="lg:col-span-2">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-gray-cyan/10 rounded-lg text-gray-cyan">
                                <Download size={20} />
                            </div>
                            <h2 className="text-xl font-bold text-white">Export Platform Data</h2>
                        </div>

                        <div className="space-y-4">
                            {exportOptions.map((option) => (
                                <div key={option.id} className="p-4 rounded-xl bg-black/20 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="text-gray-400">{option.icon}</div>
                                        <span className="font-semibold text-white capitalize">{option.label}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {(['json', 'csv', 'xlsx', 'pdf'] as const).map((format) => (
                                            <button
                                                key={format}
                                                onClick={() => exportData(option.id as any, format)}
                                                disabled={exportLoading !== null}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                    exportLoading === `${option.id}-${format}` 
                                                    ? 'bg-gray-cyan/20 text-gray-cyan' 
                                                    : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/5'
                                                }`}
                                            >
                                                {exportLoading === `${option.id}-${format}` ? (
                                                    <Loader2 size={12} className="animate-spin" />
                                                ) : format === 'json' ? (
                                                    <FileJson size={12} />
                                                ) : format === 'xlsx' ? (
                                                    <FileSpreadsheet size={12} />
                                                ) : (
                                                    <FileText size={12} />
                                                )}
                                                {format.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
