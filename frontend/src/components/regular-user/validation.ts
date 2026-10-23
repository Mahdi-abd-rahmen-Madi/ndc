import { SectorData, ZoneTechniqueData, ProjectData } from './types';

export interface ValidationParams {
  project: ProjectData;
  foundationType: string;
  sectors: SectorData[];
  nombreSecteurs: number;
  zoneTechnique: ZoneTechniqueData;
  selectedCoords: { latitude: number; longitude: number } | null;
  pendingGenericAddress: any;
  isInfoConfirmed: boolean;
}

export interface ValidationResult {
  missingRequirements: string[];
  canGenerate: boolean;
  missingStep3Equipments: string[];
  missingStep4Equipments: string[];
  isStep1Complete: boolean;
  isStep2Complete: boolean;
  isStep3Complete: boolean;
  isStep4Complete: boolean;
  allSectionsFilled: boolean;
  isConfirmed: boolean;
}

export function calculateStepValidation(params: ValidationParams): ValidationResult {
  const {
    project,
    foundationType,
    sectors,
    nombreSecteurs,
    zoneTechnique,
    selectedCoords,
    pendingGenericAddress,
    isInfoConfirmed
  } = params;

  const {
    siteName,
    clientName,
    siteImageUrl,
    buildingHeight,
    dalleThickness,
    etancheite,
    selectedEchelle,
    operator
  } = project;

  const missingRequirements: string[] = [];
  if (!siteName.trim()) missingRequirements.push('Nom du site');
  if (!clientName.trim()) missingRequirements.push('Nom du client');
  if (!siteImageUrl) missingRequirements.push('Photo du site');
  if (buildingHeight === '') missingRequirements.push('Hauteur bâtiment');
  if (foundationType !== 'encastre') {
    if (dalleThickness === '') missingRequirements.push('Épaisseur dalle');
    if (etancheite === '') missingRequirements.push('Étanchéité');
  }
  if (!selectedEchelle.trim()) missingRequirements.push('Échelle');
  const canGenerate = missingRequirements.length === 0;

  const activeSectors = sectors.slice(0, nombreSecteurs);
  const missingStep3Equipments: string[] = [];
  activeSectors.forEach((sector, idx) => {
    const secLabel = nombreSecteurs > 1 ? ` (Secteur ${idx + 1})` : '';
    if (sector.hasFhEquipment && !sector.fhReference) {
      missingStep3Equipments.push(`Référence FH${secLabel}`);
    }

    if (operator !== 'bouygues' && sector.hasRrhEquipment) {
      const rrhList = sector.rrhItems ?? [];
      if (rrhList.length === 0 || rrhList.some(i => !i.reference || !i.vendor)) {
        missingStep3Equipments.push(`Référence RRH${secLabel}`);
      }
    }

    if (sector.hasRruEquipment) {
      const rruList = sector.rruItems ?? [];
      if (rruList.length === 0 || rruList.some(i => !i.reference || !i.vendor)) {
        missingStep3Equipments.push(`Référence ${operator === 'free' ? 'RF NSN' : 'RRU'}${secLabel}`);
      }
    }

    if (sector.hasCoffret && !sector.coffretReference) {
      missingStep3Equipments.push(`Référence Coffret fibre${secLabel}`);
    }
  });

  const missingStep4Equipments: string[] = [];
  if (zoneTechnique.hasTdEquipment && !zoneTechnique.tdReference) {
    missingStep4Equipments.push('Référence TD');
  }
  if (zoneTechnique.hasGps && !zoneTechnique.gpsReference) {
    missingStep4Equipments.push('Référence GPS');
  }
  if (zoneTechnique.hasBoitierLovage && !zoneTechnique.boitierLovageReference) {
    missingStep4Equipments.push('Référence Boîtier de lovage');
  }
  if (operator === 'bouygues' && zoneTechnique.hasAtelierEnergie && !zoneTechnique.bcubeReference) {
    missingStep4Equipments.push('Modèle BCube');
  }

  const isStep1Complete = !!selectedCoords && !pendingGenericAddress;
  const isStep2Complete = canGenerate;
  const isStep3Complete =
    activeSectors.length > 0 &&
    activeSectors.every(s => Boolean(s.selectedMontage4G) && Boolean(s.selectedMontage5G)) &&
    missingStep3Equipments.length === 0;
  const isStep4Complete = missingStep4Equipments.length === 0;
  const allSectionsFilled = isStep1Complete && isStep2Complete && isStep3Complete && isStep4Complete;
  const isConfirmed = isInfoConfirmed && allSectionsFilled;

  return {
    missingRequirements,
    canGenerate,
    missingStep3Equipments,
    missingStep4Equipments,
    isStep1Complete,
    isStep2Complete,
    isStep3Complete,
    isStep4Complete,
    allSectionsFilled,
    isConfirmed
  };
}
