import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import { useGeocoding } from '../../hooks/useGeocoding';
import type { GeocodingAddress } from '../../utils/types';

interface HeroAddressSearchProps {
  onAddressSelect: (address: GeocodingAddress) => void;
  onFocus?: () => void;
  className?: string;
}

export default function HeroAddressSearch({
  onAddressSelect,
  onFocus,
  className = ''
}: HeroAddressSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingAddress[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { search } = useGeocoding();

  // Handle address search with debounce
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 3) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await search(searchQuery.trim());
      setResults(searchResults || []);
      setIsOpen(true);
      setHighlightedIndex(-1);
    } catch (err) {
      console.error('Hero geocoding search failed:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [search]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(val);
    }, 250);
  };

  const handleSelectAddress = (address: GeocodingAddress) => {
    onAddressSelect(address);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && results.length > 0) {
        setIsOpen(true);
        return;
      }
      setHighlightedIndex(prev => 
        prev < results.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev > 0 ? prev - 1 : results.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        handleSelectAddress(results[highlightedIndex]);
      } else if (results.length > 0) {
        handleSelectAddress(results[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex items-center gap-2.5 px-4 py-3 bg-slate-100/90 hover:bg-slate-100 focus-within:bg-white text-slate-800 rounded-xl border border-slate-200 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 shadow-xs focus-within:shadow-md transition-all duration-200 cursor-text min-h-[48px]"
      >
        <div className="shrink-0 flex items-center justify-center">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-violet-600 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-violet-600" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            onFocus?.();
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ou saisissez une adresse..."
          className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-500 focus:outline-none"
          autoComplete="off"
          spellCheck={false}
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            title="Effacer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-2xl z-50 overflow-hidden py-1.5 divide-y divide-slate-100 ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-150">
          {results.map((result, index) => {
            const isHighlighted = index === highlightedIndex;
            return (
              <button
                key={`${result.label}-${index}`}
                type="button"
                onClick={() => handleSelectAddress(result)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-colors group ${
                  isHighlighted ? 'bg-violet-50 text-violet-900' : 'hover:bg-violet-50/70 text-slate-700'
                }`}
              >
                <MapPin className={`w-4 h-4 shrink-0 mt-0.5 transition-colors ${
                  isHighlighted ? 'text-violet-600' : 'text-slate-400 group-hover:text-violet-600'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs sm:text-sm font-semibold truncate ${
                    isHighlighted ? 'text-violet-700' : 'text-slate-800 group-hover:text-violet-700'
                  }`}>
                    {result.name || result.label}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {result.postcode} {result.city} {result.context ? `(${result.context})` : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* No results notice */}
      {isOpen && query.trim().length >= 3 && !isSearching && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl z-50 p-4 text-center ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95">
          <p className="text-xs text-slate-500">Aucune adresse trouvée pour "{query}"</p>
        </div>
      )}
    </div>
  );
}
