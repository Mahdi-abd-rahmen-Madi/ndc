import { useState } from 'react';
import { Search, MapPin, MapIcon } from 'lucide-react';
import { useGeocoding } from '../../hooks/useGeocoding';
import type { GeocodingAddress } from '../../utils/types';

interface AddressSearchSectionProps {
  onAddressSelect: (address: GeocodingAddress) => void;
  selectedAddress: any;
  showMap: boolean;
  setShowMap: (show: boolean) => void;
}

export default function AddressSearchSection({
  onAddressSelect,
  selectedAddress,
  showMap,
  setShowMap
}: AddressSearchSectionProps) {
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<GeocodingAddress[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { search } = useGeocoding();

  const handleAddressSearch = async (query: string) => {
    setAddressQuery(query);
    if (query.length < 3) {
      setAddressResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await search(query);
      setAddressResults(results);
    } catch (e) {
      console.error('Failed to search address:', e);
      setAddressResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col space-y-2 relative">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-indigo-400" />
          1. Rechercher une adresse
        </label>
        <button
          type="button"
          onClick={() => setShowMap(!showMap)}
          className={`text-[10px] font-semibold flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
            showMap 
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <MapIcon className="w-3 h-3" />
          {showMap ? 'Masquer la carte' : 'Afficher la carte'}
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className={`w-4 h-4 ${isSearching ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`} />
        </div>
        <input
          type="text"
          value={addressQuery}
          onChange={(e) => handleAddressSearch(e.target.value)}
          className="w-full pl-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner transition-all"
          placeholder={selectedAddress ? selectedAddress.label : "Entrez une adresse ou code postal..."}
        />
        
        {/* Dropdown results */}
        {addressResults.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1 divide-y divide-slate-700/50">
            {addressResults.map((result) => (
              <button
                key={result.label}
                onClick={() => {
                  onAddressSelect(result);
                  setAddressQuery('');
                  setAddressResults([]);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 flex flex-col gap-0.5 transition-colors group"
                type="button"
              >
                <span className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  {result.name}
                </span>
                <span className="text-xs text-slate-400">
                  {result.postcode} {result.city}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
