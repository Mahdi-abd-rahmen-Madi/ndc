import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { LookupResult, SectorData, AntennaConfigState } from './types';
import { getEnabledConfigs } from '../../config/equipmentConfig';
import PdfPreviewModal from './PdfPreviewModal';
import { ResultsSiteHeader, AerialResultsSection, TechnicalZoneSection } from './results';

export interface ResultsPanelProps {
  lookupResult: LookupResult | null;
  selectedAddress: any;
  selectedMontage: string;
  isSearching: boolean;
  matPrincipal?: string;
  plotMetallique?: string;
  brasDeDeport?: string;
  matSecondaire?: string;
  nombreSecteurs?: number;
  equipmentValues?: Record<string, any>;
  equipmentToggles?: Record<string, boolean>;
  ndcPdfUrl?: string | null;
  sectors?: SectorData[];
  siteImageUrl?: string | null;
  siteName?: string;
  codeSite?: string;
  clientName?: string;
  clientLogoUrl?: string | null;
  ant4gConfig?: AntennaConfigState;
  ant5gConfig?: AntennaConfigState;
  buildingHeight?: number;
  mastHeight?: number;
  plotHeight?: number;
  recommendedMastSection?: string;
  recommendedPlotSection?: string;
  recommendedBrasSection?: string;
  recommendedMast5gSection?: string;
  hideAnalysisHeader?: boolean;
  headerOnly?: boolean;
  showSectorsCount?: boolean;
  showSectorsConfig?: boolean;
  showEquipmentConfig?: boolean;
  showAerialEquipmentConfig?: boolean;
  showTechniqueEquipmentConfig?: boolean;
  operator?: string;
}

export default function ResultsPanel({
  lookupResult,
  selectedAddress,
  isSearching,
  operator = 'bouygues',
  nombreSecteurs = 3,
  equipmentValues = {},
  equipmentToggles = {},
  sectors = [],
  ant4gConfig,
  ant5gConfig,
  mastHeight,
  hideAnalysisHeader = false,
  headerOnly = false,
  showSectorsCount = true,
  showSectorsConfig = true,
  showEquipmentConfig = true,
  showAerialEquipmentConfig,
  showTechniqueEquipmentConfig
}: ResultsPanelProps) {
  const isAerialEquipVisible = showAerialEquipmentConfig !== undefined ? showAerialEquipmentConfig : showEquipmentConfig;
  const isTechniqueEquipVisible = showTechniqueEquipmentConfig !== undefined ? showTechniqueEquipmentConfig : showEquipmentConfig;

  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [conversionError, setConversionError] = useState(false);

  const enabledConfigs = getEnabledConfigs(equipmentToggles);
  const aerialConfigs = enabledConfigs.filter(c => {
    if (c.zone !== 'aerienne') return false;
    if (c.id === 'rrh' && operator === 'bouygues') return false;
    if (c.id === 'baie' && operator !== 'orange') return false;
    return true;
  });
  const techniqueConfigs = enabledConfigs.filter(c => c.zone === 'technique');

  const displaySectors: SectorData[] = (sectors && sectors.length > 0)
    ? sectors
    : (ant4gConfig || ant5gConfig)
      ? [{
        id: 'sector-default',
        selectedHeight: mastHeight || 3,
        selectedMontage4G: ant4gConfig?.model || '',
        selectedMontage5G: ant5gConfig?.model || '',
        ant4gConfig: ant4gConfig || { model: '', height: 0, width: 0, thickness: 0, weight: 0 },
        ant5gConfig: ant5gConfig || { model: '', height: 0, width: 0, thickness: 0, weight: 0 },
      } as unknown as SectorData]
      : [];

  if (!lookupResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 h-full min-h-[400px]">
        <MapPin className="w-16 h-16 mb-4 opacity-30 text-slate-300" />
        <h3 className="text-xl font-bold text-slate-700 mb-2">Aucun résultat</h3>
        <p className="text-sm text-slate-500 text-center max-w-sm">
          Remplissez les critères de recherche à gauche pour obtenir la classification environnementale et le profil structurel.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* 1. Header du site (Titre, Secteurs, Région de vent, Adresse) */}
      {!hideAnalysisHeader && (
        <ResultsSiteHeader
          lookupResult={lookupResult}
          selectedAddress={selectedAddress}
          isSearching={isSearching}
          nombreSecteurs={nombreSecteurs}
          showSectorsCount={showSectorsCount}
        />
      )}

      {!headerOnly && (
        <>
          {/* 2. Section Aériens (Antennes 4G & 5G + Équipements de mât) */}
          <AerialResultsSection
            displaySectors={displaySectors}
            aerialConfigs={aerialConfigs}
            showSectorsConfig={showSectorsConfig}
            isAerialEquipVisible={isAerialEquipVisible}
            operator={operator}
            nombreSecteurs={nombreSecteurs}
            equipmentValues={equipmentValues}
          />

          {/* 3. Section Zone Technique (Baies, TD, GPS, Lovage, CAB, Atelier, BCube, MDEA) */}
          <TechnicalZoneSection
            techniqueConfigs={techniqueConfigs}
            isTechniqueEquipVisible={isTechniqueEquipVisible}
            operator={operator}
            nombreSecteurs={nombreSecteurs}
            equipmentValues={equipmentValues}
          />

          {/* Modal PDF Preview */}
          <PdfPreviewModal
            previewPdfUrl={previewPdfUrl}
            conversionError={conversionError}
            onClose={() => setPreviewPdfUrl(null)}
          />

          {conversionError && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl text-center">
              <p className="text-sm text-rose-600">
                Impossible de prévisualiser ce document. Veuillez le télécharger.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
