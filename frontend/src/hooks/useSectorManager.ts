import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  SectorData,
  SimilarityMode,
  ZoneTechniqueData,
  defaultSectorData
} from '../components/regular-user/types';

export const getCatalogueHash = (s: SectorData) => {
  return `${s.selectedHeight}-${s.selectedMontage4G}-${s.selectedMontage5G}`;
};

// In-memory cache for catalogue queries across sector changes
const lookupCache = new Map<string, any>();

interface UseSectorManagerOptions {
  apiBaseUrl: string;
  config: any;
  operator: string;
  selectedCoords: { latitude: number; longitude: number } | null;
  selectedBuildingHeight: number | string;
  setZoneTechnique: React.Dispatch<React.SetStateAction<ZoneTechniqueData>>;
}

export function useSectorManager({
  apiBaseUrl,
  config,
  operator,
  selectedCoords,
  selectedBuildingHeight,
  setZoneTechnique
}: UseSectorManagerOptions) {
  const [nombreSecteurs, setNombreSecteurs] = useState<number>(3);
  const [similarityMode, setSimilarityMode] = useState<SimilarityMode>('all_similar');
  const [sectors, setSectors] = useState<SectorData[]>(
    Array.from({ length: 3 }, (_, i) => defaultSectorData(i))
  );

  // Reset operator-specific equipments when operator changes
  useEffect(() => {
    setZoneTechnique(prev => ({
      ...prev,
      ...(operator !== 'orange' ? { hasBaie: false, baieRadio: false, baieEnergie: false, baieItems: [] } : {}),
      ...(operator !== 'free' ? { hasCab: false, cabOne: false, cabTwo: false, cabThree: false, cabSupport: 'plinthes' } : {}),
      ...((operator !== 'free' && operator !== 'bouygues') ? { hasAtelierEnergie: false } : {}),
      ...(operator !== 'bouygues' ? { bcubeReference: '', hasTgbt: false, tgbtReference: '' } : {})
    }));

    const defaultRrh = [{
      id: crypto.randomUUID(),
      reference: '',
      quantity: 1,
      vendor: operator !== 'bouygues' ? 'NOKIA' : undefined
    }];

    const defaultRru = [{
      id: crypto.randomUUID(),
      reference: '',
      quantity: 1,
      vendor: operator === 'free' ? 'NOKIA' : operator === 'orange' ? 'ERICSSON' : undefined
    }];

    setSectors(prev => prev.map(s => ({
      ...s,
      hasRrhEquipment: operator === 'bouygues' ? false : s.hasRrhEquipment,
      rrhItems: defaultRrh,
      rruItems: defaultRru
    })));
  }, [operator, setZoneTechnique]);

  const updateSector = useCallback((index: number, updates: Partial<SectorData>) => {
    setSectors(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };

      if (index === 0 && similarityMode === 'all_similar') {
        next[1] = { ...next[1], ...updates };
        next[2] = { ...next[2], ...updates };
      }
      return next;
    });
  }, [similarityMode]);

  // Sync data when similarity mode changes
  useEffect(() => {
    if (similarityMode === 'all_similar') {
      setSectors(prev => {
        const s1 = prev[0];
        const next = [...prev];
        next[1] = { ...s1, id: next[1].id, lookupResult: next[1].lookupResult, loading: next[1].loading, error: next[1].error };
        next[2] = { ...s1, id: next[2].id, lookupResult: next[2].lookupResult, loading: next[2].loading, error: next[2].error };
        return next;
      });
    }
  }, [similarityMode]);

  // Handle number of sectors changing
  useEffect(() => {
    if (nombreSecteurs === 1) {
      setSimilarityMode('none');
    } else if (similarityMode === 'none') {
      setSimilarityMode('all_similar');
    }
  }, [nombreSecteurs, similarityMode]);

  const activeSectors = useMemo(() => sectors.slice(0, nombreSecteurs), [sectors, nombreSecteurs]);
  const sectorDependencies = useMemo(() => activeSectors.map(s => getCatalogueHash(s)).join('|'), [activeSectors]);

  // Fetch API Catalogue for distinct sectors
  useEffect(() => {
    if (!selectedCoords) return;

    let active = true;

    async function fetchCatalogueData() {
      const uniqueHashes = Array.from(new Set(activeSectors.map(getCatalogueHash)));

      setSectors(prev => prev.map((s, i) => i < nombreSecteurs ? { ...s, loading: true, error: null } : s));

      try {
        const precalculatedHeights = config?.precalculated_building_heights || [10, 15, 20, 25, 30, 35, 40, 45];
        let queryHeight = Number(selectedBuildingHeight) || 0;
        if (!precalculatedHeights.includes(queryHeight)) {
          const validHeights = precalculatedHeights.filter((h: number) => h >= queryHeight);
          queryHeight = validHeights.length > 0 ? validHeights[0] : precalculatedHeights[precalculatedHeights.length - 1];
        }

        const results = await Promise.all(uniqueHashes.map(async (hash) => {
          const sector = activeSectors.find(s => getCatalogueHash(s) === hash);
          if (!sector || !sector.selectedMontage4G || !sector.selectedMontage5G) return { hash, data: null, error: null };

          const isCustom = sector.selectedMontage4G !== sector.selectedMontage5G || sector.selectedMontage4G === 'custom';

          let url = `${apiBaseUrl}/api/geodata/antenna-equipment/public_lookup/?latitude=${selectedCoords!.latitude}&longitude=${selectedCoords!.longitude}&building_height=${queryHeight}&mast_height=${sector.selectedHeight}`;
          if (!isCustom) {
            url += `&montage=${encodeURIComponent(sector.selectedMontage4G)}`;
          }

          if (lookupCache.has(url)) {
            return { hash, data: lookupCache.get(url), error: null };
          }

          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Erreur de communication avec le catalogue.");
            const data = await res.json();

            if (!isCustom) {
              data.equipment = data.equipment || [];
            } else {
              data.equipment = [];
            }

            lookupCache.set(url, data);
            return { hash, data, error: null };
          } catch (e: any) {
            return { hash, data: null, error: e.message || "Erreur" };
          }
        }));

        if (active) {
          setSectors(prev => prev.map(s => {
            const res = results.find(r => r.hash === getCatalogueHash(s));
            if (res) {
              return { ...s, lookupResult: res.data, error: res.error, loading: false };
            }
            return s;
          }));
        }
      } catch (err: any) {
        if (active) {
          setSectors(prev => prev.map(s => ({ ...s, loading: false, error: "Erreur globale" })));
        }
      }
    }

    const timeoutId = setTimeout(fetchCatalogueData, 300);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCoords, selectedBuildingHeight, sectorDependencies, apiBaseUrl, config, nombreSecteurs]);

  // Group unique configurations for calculations/PDF (memoized to prevent cascade re-renders)
  const uniqueGroups = useMemo(() => {
    const uniqueGroupsMap = new Map<string, { hash: string; indices: number[]; sector: SectorData }>();
    activeSectors.forEach((s, idx) => {
      let hash = `${s.selectedHeight}_${s.selectedMontage4G}_${s.selectedMontage5G}_${s.matPrincipal}_${s.matSecondaire}_${s.brasDeDeport}_${s.plotMetallique}`;
      if (s.selectedMontage4G === 'custom' || s.selectedMontage5G === 'custom') {
        hash += `_4G${s.ant4gConfig.height}x${s.ant4gConfig.width}x${s.ant4gConfig.thickness}w${s.ant4gConfig.weight}`;
        hash += `_5G${s.ant5gConfig.height}x${s.ant5gConfig.width}x${s.ant5gConfig.thickness}w${s.ant5gConfig.weight}`;
      }
      if (s.configMode === 'reference') {
        hash += `_ref4G${s.selectedReference4G}_ref5G${s.selectedReference5G}`;
      }
      if (similarityMode === 'all_similar') {
        hash = 'unified_group';
      }
      if (!uniqueGroupsMap.has(hash)) {
        uniqueGroupsMap.set(hash, { hash, indices: [idx], sector: s });
      } else {
        uniqueGroupsMap.get(hash)!.indices.push(idx);
      }
    });
    return Array.from(uniqueGroupsMap.values());
  }, [activeSectors, similarityMode]);

  const anyLoading = activeSectors.some(s => s.loading);
  const anyError = activeSectors.find(s => s.error)?.error;

  const clearLookupResults = useCallback(() => {
    setSectors(prev => prev.map(s => ({ ...s, lookupResult: null })));
  }, []);

  return {
    sectors,
    setSectors,
    nombreSecteurs,
    setNombreSecteurs,
    similarityMode,
    setSimilarityMode,
    updateSector,
    activeSectors,
    uniqueGroups,
    anyLoading,
    anyError,
    clearLookupResults
  };
}
