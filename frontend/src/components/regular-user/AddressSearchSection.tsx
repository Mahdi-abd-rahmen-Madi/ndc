import { useState, useRef, useEffect } from 'react';
import { Search, MapPin, MapIcon, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useGeocoding } from '../../hooks/useGeocoding';
import type { GeocodingAddress } from '../../utils/types';
import { styles } from './styles/AddressSearchSection.styles';

interface AddressSearchSectionProps {
  onAddressSelect: (address: GeocodingAddress) => void;
  selectedAddress: any;
  pendingGenericAddress?: GeocodingAddress | null;
  showMap: boolean;
  setShowMap: (show: boolean) => void;
}

export default function AddressSearchSection({
  onAddressSelect,
  selectedAddress,
  pendingGenericAddress,
  showMap,
  setShowMap
}: AddressSearchSectionProps) {
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<GeocodingAddress[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { search } = useGeocoding();

  const handleAddressSearch = (query: string) => {
    setAddressQuery(query);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length < 3) {
      setAddressResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await search(query.trim());
        setAddressResults(results || []);
      } catch (e) {
        console.error('Failed to search address:', e);
        setAddressResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <label className={styles.headerLabel}>
          <MapPin className={styles.headerIcon} />
          1. Rechercher une adresse
        </label>
        <button
          type="button"
          onClick={() => setShowMap(!showMap)}
          className={`${styles.mapButtonBase} ${
            showMap 
              ? styles.mapButtonActive
              : styles.mapButtonInactive
          }`}
        >
          <MapIcon className={styles.mapButtonIcon} />
          {showMap ? 'Masquer la carte' : 'Afficher la carte'}
        </button>
      </div>

      <div className={styles.searchContainer}>
        <div className={styles.searchIconContainer}>
          {isSearching ? (
            <Loader2 className={`${styles.searchIconBase} text-violet-600 animate-spin`} />
          ) : (
            <Search className={`${styles.searchIconBase} ${styles.searchIconIdle}`} />
          )}
        </div>
        <input
          type="text"
          value={addressQuery}
          onChange={(e) => handleAddressSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && addressResults.length > 0) {
              e.preventDefault();
              onAddressSelect(addressResults[0]);
              setAddressQuery('');
              setAddressResults([]);
            }
          }}
          className={styles.searchInput}
          placeholder={selectedAddress ? selectedAddress.label : "Entrez une adresse ou code postal..."}
        />
        
        {/* Dropdown results */}
        {addressResults.length > 0 && (
          <div className={styles.dropdownContainer}>
            {addressResults.map((result) => (
              <button
                key={result.label}
                onClick={() => {
                  onAddressSelect(result);
                  setAddressQuery('');
                  setAddressResults([]);
                }}
                className={styles.dropdownButton}
                type="button"
              >
                <span className={styles.dropdownName}>
                  {result.name}
                </span>
                <span className={styles.dropdownAddress}>
                  {result.postcode} {result.city}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {pendingGenericAddress && (
        <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 animate-fadeIn shadow-2xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-amber-900">Emplacement approximatif : {pendingGenericAddress.label}</p>
            <p className="mt-0.5 text-[11px] text-amber-700 leading-relaxed">
              Veuillez cliquer sur la carte pour définir l'emplacement exact de votre pylône ou antenne.
            </p>
            {!showMap && (
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition-all flex items-center gap-1.5"
              >
                <MapPin className="w-3 h-3" />
                Afficher la carte
              </button>
            )}
          </div>
        </div>
      )}

      {selectedAddress && !pendingGenericAddress && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">Emplacement exact sélectionné : <strong>{selectedAddress.label}</strong></span>
        </div>
      )}
    </div>
  );
}
