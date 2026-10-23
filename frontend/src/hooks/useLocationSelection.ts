import { useState, useCallback } from 'react';
import type { GeocodingAddress } from '../utils/types';

interface UseLocationSelectionOptions {
  reverseGeocode: (lat: number, lon: number) => Promise<GeocodingAddress | null>;
  onLocationChosen?: () => void;
  onClearLookup?: () => void;
  onGenericLocationChosen?: () => void;
}

export function useLocationSelection({
  reverseGeocode,
  onLocationChosen,
  onClearLookup,
  onGenericLocationChosen
}: UseLocationSelectionOptions) {
  const [selectedAddress, setSelectedAddress] = useState<GeocodingAddress | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pendingGenericAddress, setPendingGenericAddress] = useState<GeocodingAddress | null>(null);
  const [flyToLocation, setFlyToLocation] = useState<{ latitude: number; longitude: number; zoom?: number } | null>(null);
  const [showMap, setShowMap] = useState<boolean>(true);

  const onAddressSelect = (address: GeocodingAddress) => {
    const isGeneric = !address.type || address.type !== 'housenumber';

    if (isGeneric) {
      setPendingGenericAddress(address);
      setSelectedAddress(null);
      setSelectedCoords(null);
      const zoom = address.type === 'municipality' ? 13 : 15;
      setFlyToLocation({
        latitude: address.latitude,
        longitude: address.longitude,
        zoom
      });
      setShowMap(true);
      onGenericLocationChosen?.();
    } else {
      setPendingGenericAddress(null);
      setFlyToLocation({
        latitude: address.latitude,
        longitude: address.longitude,
        zoom: 17
      });
      setSelectedAddress(address);
      setSelectedCoords({ latitude: address.latitude, longitude: address.longitude });
      onClearLookup?.();
      setShowMap(false);
      onLocationChosen?.();
    }
  };

  const handleMapLocationSelect = useCallback(async (lat: number, lon: number) => {
    setSelectedCoords({ latitude: lat, longitude: lon });
    setPendingGenericAddress(null);
    setFlyToLocation(null);

    setSelectedAddress({
      label: `${lat}-${lon}`,
      name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      latitude: lat,
      longitude: lon,
      city: 'Recherche de l\'adresse...',
      postcode: '',
      context: '',
      type: 'housenumber',
      importance: 0,
      target_terrain: null
    });
    onClearLookup?.();
    setShowMap(false);
    onLocationChosen?.();

    try {
      const reverseResult = await reverseGeocode(lat, lon);
      if (reverseResult) {
        setSelectedAddress(reverseResult);
      } else {
        setSelectedAddress({
          label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          latitude: lat,
          longitude: lon,
          city: 'Emplacement sélectionné',
          postcode: '',
          context: '',
          type: 'housenumber',
          importance: 0,
          target_terrain: null
        });
      }
    } catch (err) {
      console.error('Reverse geocoding failed', err);
    }
  }, [reverseGeocode, onClearLookup, onLocationChosen]);

  return {
    selectedAddress,
    setSelectedAddress,
    selectedCoords,
    setSelectedCoords,
    pendingGenericAddress,
    setPendingGenericAddress,
    flyToLocation,
    setFlyToLocation,
    showMap,
    setShowMap,
    onAddressSelect,
    handleMapLocationSelect
  };
}
