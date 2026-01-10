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
  Car
} from 'lucide-react';
import { Listing, Dealer } from '../../types';
import { formatDate } from '../../utils/date';

interface AdminListingsTabProps {
  listings: Listing[];
  dealers: Dealer[];
  onUpdateStatus: (id: string, status: 'active' | 'pending' | 'rejected' | 'sold') => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const AdminListingsTab: React.FC<AdminListingsTabProps> = ({ 
  listings, 
  dealers, 
  onUpdateStatus, 
  onDelete 
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

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
      sold: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
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
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search listings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-gray-cyan/50"
          />
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-48 bg-black/20 border border-white/10 rounded-lg pl-10 pr-8 py-2 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-gray-cyan/50"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
              <option value="sold">Sold</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-black/20 text-gray-400 uppercase text-xs font-medium">
              <tr>
                <th className="px-6 py-4">Vehicle</th>
                <th className="px-6 py-4">Dealer</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Posted</th>
                <th className="px-6 py-4 text-right">Actions</th>
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
                  <tr key={listing.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-16 rounded bg-black/40 overflow-hidden flex-shrink-0 border border-white/10">
                          {listing.images?.[0] ? (
                            <img 
                              src={listing.images[0]} 
                              alt={`${listing.make} ${listing.model}`} 
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-600">
                              <Car className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {listing.make} {listing.model}
                          </div>
                          <div className="text-xs text-gray-500">{listing.year} • {listing.mileage.toLocaleString()} km</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-white">{getDealerName(listing.dealerId)}</span>
                        <span className="text-xs text-gray-500 truncate max-w-[150px]">{listing.dealerId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {listing.price.toLocaleString()} {listing.priceCurrency}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(listing.status)}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {listing.createdAt ? new Date(listing.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end items-center gap-2">
                        {listing.status === 'pending' && (
                          <>
                            <button
                              onClick={() => onUpdateStatus(listing.id, 'active')}
                              className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => onUpdateStatus(listing.id, 'rejected')}
                              className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        
                        {listing.status === 'active' && (
                          <button
                            onClick={() => onUpdateStatus(listing.id, 'pending')}
                            className="p-1.5 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors"
                            title="Suspend (Set to Pending)"
                          >
                            <EyeOff className="h-4 w-4" />
                          </button>
                        )}

                       {listing.status === 'rejected' && (
                          <button
                            onClick={() => onUpdateStatus(listing.id, 'active')}
                            className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"
                            title="Reactivate"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => onDelete(listing.id)}
                          className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                          title="Delete Listing"
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
