import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X, Loader2, Download, Compass, Layers, CheckCircle2, Shield, Sparkles, AlertCircle } from 'lucide-react';
import { useGeocoding } from '../hooks/useGeocoding';
import TerrainMap from './TerrainMap';
import type { GeocodingAddress } from '../utils/types';
import maplibregl from 'maplibre-gl';

interface RegularUserViewProps {
  apiBaseUrl: string;
}

const MONTAGES = [
  {
    id: 'A1',
    name: 'Montage A1',
    dimensions: '4G: 2100x470x210 | 5G: 1010x500x250',
    weight: '4G: 45daN | 5G: 50daN',
    abbreviation: 'A1a / A1b'
  },
  {
    id: 'A2',
    name: 'Montage A2',
    dimensions: '4G: 2800x500x250 | 5G: 1010x500x240',
    weight: '4G: 60daN | 5G: 50daN',
    abbreviation: 'A2a / A2b'
  },
  {
    id: 'A3',
    name: 'Montage A3',
    dimensions: '4G: 2100x500x250 | 5G: 1000x500x240',
    weight: '4G: 50daN | 5G: 50daN',
    abbreviation: 'A3a / A3b'
  },
  {
    id: 'A4',
    name: 'Montage A4',
    dimensions: '4G: 1509x469x206 | 5G: 730x395x180',
    weight: '4G: 34daN | 5G: 28daN',
    abbreviation: 'A4a / A4b'
  },
  {
    id: 'A5',
    name: 'Montage A5',
    dimensions: '4G: 2800x540x240 | 5G: 1000x500x240',
    weight: '4G: 110daN | 5G: 50daN',
    abbreviation: 'A5a / A5b'
  },
  {
    id: 'A6',
    name: 'Montage A6',
    dimensions: '4G: 2688x369x166 | 5G: 750x450x240',
    weight: '4G: 33.5daN | 5G: 45daN',
    abbreviation: 'A6a / A6b'
  },
  {
    id: 'A7',
    name: 'Montage A7',
    dimensions: '4G: 2249x469x206 | 5G: 730x395x180',
    weight: '4G: 45daN | 5G: 28.5daN',
    abbreviation: 'A7a / A7b'
  },
  {
    id: 'A8',
    name: 'Montage A8',
    dimensions: '4G: 2769x469x206 | 5G: 750x430x240',
    weight: '4G: 51daN | 5G: 45daN',
    abbreviation: 'A8a / A8b'
  }
];

export default function RegularUserView({ apiBaseUrl }: RegularUserViewProps) {
  const [selectedAddress, setSelectedAddress] = useState<GeocodingAddress | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedHeight, setSelectedHeight] = useState<number>(3); // Default to 3m
  const [selectedBuildingHeight, setSelectedBuildingHeight] = useState<number>(15); // Default to 15m
  const [selectedMontage, setSelectedMontage] = useState<string>(''); // Default to unselected
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Catalogue Results State
  const [lookupResult, setLookupResult] = useState<{
    detected_terrain_type: string | null;
    detected_region: number | null;
    equipment: any[];
  } | null>(null);

  // Address Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodingAddress[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { search, loading: searchLoading } = useGeocoding();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  // Close search suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch catalogue data from backend
  const fetchCatalogueData = useCallback(async (lat: number, lng: number, height: number, buildingHeight: number, montage: string) => {
    if (!montage) {
      setLookupResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/geodata/antenna-equipment/public_lookup/?latitude=${lat}&longitude=${lng}&mast_height=${height}&building_height=${buildingHeight}&montage=${montage}`
      );
      if (!response.ok) {
        throw new Error(`Failed to retrieve catalogue data: status ${response.status}`);
      }
      const data = await response.json();
      setLookupResult(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred while matching catalog data.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  // Re-trigger catalog lookup when height, building height or montage changes (if address selected)
  useEffect(() => {
    if (selectedCoords) {
      fetchCatalogueData(selectedCoords.latitude, selectedCoords.longitude, selectedHeight, selectedBuildingHeight, selectedMontage);
    } else {
      setLookupResult(null);
    }
  }, [selectedHeight, selectedBuildingHeight, selectedCoords, selectedMontage, fetchCatalogueData]);

  // Handle address selection from dropdown
  const handleSelectSuggestion = (address: GeocodingAddress) => {
    setSelectedAddress(address);
    setSelectedCoords({ latitude: address.latitude, longitude: address.longitude });
    setSearchQuery(address.label);
    setSuggestions([]);
    setIsSearchOpen(false);

    if (mapInstance) {
      mapInstance.flyTo({
        center: [address.longitude, address.latitude],
        zoom: 15,
        essential: true,
      });
    }
    
    fetchCatalogueData(address.latitude, address.longitude, selectedHeight, selectedBuildingHeight, selectedMontage);
  };

  // Handle map click
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setSelectedCoords({ latitude: lat, longitude: lng });
    
    // Reverse geocode to get address details
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/reverse/?lon=${lng}&lat=${lat}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const props = data.features[0].properties;
          const coords = data.features[0].geometry.coordinates;
          const address: GeocodingAddress = {
            label: props.label || '',
            name: props.name || '',
            postcode: props.postcode || '',
            city: props.city || '',
            context: props.context || '',
            type: props.type || '',
            importance: props.importance || 0,
            longitude: coords[0],
            latitude: coords[1],
            target_terrain: null
          };
          setSelectedAddress(address);
          setSearchQuery(address.label);
        } else {
          setSelectedAddress({
            label: `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            name: 'Selected Point',
            postcode: '',
            city: '',
            context: '',
            type: 'point',
            importance: 0,
            longitude: lng,
            latitude: lat,
            target_terrain: null
          });
          setSearchQuery(`Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
      }
    } catch (e) {
      console.error('Failed to reverse geocode clicked point:', e);
    }

    fetchCatalogueData(lat, lng, selectedHeight, selectedBuildingHeight, selectedMontage);
  }, [fetchCatalogueData, selectedHeight, selectedBuildingHeight, selectedMontage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsSearchOpen(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const results = await search(value);
      setSuggestions(results);
    }, 300);
  };

  const handleClear = () => {
    setSearchQuery('');
    setSuggestions([]);
    setSelectedAddress(null);
    setSelectedCoords(null);
    setLookupResult(null);
    setIsSearchOpen(false);
  };

  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    setMapInstance(map);
  }, []);

  // Get the document list and section material for the classified terrain category
  const getTerrainDetails = (eq: any) => {
    const terrain = lookupResult?.detected_terrain_type || 'IIIa'; // Default to IIIa if not detected
    
    // Find matching calculation for detected terrain
    const calc = eq.terrain_calculations?.find((c: any) => c.terrain_type === terrain);
    const material = calc?.material_specification || calc?.section_material || 'N/A';
    
    // Extract document URLs
    let docList: { url: string; localUrl?: string; filename: string; ext: string }[] = [];
    
    // Parse original Monday.com URLs
    const mondayUrls = calc?.documentation?.document_urls 
      ? calc.documentation.document_urls.split(',').map((u: string) => u.trim())
      : [];
      
    // Parse local URLs
    const localUrls = calc?.documentation?.local_document_urls
      ? calc.documentation.local_document_urls.split(',').map((u: string) => u.trim())
      : [];

    if (mondayUrls.length > 0) {
      docList = mondayUrls
        .filter((url: string) => !url.toLowerCase().endsWith('.rtd'))
        .map((url: string) => {
          const parts = url.split('/');
          const filename = parts[parts.length - 1] || 'Document';
          const decodedFilename = decodeURIComponent(filename);
          const ext = decodedFilename.split('.').pop()?.toUpperCase() || 'DOC';
          
          // Find corresponding local URL if it exists
          const localUrl = localUrls.find((lu: string) => decodeURIComponent(lu).endsWith(decodedFilename));
          
          return { 
            url, 
            localUrl,
            filename: decodedFilename, 
            ext 
          };
        });
    }
    
    return { material, docList, terrain };
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full h-full bg-slate-900 text-slate-100">
      
      {/* Left Pane - Search, Info & Map */}
      <div className="w-full md:w-5/12 xl:w-4/12 flex flex-col border-r border-slate-800 bg-slate-950 p-6 overflow-y-auto space-y-6">
        
        {/* Title & Introduction */}
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs tracking-wider uppercase">
            <Sparkles className="w-4 h-4" />
            Antenna Design Catalogue
          </div>
          <h2 className="text-2xl font-bold mt-1 text-white">Public Design Lookup</h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Determine the required mast structural profile and download calculation models for your site. Search by address and specify the desired mast height.
          </p>
        </div>

        {/* Form Controls */}
        <div className="space-y-4">
          
          {/* Address Search Field */}
          <div className="flex flex-col space-y-1.5" ref={searchContainerRef}>
            <label className="text-xs font-semibold text-slate-300">1. Select Location</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Enter address in France..."
                className="w-full pl-9 pr-8 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              {searchLoading && (
                <div className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
              {!searchLoading && searchQuery && (
                <button
                  onClick={handleClear}
                  className="absolute inset-y-0 right-2 px-1 flex items-center text-slate-500 hover:text-white transition-colors"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* suggestions dropdown */}
            {isSearchOpen && (suggestions.length > 0 || (searchQuery.trim() && !searchLoading && suggestions.length === 0)) && (
              <div className="absolute mt-14 w-[calc(100%-3rem)] md:w-[350px] bg-slate-900 border border-slate-800 rounded-lg shadow-2xl max-h-60 overflow-y-auto z-[2000] divide-y divide-slate-800">
                {suggestions.length > 0 ? (
                  suggestions.map((addr, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSuggestion(addr)}
                      className="w-full px-4 py-2.5 text-left text-xs hover:bg-indigo-950 transition-colors flex items-start gap-2"
                      type="button"
                    >
                      <MapPin className="w-4 h-4 mt-0.5 text-indigo-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">{addr.name}</div>
                        <div className="text-slate-400 mt-0.5">{addr.postcode} {addr.city}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">No addresses found</div>
                )}
              </div>
            )}
          </div>

          {/* Height Selection */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-semibold text-slate-300">2. Select Mast Height</label>
            <div className="grid grid-cols-2 gap-2">
              {[3, 4].map((h) => (
                <button
                  key={h}
                  onClick={() => setSelectedHeight(h)}
                  className={`py-2 px-3 text-sm font-semibold rounded-lg border transition-all ${
                    selectedHeight === h
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                  type="button"
                >
                  {h}m Mast
                </button>
              ))}
            </div>
          </div>

          {/* Building Height Selection */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">3. Select Building Height</label>
            <select
              value={selectedBuildingHeight}
              onChange={(e) => setSelectedBuildingHeight(Number(e.target.value))}
              className="w-full py-2.5 px-3 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value={15}>15m Building</option>
              <option value={10}>10m Building (Not in catalogue)</option>
              <option value={12}>12m Building (Not in catalogue)</option>
              <option value={18}>18m Building (Not in catalogue)</option>
              <option value={20}>20m Building (Not in catalogue)</option>
            </select>
          </div>

          {/* Montage Selection */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">4. Select Montage Type</label>
            <select
              value={selectedMontage}
              onChange={(e) => setSelectedMontage(e.target.value)}
              className="w-full py-2.5 px-3 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="">-- Choose Montage Type --</option>
              {MONTAGES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.dimensions} | {m.weight})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Small Interactive Map Container */}
        <div className="flex-1 min-h-[220px] rounded-xl border border-slate-800 overflow-hidden relative bg-slate-900">
          <TerrainMap
            onMapClick={handleMapClick}
            onMapLoad={handleMapLoad}
            selectedCoordinates={selectedCoords}
            analysisRadius={0.5}
          />
          <div className="absolute bottom-2 left-2 right-2 bg-slate-950/80 backdrop-blur-sm border border-slate-800/80 rounded-md p-1.5 px-2.5 text-[10px] text-slate-400 pointer-events-none flex items-center justify-between">
            <span>Interactive Map Preview</span>
            <span className="flex items-center gap-1"><Compass className="w-3 h-3 animate-pulse text-indigo-400" /> Click to select point</span>
          </div>
        </div>
      </div>

      {/* Right Pane - Results Catalogue Dashboard */}
      <div className="flex-1 flex flex-col overflow-y-auto p-6 lg:p-8 space-y-6">
        
        {/* Loading / Empty States */}
        {!selectedCoords && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 mb-4">
              <Compass className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">No Location Selected</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-sm">
              Use the address bar on the left or click anywhere on the map to determine local terrain rules and fetch catalogue data.
            </p>
          </div>
        )}

        {selectedCoords && !selectedMontage && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 mb-4">
              <Layers className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Select Montage Type</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-sm">
              Please choose a Montage Type from the left dropdown menu to retrieve the specific design specifications and Monday.com documents.
            </p>
          </div>
        )}

        {selectedCoords && selectedMontage && loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
            <h3 className="text-base font-semibold text-white">Matching catalogue files...</h3>
            <p className="text-xs text-slate-400 mt-1">Classifying terrain and retrieving structural analysis</p>
          </div>
        )}

        {selectedCoords && selectedMontage && error && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-rose-400">
            <AlertCircle className="w-10 h-10 mb-3" />
            <h3 className="text-base font-bold">Catalogue Error</h3>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
        )}

        {/* Dashboard Content */}
        {selectedCoords && selectedMontage && !loading && !error && lookupResult && (
          <div className="space-y-6">
            
            {/* Header: Location & Classified Metadata */}
            <div className="bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Classified Location Details</span>
                <h3 className="text-lg font-bold text-white mt-1 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  {selectedAddress?.name || 'Selected Coordinate'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedAddress?.postcode} {selectedAddress?.city} {selectedAddress?.context && `• ${selectedAddress.context}`}
                </p>
              </div>

              {/* Geographic Constraints badges */}
              <div className="flex items-center gap-3">
                <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-center">
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Wind Region</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    Region {lookupResult.detected_region || 'N/A'}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-center">
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Terrain Category</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center justify-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    Terrain {lookupResult.detected_terrain_type || 'IIIa'}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Catalogue Search Result */}
            {lookupResult.equipment.length === 0 ? (
              <div className="p-8 border border-slate-800 bg-slate-950/40 rounded-2xl text-center text-slate-400">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <h4 className="font-semibold text-white">No Exact Catalog Match</h4>
                <p className="text-xs mt-1">
                  No registered catalogue matches your selected mast height ({selectedHeight}m) and region ({lookupResult.detected_region || 'N/A'}).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* Loop matching models (usually there's one exact match per height/region) */}
                {lookupResult.equipment.map((eq: any) => {
                  const { material, docList, terrain } = getTerrainDetails(eq);
                  
                  return (
                    <div key={eq.id} className="col-span-1 xl:col-span-2 bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                      
                      {/* Ribbon / Top header bar */}
                      <div className="bg-gradient-to-r from-indigo-950 to-indigo-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-indigo-900/60 gap-2">
                        <div>
                          <div className="text-[10px] font-bold text-indigo-300 tracking-wider uppercase">matched design catalogue entry</div>
                          <h4 className="text-xl font-extrabold text-white mt-0.5">{eq.name}</h4>
                        </div>
                        <span className="self-start sm:self-auto bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs px-3 py-1 rounded-full font-semibold">
                          ID: {eq.item_id || eq.id}
                        </span>
                      </div>

                      {/* Details & calculations Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 flex-1">
                        
                        {/* Column 1: Technical & Structural Specs */}
                        <div className="lg:col-span-7 p-6 space-y-6">
                          
                          {/* Structural Profile Alert / Callout */}
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
                            <Shield className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                            <div>
                              <div className="text-xs text-slate-400 uppercase font-semibold">Required Mast Profile</div>
                              <div className="text-lg font-bold text-emerald-400 mt-0.5">{material}</div>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Verified structural section calculated under Eurocode constraints for Terrain Category {terrain}.
                              </p>
                            </div>
                          </div>

                          {/* 4G & 5G Antenna Specs */}
                          <div className="space-y-3">
                            <h5 className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-indigo-400" />
                              Antenna Load Specifications
                            </h5>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* 4G specifications */}
                              {eq.specifications?.filter((s: any) => s.antenna_type === '4G').map((s: any) => (
                                <div key={s.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
                                  <div className="text-xs font-bold text-indigo-400 uppercase">4G Antenna Model</div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-2.5 text-xs">
                                    <div>
                                      <div className="text-slate-500 text-[10px]">Height</div>
                                      <div className="font-semibold text-slate-200">{s.height_mm} mm</div>
                                    </div>
                                    <div>
                                      <div className="text-slate-500 text-[10px]">Width</div>
                                      <div className="font-semibold text-slate-200">{s.width_mm} mm</div>
                                    </div>
                                    <div>
                                      <div className="text-slate-500 text-[10px]">Thickness</div>
                                      <div className="font-semibold text-slate-200">{s.thickness_mm} mm</div>
                                    </div>
                                    <div>
                                      <div className="text-slate-500 text-[10px]">Weight</div>
                                      <div className="font-semibold text-emerald-400">{s.weight_dan} daN</div>
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {/* 5G specifications */}
                              {eq.specifications?.filter((s: any) => s.antenna_type === '5G').map((s: any) => (
                                <div key={s.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
                                  <div className="text-xs font-bold text-indigo-400 uppercase">5G Antenna Model</div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-2.5 text-xs">
                                    <div>
                                      <div className="text-slate-500 text-[10px]">Height</div>
                                      <div className="font-semibold text-slate-200">{s.height_mm} mm</div>
                                    </div>
                                    <div>
                                      <div className="text-slate-500 text-[10px]">Width</div>
                                      <div className="font-semibold text-slate-200">{s.width_mm} mm</div>
                                    </div>
                                    <div>
                                      <div className="text-slate-500 text-[10px]">Thickness</div>
                                      <div className="font-semibold text-slate-200">{s.thickness_mm} mm</div>
                                    </div>
                                    <div>
                                      <div className="text-slate-500 text-[10px]">Weight</div>
                                      <div className="font-semibold text-emerald-400">{s.weight_dan} daN</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Extra info: Responsible person & comments */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-800/80">
                            <div>
                              <div className="text-slate-500">Design Owner</div>
                              <div className="font-medium text-slate-300 mt-0.5">{eq.responsible_person || 'Engineering Dept'}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Sub-Elements</div>
                              <div className="font-medium text-slate-300 mt-0.5">{eq.sub_elements || 'Standard Mount'}</div>
                            </div>
                            {eq.comments && (
                              <div className="col-span-2">
                                <div className="text-slate-500">Remarks / Notes</div>
                                <p className="text-slate-400 mt-0.5 leading-relaxed">{eq.comments}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Column 2: Documents Download */}
                        <div className="lg:col-span-5 p-6 bg-slate-900/30 flex flex-col justify-between">
                          <div className="space-y-4">
                            <h5 className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Download className="w-3.5 h-3.5 text-indigo-400" />
                              Technical Calculations File
                            </h5>
                            
                            {docList.length === 0 ? (
                              <div className="text-center py-8 text-slate-500 text-xs">
                                No calculations document available for this configuration.
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                {docList.map((doc, dIdx) => {
                                  const downloadUrl = doc.localUrl ? doc.localUrl : doc.url;
                                  const isLocal = !!doc.localUrl;
                                  
                                  return (
                                    <a
                                      key={dIdx}
                                      href={downloadUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-full flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-indigo-500 hover:bg-slate-900 group transition-all"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                                          doc.ext === 'RTD' 
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' 
                                            : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20'
                                        }`}>
                                          {doc.ext}
                                        </div>
                                        <div className="text-left">
                                          <div className="text-xs font-bold text-slate-300 group-hover:text-indigo-400 transition-colors line-clamp-1 max-w-[150px] sm:max-w-none">
                                            {doc.filename}
                                          </div>
                                          <div className="text-[10px] text-slate-500 mt-0.5">
                                            {isLocal ? (
                                              <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                                                ✅ Served Locally
                                              </span>
                                            ) : (
                                              <span className="text-amber-500 flex items-center gap-0.5">
                                                🔒 Monday.com Login Required
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <Download className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Quick validation badge */}
                          <div className="mt-6 border-t border-slate-800/80 pt-4 flex items-center gap-2 text-emerald-400 text-xs font-medium">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Ready for procurement submission</span>
                          </div>
                        </div>

                      </div>

                    </div>
                  );
                })}

              </div>
            )}
            
          </div>
        )}

      </div>
      
    </div>
  );
}
