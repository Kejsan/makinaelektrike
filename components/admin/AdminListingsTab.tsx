import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Eye, 
  EyeOff,
  ExternalLink,
  Car,
  ChevronDown
} from 'lucide-react';
import { Listing, Dealer, ListingStatus } from '../../types';
import { formatDate } from '../../utils/date';

interface AdminListingsTabProps {
  listings: Listing[];
  dealers: Dealer[];
  onUpdateStatus: (id: string, status: ListingStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onBulkAction: (action: 'approve' | 'reject' | 'hide' | 'delete') => Promise<void>;
}

const AdminListingsTab: React.FC<AdminListingsTabProps> = ({ 
  listings, 
  dealers, 
  onUpdateStatus, 
  onDelete,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onBulkAction
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getDealerName = (dealerId: string) => {
    const dealer = dealers.find(d => d.id === dealerId || d.ownerUid === dealerId);
    return dealer?.name || 'Unknown Dealer';
  };

  const filteredListings = useMemo(() => {
    return listings.filter(listing => {
      const matchesSearch = 
        listing.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getDealerName(listing.dealerId).toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || listing.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [listings, searchTerm, statusFilter, dealers]);

  const allFilteredIds = useMemo(() => filteredListings.map(l => l.id), [filteredListings]);
  const isAllSelected = filteredListings.length > 0 && filteredListings.every(l => selectedIds.includes(l.id));

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
      sold: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      inactive: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    };
    const style = styles[status as keyof typeof styles] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${style} capitalize`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search make, model, or dealer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-gray-cyan/50"
          />
        </div>
        
        <div className="flex gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-none">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full lg:w-48 bg-black/20 border border-white/10 rounded-lg pl-10 pr-8 py-2 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-gray-cyan/50"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="active">Active</option>
              <option value="inactive">Hidden</option>
              <option value="rejected">Rejected</option>
              <option value="sold">Sold</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 bg-gray-cyan/10 border border-gray-cyan/30 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium text-gray-cyan">
            {selectedIds.length} items selected
          </span>
          <div className="h-4 w-px bg-gray-cyan/30" />
          <div className="flex gap-2">
            <button
              onClick={() => onBulkAction('approve')}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
            >
              <CheckCircle size={14} />
              Approve
            </button>
            <button
              onClick={() => onBulkAction('hide')}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold hover:bg-amber-500/30 transition-colors"
            >
              <EyeOff size={14} />
              Hide
            </button>
            <button
              onClick={() => onBulkAction('reject')}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-xs font-semibold hover:bg-orange-500/30 transition-colors"
            >
              <XCircle size={14} />
              Reject
            </button>
            <button
              onClick={() => onBulkAction('delete')}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/30 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-black/40 text-gray-400 uppercase text-xs font-medium">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={() => onSelectAll(isAllSelected ? [] : allFilteredIds)}
                    className="rounded border-white/10 bg-white/5 text-gray-cyan focus:ring-gray-cyan/50"
                  />
                </th>
                <th className="px-6 py-4 font-semibold">Vehicle</th>
                <th className="px-6 py-4 font-semibold">Dealer</th>
                <th className="px-6 py-4 font-semibold">Price</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredListings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-white/5 rounded-full">
                        <Car className="h-6 w-6" />
                      </div>
                      <p>No listings found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredListings.map((listing) => (
                  <tr key={listing.id} className={`hover:bg-white/5 transition-colors ${selectedIds.includes(listing.id) ? 'bg-gray-cyan/5' : ''}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(listing.id)}
                        onChange={() => onToggleSelect(listing.id)}
                        className="rounded border-white/10 bg-white/5 text-gray-cyan focus:ring-gray-cyan/50"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-20 rounded bg-black/40 overflow-hidden flex-shrink-0 border border-white/10">
                          {listing.images?.[0] ? (
                            <img 
                              src={listing.images[0]} 
                              alt={`${listing.make} ${listing.model}`} 
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-600">
                              <Car className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {listing.make} {listing.model}
                          </div>
                          <div className="text-xs text-gray-500">{listing.year} • {listing.mileage.toLocaleString()} km</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{getDealerName(listing.dealerId)}</span>
                        <span className="text-[10px] text-gray-500 font-mono tracking-tighter opacity-50">{listing.dealerId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      {listing.price.toLocaleString()} <span className="text-xs font-normal text-gray-500">{listing.priceCurrency}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(listing.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end items-center gap-2">
                        {listing.status === 'pending' && (
                          <button
                            onClick={() => onUpdateStatus(listing.id, 'active')}
                            className="p-2 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors border border-transparent hover:border-emerald-500/30"
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        
                        {(listing.status === 'active' || listing.status === 'pending') && (
                          <button
                            onClick={() => onUpdateStatus(listing.id, 'inactive')}
                            className="p-2 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors border border-transparent hover:border-amber-500/30"
                            title="Hide"
                          >
                            <EyeOff className="h-4 w-4" />
                          </button>
                        )}

                        {listing.status === 'inactive' && (
                          <button
                            onClick={() => onUpdateStatus(listing.id, 'active')}
                            className="p-2 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors border border-transparent hover:border-emerald-500/30"
                            title="Show"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => onDelete(listing.id)}
                          className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-500/30"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminListingsTab;
