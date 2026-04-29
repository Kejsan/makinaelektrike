import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, doc, getDocs, writeBatch, query } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import blogPosts from '../../data/blogPosts';
import { chargingStationsData } from '../../data/chargingStationsData';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Download, Database, FileJson, FileSpreadsheet, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export const MigrationTool: React.FC = () => {
    const { t } = useTranslation();
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
        showStatus(t('admin.migration.migratingBlogPosts', { defaultValue: 'Migrating blog posts...' }), 'info');
        try {
            const batch = writeBatch(firestore);
            blogPosts.forEach((post) => {
                const docRef = doc(collection(firestore, 'blogPosts'), post.id);
                batch.set(docRef, post);
            });
            await batch.commit();
            showStatus(t('admin.migration.blogPostsMigrated', { defaultValue: 'Blog posts migrated successfully.' }), 'success');
        } catch (error: any) {
            showStatus(t('admin.migration.blogPostsFailed', {
                defaultValue: 'Error migrating blog posts: {{message}}',
                message: error.message,
            }), 'error');
        }
        setLoading(false);
    };

    const migrateChargingStations = async () => {
        setLoading(true);
        showStatus(t('admin.migration.migratingChargingStations', { defaultValue: 'Migrating charging stations...' }), 'info');
        try {
            const batch = writeBatch(firestore);
            chargingStationsData.forEach((station) => {
                const docRef = doc(collection(firestore, 'charging_stations'), String(station.id));
                batch.set(docRef, station);
            });
            await batch.commit();
            showStatus(t('admin.migration.chargingStationsMigrated', { defaultValue: 'Charging stations migrated successfully.' }), 'success');
        } catch (error: any) {
            showStatus(t('admin.migration.chargingStationsFailed', {
                defaultValue: 'Error migrating charging stations: {{message}}',
                message: error.message,
            }), 'error');
        }
        setLoading(false);
    };

    const getExportLabel = (type: 'dealers' | 'models' | 'listings' | 'blogPosts' | 'charging_stations') => {
        const labels = {
            dealers: t('admin.migration.exportOptions.dealers', { defaultValue: 'Dealers' }),
            models: t('admin.migration.exportOptions.models', { defaultValue: 'Models' }),
            listings: t('admin.migration.exportOptions.listings', { defaultValue: 'Listings' }),
            blogPosts: t('admin.migration.exportOptions.blogPosts', { defaultValue: 'Blog posts' }),
            charging_stations: t('admin.migration.exportOptions.chargingStations', { defaultValue: 'Charging stations' }),
        };

        return labels[type];
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
                showStatus(t('admin.migration.noDataFound', {
                    defaultValue: 'No data found for {{type}}.',
                    type: getExportLabel(type),
                }), 'error');
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
                XLSX.utils.book_append_sheet(workbook, worksheet, t('admin.migration.sheetName', { defaultValue: 'Data' }));
                XLSX.writeFile(workbook, `${filename}.xlsx`);
            } else if (format === 'pdf') {
                generatePDF(data, type);
            }

            showStatus(t('admin.migration.exportSuccess', {
                count: data.length,
                format: format.toUpperCase(),
                defaultValue: 'Exported {{count}} items to {{format}}.',
            }), 'success');
        } catch (error: any) {
            showStatus(t('admin.migration.exportFailed', {
                defaultValue: 'Export failed: {{message}}',
                message: error.message,
            }), 'error');
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

    const escapeHtml = (value: unknown) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const generatePDF = (data: any[], type: string) => {
        const printWindow = window.open('', '_blank', 'noopener,noreferrer');
        if (!printWindow) return;

        printWindow.opener = null;

        const headers = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
        
        const html = `
            <html>
                <head>
                    <title>${escapeHtml(t('admin.migration.pdfTitle', {
                        defaultValue: 'Export {{type}}',
                        type: getExportLabel(type as any),
                    }))}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        h1 { color: #0b132b; text-transform: capitalize; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        tr:nth-child(even) { background-color: #f9f9f9; }
                    </style>
                </head>
                <body>
                    <h1>${escapeHtml(t('admin.migration.pdfHeading', {
                        defaultValue: '{{type}} data export',
                        type: getExportLabel(type as any),
                    }))}</h1>
                    <p>${escapeHtml(t('admin.migration.generatedOn', {
                        defaultValue: 'Generated on: {{date}}',
                        date: new Date().toLocaleString(),
                    }))}</p>
                    <table>
                        <thead>
                            <tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${data.map(row => `
                                <tr>${headers.map(h => `<td>${escapeHtml(row[h])}</td>`).join('')}</tr>
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
        { id: 'dealers', label: getExportLabel('dealers'), icon: <Database size={18} /> },
        { id: 'models', label: getExportLabel('models'), icon: <Database size={18} /> },
        { id: 'listings', label: getExportLabel('listings'), icon: <Database size={18} /> },
        { id: 'blogPosts', label: getExportLabel('blogPosts'), icon: <Database size={18} /> },
        { id: 'charging_stations', label: getExportLabel('charging_stations'), icon: <Database size={18} /> },
    ] as const;

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto pb-20">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-white mb-2">
                    {t('admin.migration.title', { defaultValue: 'Data management center' })}
                </h1>
                <p className="text-gray-400">
                    {t('admin.migration.subtitle', { defaultValue: 'Manage database migrations and export platform data in multiple formats.' })}
                </p>
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
                            <h2 className="text-xl font-bold text-white">
                                {t('admin.migration.seedTitle', { defaultValue: 'Initial seed' })}
                            </h2>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">
                            {t('admin.migration.seedDescription', {
                                defaultValue: 'Migrate hardcoded data from local files into your Firestore database. Use this for fresh installations.',
                            })}
                        </p>
                        
                        <div className="space-y-3">
                            <button
                                onClick={migrateBlogPosts}
                                disabled={loading}
                                className="w-full py-3 px-4 bg-white/5 border border-white/10 text-white rounded-xl font-semibold hover:bg-white/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                                {t('admin.migration.seedBlogPosts', {
                                    defaultValue: 'Seed blog posts ({{count}})',
                                    count: blogPosts.length,
                                })}
                            </button>

                            <button
                                onClick={migrateChargingStations}
                                disabled={loading}
                                className="w-full py-3 px-4 bg-white/5 border border-white/10 text-white rounded-xl font-semibold hover:bg-white/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                                {t('admin.migration.seedChargingStations', {
                                    defaultValue: 'Seed charging stations ({{count}})',
                                    count: chargingStationsData.length,
                                })}
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
                            <h2 className="text-xl font-bold text-white">
                                {t('admin.migration.exportTitle', { defaultValue: 'Export platform data' })}
                            </h2>
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
