import { useState, useCallback } from 'react';
import {
  type SectorData,
  type CatalogueConfig,
  type ZoneTechniqueData,
  type SelectedBaieItem,
  type StructureCase,
  DEFAULT_STRUCTURE_CASE,
} from '../components/regular-user/types';
import { getTerrainDetails } from '../utils/terrainDetails';
import { buildSectorEquipmentPayload } from '../config/equipmentRegistry';
import { apiClient, buildWebSocketUrl, resolveMediaUrl } from '../services/apiClient';

/**
 * DEVELOPMENT FLAG:
 * When true, forces ALL Note de Calcul calculations to be sent to the Robot worker,
 * completely disabling the Instant Catalogue (Fast-Track) path.
 * In development, this ensures Robot actually calculates the structure, generates screenshots,
 * and verifies all equipment notes.
 *
 * Set to false when you want standard configurations to use precalculated catalogue documents.
 */
export const FORCE_WORKER_CALCULATION = true;

/**
 * DEVELOPMENT FLAG:
 * When true, sends `force_recalculate: true` on every calculation request to bypass
 * the backend database cache and always dispatch to the Robot worker.
 * Set to false in production to re-enable instant cache hits.
 */
export const FORCE_RECALCULATE_BYPASS_CACHE = true;

interface UseSiteNdcGeneratorParams {
  apiBaseUrl: string;
  config: CatalogueConfig | null;
  foundationType: string;
  selectedBuildingHeight: number | string;
  selectedAddress: any;
  selectedCoords: { latitude: number; longitude: number } | null;
  siteName: string;
  codeSite: string;
  clientName: string;
  clientLogoUrl?: string | null;
  siteImageUrl: string | null;
  siteType: string;
  structureCase?: StructureCase;
  dalleThickness: number | string;
  etancheite: number | string;
  plotHeight: number;
  selectedEchelle: string;
  activeSectors: SectorData[];
  uniqueGroups: { hash: string; indices: number[]; sector: SectorData }[];
  nombreSecteurs: number;
  operator: string;
  zoneTechnique: ZoneTechniqueData;
  resolveTd: (id: string) => string;
  resolveRru: (id: string) => string;
  resolveRrh: (id: string) => string;
  resolveBaieItems: (items: SelectedBaieItem[]) => any[];
}

export function useSiteNdcGenerator({
  apiBaseUrl,
  config,
  foundationType,
  selectedBuildingHeight,
  selectedAddress,
  selectedCoords,
  siteName,
  codeSite,
  clientName,
  clientLogoUrl,
  siteImageUrl,
  siteType,
  structureCase = DEFAULT_STRUCTURE_CASE,
  dalleThickness,
  etancheite,
  plotHeight,
  selectedEchelle,
  activeSectors,
  uniqueGroups,
  nombreSecteurs,
  operator,
  zoneTechnique,
  resolveTd,
  resolveRru,
  resolveRrh,
  resolveBaieItems
}: UseSiteNdcGeneratorParams) {
  const [isGeneratingSiteNdc, setIsGeneratingSiteNdc] = useState(false);
  const [siteNdcPollingMsg, setSiteNdcPollingMsg] = useState('');
  const [siteNdcProgressPercent, setSiteNdcProgressPercent] = useState<number | null>(null);
  const [siteNdcError, setSiteNdcError] = useState<string | null>(null);
  const [ndcPdfUrl, setNdcPdfUrl] = useState<string | null>(null);

  // Determine if all sectors match the catalogue perfectly (Fast-Track eligible)
  const isFullyStandard = useCallback(() => {
    // If development flag is set to force worker execution, bypass catalogue fast-track
    if (FORCE_WORKER_CALCULATION) return false;
    // Only Cas 1 has precalculated standard catalogue documents
    if (structureCase !== 'cas1') return false;

    // Any auxiliary equipment requiring dedicated Robot simulation (e.g. RRH mast/structure)
    const s1 = activeSectors[0];
    if (s1?.hasRrhEquipment && operator !== 'bouygues') return false;

    if (uniqueGroups.length === 0) return false;
    for (const group of uniqueGroups) {
      const sector = group.sector;
      if (!sector.lookupResult) return false;
      if (sector.selectedMontage4G === 'custom') return false;
      if (sector.selectedMontage4G !== sector.selectedMontage5G) return false;

      // Check if mast height is standard
      const hFloat = sector.selectedHeight;
      if (typeof hFloat !== 'number' || isNaN(hFloat) || !config?.recommended_mast_heights?.includes(hFloat)) return false;

      // Check if building height is standard (only matters for roof sites)
      if (foundationType === 'metallique' || foundationType === 'dallettes') {
        const bHeight = Number(selectedBuildingHeight) || 0;
        if (typeof bHeight !== 'number' || isNaN(bHeight) || !config?.precalculated_building_heights?.includes(bHeight)) return false;
      }

      const eq = sector.lookupResult.equipment[0];
      if (eq) {
        // Extract default materials for this specific terrain
        const details = getTerrainDetails(eq, sector.lookupResult.detected_terrain_type);
        if (sector.matPrincipal && sector.matPrincipal !== details.matPrincipal) return false;
        if (sector.brasDeDeport && sector.brasDeDeport !== details.brasDeDeport) return false;
        if (sector.plotMetallique && sector.plotMetallique !== details.plotMetallique) return false;
        if (sector.matSecondaire && sector.matSecondaire !== details.matSecondaire) return false;
      }
    }
    return true;
  }, [uniqueGroups, config, foundationType, selectedBuildingHeight, activeSectors, operator, structureCase]);

  const confirmGenerateSiteNdc = useCallback(async (forceRecalculate: boolean = false) => {
    setIsGeneratingSiteNdc(true);
    setSiteNdcError(null);

    try {
      // --- FAST TRACK (INSTANT NDC) ---
      if (!FORCE_WORKER_CALCULATION && isFullyStandard()) {
        setSiteNdcProgressPercent(10);
        setSiteNdcPollingMsg('Génération du document Standard (Instantané)... (10%)');

        // Extract the correct catalogue PDF URLs from the terrain details
        const catalogueUrls = [];
        for (const g of uniqueGroups) {
          const eq = g.sector.lookupResult?.equipment[0];
          if (eq) {
            const height = (foundationType === 'metallique' || foundationType === 'dallettes')
              ? (Number(selectedBuildingHeight) || eq.building_height || 15)
              : g.sector.selectedHeight;

            let actualMontage = g.sector.selectedMontage4G;
            if (actualMontage === 'Custom' && eq.sub_elements) {
              actualMontage = eq.sub_elements;
            }

            const params = new URLSearchParams({
              montage: actualMontage,
              terrain_type: g.sector.lookupResult?.detected_terrain_type || 'IIIa',
              region: g.sector.lookupResult?.detected_region || '1',
              height: height.toString(),
              config_mode: g.sector.configMode || 'reference'
            });

            if (eq.item_id) {
              params.append('item_id', eq.item_id);
            }

            try {
              const data = await apiClient.get<{ url?: string }>(
                `/api/geodata/matching-catalogue-pdf/?${params.toString()}`,
                { baseUrl: apiBaseUrl }
              );
              if (data.url) catalogueUrls.push(data.url);
            } catch {
              // Skip unmatched catalogue item
            }
          }
        }

        const payload = {
          fast_track: true,
          operateur: operator,
          catalogue_pdf_urls: catalogueUrls,
          photo_url: siteImageUrl,
          site_name: siteName,
          code_site: codeSite,
          ref_site: codeSite,
          client_name: clientName,
          address: selectedAddress?.label || selectedAddress?.name || '',
          etancheite: etancheite,
          dalle_thickness_m: dalleThickness ? parseFloat(String(dalleThickness)) / 100 : null,
          site: {
            operator,
            name: siteName,
            code_site: codeSite,
            ref_site: codeSite,
            client: clientName,
            client_logo_url: clientLogoUrl,
            address: selectedAddress?.label || selectedAddress?.name || ''
          },
          environment: {
            terrain_type: activeSectors[0]?.lookupResult?.detected_terrain_type || 'IIIa',
            region: activeSectors[0]?.lookupResult?.detected_region || '1',
            building_height_m: Number(selectedBuildingHeight) || 0,
            plot_height_m: 0.6
          },
          structure: {
            structure_case: structureCase,
            mast_height_m: activeSectors[0]?.selectedHeight,
            mat_principal: "CH 88.9x3",
            nombre_secteurs: activeSectors.length,
            echelle: selectedEchelle
          },
          antenna_4g: {
            model: activeSectors[0]?.ant4gConfig?.model,
            hauteur_mm: activeSectors[0]?.ant4gConfig?.height,
            largeur_mm: activeSectors[0]?.ant4gConfig?.width,
            epaisseur_mm: activeSectors[0]?.ant4gConfig?.thickness,
            poids_kg: activeSectors[0]?.ant4gConfig?.weight
          },
          antenna_5g: {
            model: activeSectors[0]?.ant5gConfig?.model,
            hauteur_mm: activeSectors[0]?.ant5gConfig?.height,
            largeur_mm: activeSectors[0]?.ant5gConfig?.width,
            epaisseur_mm: activeSectors[0]?.ant5gConfig?.thickness,
            poids_kg: activeSectors[0]?.ant5gConfig?.weight
          },
          ...buildSectorEquipmentPayload({
            sector: activeSectors[0],
            zoneTechnique,
            operator,
            config,
            coffretQuantityMultiplier: nombreSecteurs,
            resolveRru,
            resolveRrh,
            resolveBaieItems,
          }),
        };

        try {
          const mergeData = await apiClient.post<{ ndc_pdf_url?: string }>(
            '/api/calculations/generate_site_ndc/',
            payload,
            { baseUrl: apiBaseUrl }
          );
          if (mergeData.ndc_pdf_url) {
            const fullUrl = resolveMediaUrl(mergeData.ndc_pdf_url, apiBaseUrl);

            setSiteNdcProgressPercent(100);
            setIsGeneratingSiteNdc(false);
            setNdcPdfUrl(fullUrl);
            return; // Done! Bypassed Robot!
          }
        } catch {
          // Fall through to Robot Calculation
        }
        // If Fast-Track fails for some reason, fall through to Robot Calculation
        console.warn("Fast-Track failed, falling back to Robot calculation");
      }

      // --- ROBOT CALCULATION (CUSTOM TRACK) ---
      setSiteNdcProgressPercent(2);
      setSiteNdcPollingMsg('Lancement des calculs Robot pour chaque secteur... (2%)');
      const createdJobs: Array<{ id: string; status?: string; cached?: boolean }> = [];

      // Create a job for each unique group (using each group's own sector aerial equipment!)
      for (let i = 0; i < uniqueGroups.length; i++) {
        const group = uniqueGroups[i];
        const sector = group.sector;
        const groupIndicesCount = group.indices.length;

        const firstEqDetails = sector.lookupResult && sector.lookupResult.equipment.length > 0
          ? getTerrainDetails(sector.lookupResult.equipment[0], sector.lookupResult.detected_terrain_type)
          : null;

        const payload = {
          schema_version: "1.0",
          operateur: operator,
          site: {
            type: siteType,
            operator,
            address: selectedAddress?.label || '',
            name: siteName,
            code_site: codeSite,
            ref_site: codeSite,
            client: clientName,
            client_logo_url: clientLogoUrl,
            ancrage: foundationType,
            latitude: selectedCoords?.latitude,
            longitude: selectedCoords?.longitude
          },
          environment: {
            region: sector.lookupResult?.detected_region || 'N/A',
            terrain_type: sector.lookupResult?.detected_terrain_type ?? 0,
            building_height_m: Number(selectedBuildingHeight) || 0,
            dalle_thickness_m: dalleThickness === '' ? null : Number(dalleThickness) / 100,
            etancheite: etancheite === '' ? null : Number(etancheite),
            plot_height_m: plotHeight
          },
          structure: {
            structure_case: structureCase,
            hauteur_mat_m: sector.selectedHeight,
            montage_id: (sector.selectedMontage4G === sector.selectedMontage5G && sector.selectedMontage4G !== 'custom') ? sector.selectedMontage4G : 'custom',
            is_custom_montage: sector.selectedMontage4G !== sector.selectedMontage5G || sector.selectedMontage4G === 'custom',
            mat_principal: firstEqDetails?.matPrincipal || sector.matPrincipal || 'TRON 139x6.3',
            plot_metallique: firstEqDetails?.plotMetallique || sector.plotMetallique || 'TCAR 200x5',
            bras_de_deport: firstEqDetails?.brasDeDeport || sector.brasDeDeport || 'TCAR 50x5',
            mat_secondaire: firstEqDetails?.matSecondaire || sector.matSecondaire || 'TRON 76x5',
            material_name: 'S 235',
            plot_section: firstEqDetails?.plotMetallique || sector.plotMetallique || 'TCAR 200x5',
            bras_section: firstEqDetails?.brasDeDeport || sector.brasDeDeport || 'TCAR 50x5',
            mast_5g_section: firstEqDetails?.matSecondaire || sector.matSecondaire || 'TRON 76x5',
            mast_section: firstEqDetails?.matPrincipal || sector.matPrincipal || 'TRON 139x6.3',
            nombre_secteurs: groupIndicesCount,
            echelle: selectedEchelle
          },
          antenna_4g: {
            model: sector.ant4gConfig.model,
            hauteur_mm: sector.ant4gConfig.height,
            largeur_mm: sector.ant4gConfig.width,
            epaisseur_mm: sector.ant4gConfig.thickness,
            poids_kg: sector.ant4gConfig.weight
          },
          antenna_5g: {
            model: sector.ant5gConfig.model,
            hauteur_mm: sector.ant5gConfig.height,
            largeur_mm: sector.ant5gConfig.width,
            epaisseur_mm: sector.ant5gConfig.thickness,
            poids_kg: sector.ant5gConfig.weight
          },
          ...buildSectorEquipmentPayload({
            sector,
            zoneTechnique,
            operator,
            config,
            coffretQuantityMultiplier: groupIndicesCount,
            resolveRru,
            resolveRrh,
            resolveBaieItems,
          }),
          site_image_url: siteImageUrl,
          force_recalculate: FORCE_RECALCULATE_BYPASS_CACHE || Boolean(forceRecalculate)
        };

        try {
          const calcData = await apiClient.post<{ data: { id: string }; status?: string; cached?: boolean }>(
            '/api/calculations/',
            payload,
            { baseUrl: apiBaseUrl }
          );
          createdJobs.push({
            id: calcData.data.id,
            status: calcData.status,
            cached: calcData.cached,
          });
        } catch (err) {
          console.error(`[NDC Job Creation Error - Groupe ${i + 1}]:`, err);
          throw new Error("Impossible d'initialiser le calcul sur le serveur. Veuillez réessayer.");
        }
      }

      const jobIds = createdJobs.map((j) => j.id);

      // Track all jobs with live interactive progress (WebSocket + polling fallback)
      const totalJobs = createdJobs.length;
      for (let idx = 0; idx < totalJobs; idx++) {
        const { id: jobId, status: initialStatus, cached: isCacheHit } = createdJobs[idx];
        const sectorPrefix = totalJobs > 1 ? `[Secteur ${idx + 1}/${totalJobs}] ` : '';

        if (initialStatus === 'COMPLETED' || isCacheHit) {
          const donePct = Math.round(((idx + 1) / totalJobs) * 90);
          setSiteNdcProgressPercent(donePct);
          setSiteNdcPollingMsg(`${sectorPrefix}Résultat chargé depuis le cache (${donePct}%)`);
          continue;
        }

        const startPct = Math.max(5, Math.round((idx / totalJobs) * 90));
        setSiteNdcProgressPercent(startPct);
        setSiteNdcPollingMsg(`${sectorPrefix}Démarrage du calcul Robot... (${startPct}%)`);

        let isCompleted = false;
        let attempts = 0;
        const maxAttempts = 180; // 6 minutes maximum

        const updateSectorProgress = (rawPercent: unknown, message?: string) => {
          const hasNum = typeof rawPercent === 'number' && !Number.isNaN(rawPercent);
          if (hasNum) {
            const clamped = Math.max(0, Math.min(100, rawPercent as number));
            const overall = Math.max(5, Math.min(92, Math.round(((idx + clamped / 100) / totalJobs) * 90)));
            setSiteNdcProgressPercent(overall);
          }
          if (message) {
            const pctStr = hasNum ? ` (${rawPercent}%)` : '';
            setSiteNdcPollingMsg(`${sectorPrefix}${message}${pctStr}`);
          }
        };

        // Open WebSocket connection for real-time progress push
        let ws: WebSocket | null = null;
        try {
          const wsUrl = buildWebSocketUrl(`/ws/calculations/${jobId}/`, undefined, apiBaseUrl);
          ws = new WebSocket(wsUrl);
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.message || typeof data.percent === 'number') {
                updateSectorProgress(data.percent, data.message);
              }
              if (data.status === 'COMPLETED' || data.is_completed) {
                isCompleted = true;
              }
            } catch (_) {
              // Ignore malformed WS frames
            }
          };
          ws.onerror = () => {
            // Silently allow fallback to HTTP polling
          };
        } catch (_) {
          // WebSocket not supported or blocked, will use polling
        }

        try {
          while (!isCompleted && attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));
            if (isCompleted) break;
            try {
              const jobResult = await apiClient.get<any>(`/api/calculations/${jobId}/`, {
                baseUrl: apiBaseUrl,
              });
              const prog = jobResult.result_data?.progress;
              if (prog && prog.message) {
                updateSectorProgress(prog.percent, prog.message);
              } else if (jobResult.status === 'RUNNING' || jobResult.status === 'PROCESSING') {
                const fallbackPct = Math.max(5, Math.min(90, Math.round(((idx + 0.1) / totalJobs) * 90)));
                setSiteNdcProgressPercent((prev) => (prev !== null && prev > fallbackPct ? prev : fallbackPct));
                setSiteNdcPollingMsg((prev) =>
                  prev && prev.includes('%') ? prev : `${sectorPrefix}Calcul Robot en cours d'exécution... (${fallbackPct}%)`
                );
              }

              if (jobResult.status === 'COMPLETED' || (jobResult.status === 'PENDING' && jobResult.result_data?.ndc_pdf_url)) {
                isCompleted = true;
              } else if (jobResult.status === 'FAILED' || jobResult.status === 'ERROR' || jobResult.status === 'REJECTED') {
                const errMsg = jobResult.error_message || (jobResult.status === 'REJECTED'
                  ? "Calcul rejeté : paramètres de mât ou données invalides."
                  : "Le calcul Robot a échoué. Veuillez réessayer.");
                console.error(`[Robot Worker Calculation Failure - Job ${jobId}]:`, errMsg, jobResult);
                throw new Error(errMsg);
              }
            } catch (pollErr: any) {
              if (pollErr?.message && pollErr.message !== "Le délai d'attente du calcul Robot a été dépassé. Veuillez réessayer.") {
                throw pollErr;
              }
              // Transient network glitch during poll; continue retrying
            }
            attempts++;
          }
        } finally {
          if (ws) {
            try { ws.close(); } catch (_) { }
          }
        }

        if (!isCompleted) {
          console.error(`[NDC Timeout]: Délai d'attente dépassé pour le calcul du secteur ${idx + 1}. JobId: ${jobId}`);
          throw new Error("Le délai d'attente du calcul Robot a été dépassé. Veuillez réessayer.");
        }
      }

      setSiteNdcProgressPercent(95);
      setSiteNdcPollingMsg('Fusion des documents PDF... (95%)');

      // Call the merge endpoint
      let mergeData: { ndc_pdf_url?: string };
      try {
        mergeData = await apiClient.post<{ ndc_pdf_url?: string }>(
          '/api/calculations/generate_site_ndc/',
          {
            job_ids: jobIds,
            photo_url: siteImageUrl,
            site_name: siteName,
            code_site: codeSite,
            ref_site: codeSite,
            client_name: clientName,
            address: selectedAddress?.label || selectedAddress?.name || ''
          },
          { baseUrl: apiBaseUrl }
        );
      } catch (mergeErr: any) {
        const serverError = mergeErr?.message || "Erreur lors de la génération du document global. Veuillez réessayer.";
        console.error('[NDC Site Merge Error]:', serverError);
        throw new Error(serverError);
      }

      if (mergeData.ndc_pdf_url) {
        const fullUrl = resolveMediaUrl(mergeData.ndc_pdf_url, apiBaseUrl);
        setSiteNdcProgressPercent(100);
        setNdcPdfUrl(fullUrl);
      } else {
        throw new Error('URL de document manquant dans la réponse.');
      }

    } catch (e: any) {
      console.error('[NDC Generation Failed - Technical Error Details]:', e);
      const rawMessage = e?.message || '';
      let friendlyMessage = 'Le calcul Robot a échoué. Veuillez réessayer.';
      if (rawMessage.startsWith('Veuillez ') || rawMessage.includes('saisir') || rawMessage.includes('uploader') || rawMessage.includes('incomplet') || rawMessage.includes('artéfacts')) {
        friendlyMessage = rawMessage;
      } else if (rawMessage && !rawMessage.includes('Calcul Robot rejeté') && !rawMessage.includes('500') && !rawMessage.includes('Traceback')) {
        friendlyMessage = rawMessage;
      }
      setSiteNdcError(friendlyMessage);
    } finally {
      setIsGeneratingSiteNdc(false);
      setSiteNdcPollingMsg('');
      setSiteNdcProgressPercent(null);
    }
  }, [
    activeSectors,
    zoneTechnique,
    isFullyStandard,
    uniqueGroups,
    foundationType,
    selectedBuildingHeight,
    config,
    apiBaseUrl,
    siteImageUrl,
    siteName,
    codeSite,
    clientName,
    clientLogoUrl,
    selectedAddress,
    selectedCoords,
    siteType,
    structureCase,
    etancheite,
    dalleThickness,
    plotHeight,
    selectedEchelle,
    operator,
    nombreSecteurs,
    resolveRrh,
    resolveRru,
    resolveTd,
    resolveBaieItems
  ]);

  const resetGenerator = useCallback(() => {
    setNdcPdfUrl(null);
    setSiteNdcError(null);
    setSiteNdcPollingMsg('');
    setSiteNdcProgressPercent(null);
    setIsGeneratingSiteNdc(false);
  }, []);

  return {
    isGeneratingSiteNdc,
    siteNdcPollingMsg,
    siteNdcProgressPercent,
    siteNdcError,
    setSiteNdcError,
    ndcPdfUrl,
    setNdcPdfUrl,
    isFullyStandard,
    confirmGenerateSiteNdc,
    resetGenerator
  };
}

export default useSiteNdcGenerator;
