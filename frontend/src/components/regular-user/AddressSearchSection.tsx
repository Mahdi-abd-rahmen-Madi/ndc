import { useState } from 'react';
import { Search, MapPin, MapIcon } from 'lucide-react';
import { useGeocoding } from '../../hooks/useGeocoding';
import type { GeocodingAddress } from '../../utils/types';
import { styles } from './styles/AddressSearchSection.styles';

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
          <Search className={`${styles.searchIconBase} ${isSearching ? styles.searchIconSearching : styles.searchIconIdle}`} />
        </div>
        <input
          type="text"
          value={addressQuery}
          onChange={(e) => handleAddressSearch(e.target.value)}
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
    </div>
  );
}
