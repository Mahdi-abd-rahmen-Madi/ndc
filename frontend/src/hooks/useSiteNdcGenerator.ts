import { useState, useCallback } from 'react';
import type {
  SectorData,
  CatalogueConfig,
  ZoneTechniqueData,
  SelectedBaieItem
} from '../components/regular-user/types';
import { getTerrainDetails } from '../components/regular-user/PdfGenerator';
import { DEFAULT_ORANGE_BAIES } from '../components/regular-user/equipment/BaieEquipmentToggle';

export interface UseSiteNdcGeneratorParams {
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
  const [siteNdcError, setSiteNdcError] = useState<string | null>(null);
  const [ndcPdfUrl, setNdcPdfUrl] = useState<string | null>(null);

  // Determine if all sectors match the catalogue perfectly (Fast-Track eligible)
  const isFullyStandard = useCallback(() => {
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
      if (foundationType === 'metallique') {
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
  }, [uniqueGroups, config, foundationType, selectedBuildingHeight]);

  const confirmGenerateSiteNdc = useCallback(async () => {
    setIsGeneratingSiteNdc(true);
    setSiteNdcError(null);

    const s1 = activeSectors[0];
    const hasFhEquipment = !!s1?.hasFhEquipment;
    const fhDiameter = s1?.fhDiameter ?? 300;
    const fhReference = s1?.fhReference ?? '';
    const fhQuantity = s1?.fhQuantity ?? 1;
    const hasRrhEquipment = !!s1?.hasRrhEquipment;
    const rrhItems = s1?.rrhItems ?? [];
    const hasRruEquipment = !!s1?.hasRruEquipment;
    const rruItems = s1?.rruItems ?? [];
    const hasCoffret = !!s1?.hasCoffret;
    const coffretReference = s1?.coffretReference ?? '';

    const {
      hasTdEquipment, tdType, tdReference, tgbtReference,
      hasGps, gpsReference, gpsMarque,
      hasBoitierLovage, boitierLovageReference, boitierLovageQuantity,
      hasAtelierEnergie, bcubeReference,
      hasBaie, baieRadio, baieEnergie, baieItems,
      hasCab, cabOne, cabTwo, cabThree, cabSupport,
      atelierFprb, atelierFprbQuantity, atelierFpbc, atelierFpbcQuantity,
      hasConvertisseurMdea, convertisseurMdeaQuantity
    } = zoneTechnique;

    try {
      const token = localStorage.getItem('ndc_auth_token') || '';

      // --- FAST TRACK (INSTANT NDC) ---
      if (isFullyStandard()) {
        setSiteNdcPollingMsg('Génération du document Standard (Instantané)...');

        // Extract the correct catalogue PDF URLs from the terrain details
        const catalogueUrls = [];
        for (const g of uniqueGroups) {
          const eq = g.sector.lookupResult?.equipment[0];
          if (eq) {
            const height = foundationType === 'metallique'
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

            const response = await fetch(`${apiBaseUrl}/api/geodata/matching-catalogue-pdf/?${params.toString()}`);
            if (response.ok) {
              const data = await response.json();
              if (data.url) catalogueUrls.push(data.url);
            }
          }
        }

        const payload = {
          fast_track: true,
          catalogue_pdf_urls: catalogueUrls,
          photo_url: siteImageUrl,
          site_name: siteName,
          code_site: codeSite,
          ref_site: codeSite,
          client_name: clientName,
          address: selectedAddress?.label || selectedAddress?.name || '',
          etancheite: etancheite,
          dalle_thickness_m: dalleThickness ? parseFloat(String(dalleThickness)) / 100 : null,
          environment: {
            terrain_type: activeSectors[0]?.lookupResult?.detected_terrain_type || 'IIIa',
            region: activeSectors[0]?.lookupResult?.detected_region || '1',
            building_height_m: Number(selectedBuildingHeight) || 0,
            plot_height_m: 0.6
          },
          structure: {
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
          fh_equipment: {
            enabled: hasFhEquipment,
            diameter_mm: hasFhEquipment ? fhDiameter : null,
            reference: hasFhEquipment ? (config?.fh_references?.find((r: any) => r.id === fhReference)?.reference || null) : null,
            quantity: hasFhEquipment ? fhQuantity : null,
            weight_kg: hasFhEquipment ? (config?.fh_references?.find((r: any) => r.id === fhReference)?.weight || null) : null
          },
          rrh_equipment: {
            enabled: operator !== 'bouygues' && hasRrhEquipment,
            items: (operator !== 'bouygues' && hasRrhEquipment) ? rrhItems.map(item => ({ reference: resolveRrh(item.reference), quantity: item.quantity * nombreSecteurs })) : []
          },
          rru_equipment: {
            enabled: hasRruEquipment,
            items: hasRruEquipment ? rruItems.map(item => ({ reference: resolveRru(item.reference), quantity: item.quantity * nombreSecteurs })) : []
          },
          td_equipment: {
            enabled: hasTdEquipment,
            type: hasTdEquipment ? tdType : null,
            reference: hasTdEquipment ? tdReference : null,
            tgbt_reference: hasTdEquipment && tdType === 'monophase' ? tgbtReference : null
          },
          gps: { enabled: hasGps, quantity: 1, marque: hasGps ? gpsMarque : null, reference: hasGps ? gpsReference : null },
          boitier_lovage: { enabled: hasBoitierLovage, quantity: boitierLovageQuantity, reference: hasBoitierLovage ? boitierLovageReference : null },
          coffrets_fibre: { enabled: hasCoffret, quantity: hasCoffret ? nombreSecteurs : 1, reference: hasCoffret ? coffretReference : null },
          coffrets_hybride: { enabled: false, quantity: null, reference: null },
          baie: {
            enabled: operator === 'orange' && hasBaie,
            items: operator === 'orange' && hasBaie ? resolveBaieItems(baieItems) : [],
            baie_radio: operator === 'orange' && hasBaie && (baieRadio || baieItems.some(i => {
              const ref = (config?.baie_references || DEFAULT_ORANGE_BAIES).find(b => b.id === i.referenceId);
              return ref?.category === 'radio_trans';
            })),
            baie_energie: operator === 'orange' && hasBaie && (baieEnergie || baieItems.some(i => {
              const ref = (config?.baie_references || DEFAULT_ORANGE_BAIES).find(b => b.id === i.referenceId);
              return ref?.category === 'energie';
            }))
          },
          cab: {
            enabled: operator === 'free' && hasCab,
            cab_one: operator === 'free' && hasCab && cabOne,
            cab_two: operator === 'free' && hasCab && cabTwo,
            cab_three: operator === 'free' && hasCab && cabThree,
            support: operator === 'free' && hasCab ? cabSupport : null
          },
          atelier_energie: {
            enabled: (operator === 'free' || operator === 'bouygues') && hasAtelierEnergie,
            module_fprb: operator === 'free' && hasAtelierEnergie && atelierFprb,
            module_fprb_quantity: operator === 'free' && hasAtelierEnergie && atelierFprb ? atelierFprbQuantity : 0,
            module_fpbc: operator === 'free' && hasAtelierEnergie && atelierFpbc,
            module_fpbc_quantity: operator === 'free' && hasAtelierEnergie && atelierFpbc ? atelierFpbcQuantity : 0,
            bcube: (operator === 'bouygues' && hasAtelierEnergie) ? bcubeReference : null
          },
          convertisseur_mdea: {
            enabled: operator === 'free' && hasConvertisseurMdea,
            quantite: operator === 'free' && hasConvertisseurMdea ? convertisseurMdeaQuantity : 0,
            dimensions: '338*295*140mm',
            poids: 10
          }
        };

        const res = await fetch(`${apiBaseUrl}/api/calculations/generate_site_ndc/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const mergeData = await res.json();
          if (mergeData.ndc_pdf_url) {
            const fullUrl = mergeData.ndc_pdf_url.startsWith('http')
              ? mergeData.ndc_pdf_url
              : `${window.location.origin}${mergeData.ndc_pdf_url}`;

            setIsGeneratingSiteNdc(false);
            setNdcPdfUrl(fullUrl);
            return; // Done! Bypassed Robot!
          }
        }
        // If Fast-Track fails for some reason, fall through to Robot Calculation
        console.warn("Fast-Track failed, falling back to Robot calculation");
      }

      // --- ROBOT CALCULATION (CUSTOM TRACK) ---
      setSiteNdcPollingMsg('Lancement des calculs Robot pour chaque secteur...');
      const jobIds: string[] = [];

      // Create a job for each unique group
      for (let i = 0; i < uniqueGroups.length; i++) {
        const group = uniqueGroups[i];
        const sector = group.sector;
        const groupIndicesCount = group.indices.length;

        const firstEqDetails = sector.lookupResult && sector.lookupResult.equipment.length > 0
          ? getTerrainDetails(sector.lookupResult.equipment[0], sector.lookupResult.detected_terrain_type)
          : null;

        const payload = {
          schema_version: "1.0",
          site: {
            type: siteType,
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
          fh_equipment: {
            enabled: hasFhEquipment,
            diameter_mm: hasFhEquipment ? fhDiameter : null,
            reference: hasFhEquipment ? (config?.fh_references?.find(r => r.id === fhReference)?.reference || null) : null,
            quantity: hasFhEquipment ? fhQuantity : null,
            weight_kg: hasFhEquipment ? (config?.fh_references?.find(r => r.id === fhReference)?.weight || null) : null
          },
          rrh_equipment: {
            enabled: operator !== 'bouygues' && hasRrhEquipment,
            items: (operator !== 'bouygues' && hasRrhEquipment) ? rrhItems.map(item => ({ reference: resolveRrh(item.reference), quantity: item.quantity * nombreSecteurs })) : []
          },
          rru_equipment: {
            enabled: hasRruEquipment,
            items: hasRruEquipment ? rruItems.map(item => ({ reference: resolveRru(item.reference), quantity: item.quantity * nombreSecteurs })) : []
          },
          td_equipment: {
            enabled: hasTdEquipment,
            type: hasTdEquipment ? tdType : null,
            reference: hasTdEquipment ? tdReference : null,
            tgbt_reference: hasTdEquipment && tdType === 'monophase' ? tgbtReference : null
          },
          gps: { enabled: hasGps, quantity: 1, marque: hasGps ? gpsMarque : null, reference: hasGps ? gpsReference : null },
          boitier_lovage: { enabled: hasBoitierLovage, quantity: boitierLovageQuantity, reference: hasBoitierLovage ? boitierLovageReference : null },
          coffrets_fibre: { enabled: hasCoffret, quantity: hasCoffret ? nombreSecteurs : 1, reference: hasCoffret ? coffretReference : null },
          coffrets_hybride: { enabled: false, quantity: null, reference: null },
          baie: {
            enabled: operator === 'orange' && hasBaie,
            items: operator === 'orange' && hasBaie ? resolveBaieItems(baieItems) : [],
            baie_radio: operator === 'orange' && hasBaie && (baieRadio || baieItems.some(i => {
              const ref = (config?.baie_references || DEFAULT_ORANGE_BAIES).find(b => b.id === i.referenceId);
              return ref?.category === 'radio_trans';
            })),
            baie_energie: operator === 'orange' && hasBaie && (baieEnergie || baieItems.some(i => {
              const ref = (config?.baie_references || DEFAULT_ORANGE_BAIES).find(b => b.id === i.referenceId);
              return ref?.category === 'energie';
            }))
          },
          cab: {
            enabled: operator === 'free' && hasCab,
            cab_one: operator === 'free' && hasCab && cabOne,
            cab_two: operator === 'free' && hasCab && cabTwo,
            cab_three: operator === 'free' && hasCab && cabThree,
            support: operator === 'free' && hasCab ? cabSupport : null
          },
          atelier_energie: {
            enabled: (operator === 'free' || operator === 'bouygues') && hasAtelierEnergie,
            module_fprb: operator === 'free' && hasAtelierEnergie && atelierFprb,
            module_fprb_quantity: operator === 'free' && hasAtelierEnergie && atelierFprb ? atelierFprbQuantity : 0,
            module_fpbc: operator === 'free' && hasAtelierEnergie && atelierFpbc,
            module_fpbc_quantity: operator === 'free' && hasAtelierEnergie && atelierFpbc ? atelierFpbcQuantity : 0,
            bcube: (operator === 'bouygues' && hasAtelierEnergie) ? bcubeReference : null
          },
          convertisseur_mdea: {
            enabled: operator === 'free' && hasConvertisseurMdea,
            quantite: operator === 'free' && hasConvertisseurMdea ? convertisseurMdeaQuantity : 0,
            dimensions: '338*295*140mm',
            poids: 10
          },
          site_image_url: siteImageUrl
        };

        const res = await fetch(`${apiBaseUrl}/api/calculations/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const calcData = await res.json();
          jobIds.push(calcData.data.id);
        } else {
          const errorText = await res.text();
          console.error(`Erreur création job groupe ${i + 1}:`, errorText);
          throw new Error(`Erreur lors de la création du job pour le groupe ${i + 1}: ${errorText}`);
        }
      }

      setSiteNdcPollingMsg('Attente des résultats Robot...');

      // Poll all jobs until COMPLETED
      for (const jobId of jobIds) {
        let isCompleted = false;
        let attempts = 0;
        while (!isCompleted && attempts < 120) {
          await new Promise(r => setTimeout(r, 2000));
          const pollRes = await fetch(`${apiBaseUrl}/api/calculations/${jobId}/`, {
            headers: { 'Authorization': `Token ${token}` }
          });
          if (pollRes.ok) {
            const jobResult = await pollRes.json();
            if (jobResult.status === 'COMPLETED' || (jobResult.status === 'PENDING' && jobResult.result_data)) {
              isCompleted = true;
            } else if (jobResult.status === 'FAILED' || jobResult.status === 'ERROR') {
              throw new Error("Calcul échoué sur le serveur pour l'un des secteurs.");
            }
          }
          attempts++;
        }
        if (!isCompleted) {
          throw new Error("Délai d'attente dépassé pour les calculs.");
        }
      }

      setSiteNdcPollingMsg('Fusion des documents PDF...');

      // Call the merge endpoint
      const mergeRes = await fetch(`${apiBaseUrl}/api/calculations/generate_site_ndc/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({
          job_ids: jobIds,
          photo_url: siteImageUrl,
          site_name: siteName,
          code_site: codeSite,
          ref_site: codeSite,
          client_name: clientName,
          address: selectedAddress?.label || selectedAddress?.name || ''
        })
      });

      if (!mergeRes.ok) {
        const errorText = await mergeRes.text();
        console.error('Erreur génération globale:', errorText);
        throw new Error(`Erreur lors de la génération du document global: ${errorText}`);
      }

      const mergeData = await mergeRes.json();

      if (mergeData.ndc_pdf_url) {
        const fullUrl = mergeData.ndc_pdf_url.startsWith('http')
          ? mergeData.ndc_pdf_url
          : `${window.location.origin}${mergeData.ndc_pdf_url}`;
        setNdcPdfUrl(fullUrl);
      } else {
        throw new Error('URL de document manquant dans la réponse.');
      }

    } catch (e: any) {
      console.error(e);
      setSiteNdcError(e.message || 'Une erreur est survenue.');
    } finally {
      setIsGeneratingSiteNdc(false);
      setSiteNdcPollingMsg('');
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
    setIsGeneratingSiteNdc(false);
  }, []);

  return {
    isGeneratingSiteNdc,
    siteNdcPollingMsg,
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
