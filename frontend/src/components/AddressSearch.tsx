// AddressSearch component - allows searching for addresses and shows reverse-geocoded address

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Loader2 } from 'lucide-react';
import { useGeocoding } from '../hooks/useGeocoding';
import type { GeocodingAddress } from '../utils/types';

import { useAppStore } from '../stores/useAppStore';

interface AddressSearchProps {
  onAddressSelect: (address: GeocodingAddress) => void;
  onClearAddress: () => void;
}

export default function AddressSearch({
  onAddressSelect,
  onClearAddress,
}: AddressSearchProps) {
  const selectedAddress = useAppStore(state => state.selectedAddress);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodingAddress[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { search, loading } = useGeocoding();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update query when selectedAddress changes (e.g. from map click reverse geocoding)
  useEffect(() => {
    if (selectedAddress) {
      setQuery(selectedAddress.label);
    } else {
      setQuery('');
    }
  }, [selectedAddress]);

  // Handle outside clicks to close the dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    // Debounce API call
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await search(value);
      setSuggestions(results);
    }, 300);
  };

  const handleSelectSuggestion = (address: GeocodingAddress) => {
    onAddressSelect(address);
    setQuery(address.label);
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    onClearAddress();
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="address-search-container absolute top-3 right-3 z-[1001] w-80 sm:w-96 max-w-[calc(100vw-2rem)]"
    >
      <div className="relative flex items-center bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/80 transition-all focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:border-indigo-500 hover:shadow-xl">
        <div className="pl-3.5 text-slate-400 pointer-events-none">
          <Search className="w-4 h-4" />
        </div>
        
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Rechercher une commune, adresse..."
          className="w-full py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 bg-transparent border-none rounded-xl focus:outline-none"
        />

        {loading && (
          <div className="pr-3 text-indigo-500">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}

        {!loading && query && (
          <button
            onClick={handleClear}
            className="pr-3 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && (suggestions.length > 0 || (query.trim() && !loading && suggestions.length === 0)) && (
        <div className="absolute left-0 right-0 mt-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200/50 max-h-64 overflow-y-auto z-[1002]">
          {suggestions.length > 0 ? (
            <ul className="py-1">
              {suggestions.map((address, index) => (
                <li key={`${address.label}-${index}`}>
                  <button
                    onClick={() => handleSelectSuggestion(address)}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-primary/10 hover:text-primary transition-colors flex items-start gap-2.5"
                    type="button"
                  >
                    <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0 group-hover:text-primary" />
                    <div>
                      <div className="font-medium text-gray-800">{address.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {address.postcode} {address.city} • {address.context}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-sm text-gray-500">Aucun résultat trouvé</div>
          )}
        </div>
      )}
    </div>
  );
}
