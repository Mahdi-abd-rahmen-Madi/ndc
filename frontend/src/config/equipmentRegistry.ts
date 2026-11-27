import type {
  CatalogueConfig,
  EquipmentItem,
  SectorData,
  SelectedBaieItem,
  ZoneTechniqueData,
} from '../components/regular-user/types';
import { DEFAULT_FH_REFERENCES, DEFAULT_ORANGE_BAIES, GPS_REFERENCE_SPECS, STATIC_EQUIPMENT_SPECS } from './catalogueDefaults';

// ============================================================================
// Canonical Display Labels (Single Source of Truth across UI, Modals & Results)
// ============================================================================

export const FOUNDATION_LABELS: Record<string, string> = {
  metallique: 'Plot métallique',
  beton: 'Plot Béton',
  encastre: 'Encastré',
  dallettes: 'Dallettes',
};

export function formatFoundationLabel(foundationType?: string | null): string {
  if (!foundationType) return 'Plot métallique';
  return FOUNDATION_LABELS[foundationType] || foundationType;
}

export function isSansPlotFromFoundation(foundationType?: string | null): boolean {
  return (foundationType || '').toLowerCase().trim() === 'dallettes';
}

export const SUPPORT_ECHELLE_MIN_MAST_HEIGHT_M = 2.0;
export const FH_ECHELLE_MIN_MAST_HEIGHT_M = SUPPORT_ECHELLE_MIN_MAST_HEIGHT_M;

export function resolveSupportEchelle(
  hauteurMatM?: number | null,
  defaultHauteurMatM = 1.50
): string {
  const h = Number(hauteurMatM ?? defaultHauteurMatM);
  return Number.isFinite(h) && h >= SUPPORT_ECHELLE_MIN_MAST_HEIGHT_M
    ? 'Echelle'
    : "Pas d'échelle";
}

export function isFhEchelleAllowed(_sansPlot?: boolean, hauteurMatM?: number | null): boolean {
  const h = Number(hauteurMatM ?? 1.70);
  return Number.isFinite(h) && h >= SUPPORT_ECHELLE_MIN_MAST_HEIGHT_M;
}

export function normalizeFhEchelle(val?: string | null): string {
  const trimmed = (val || '').trim();
  if (!trimmed) return "Pas d'échelle";
  const lower = trimmed.toLowerCase();
  if (lower.includes("pas d'echelle") || lower.includes("pas d'échelle")) {
    return "Pas d'échelle";
  }
  return 'Echelle';
}

export const CAB_SUPPORT_LABELS: Record<string, string> = {
  plinthes: 'Plinthes',
  support_autostable: 'Support Autostable',
  support_fimo: 'Support FIMO',
  support_muraux: 'Supports Muraux',
};

export const AMOD_LABELS: Record<string, string> = {
  asib: 'ASIB (4G)',
  asik: 'ASIK (5G)',
  abia: 'ABIA (4G)',
  abil: 'ABIL (5G)',
  abio: 'ABIO (4G/5G)',
  free_amod_asib_4g: 'ASIB (4G)',
  free_amod_asik_5g: 'ASIK (5G)',
  free_amod_abia_4g: 'ABIA (4G)',
  free_amod_abil_5g: 'ABIL (5G)',
  free_amod_abio_4g_5g: 'ABIO (4G/5G)',
};

export function stripVendorPrefix(ref: string, vendor?: string): string {
  if (!ref) return '';
  if (!vendor) return ref;
  const cleanRef = ref.trim();
  const cleanVendor = vendor.trim();
  if (cleanRef.toUpperCase().startsWith(cleanVendor.toUpperCase())) {
    return cleanRef.substring(cleanVendor.length).trim();
  }
  return cleanRef;
}

// ============================================================================
// Operator Gating & Zone Technique Predicates (Single Source of Truth)
// ============================================================================

export function isEquipmentAllowedForOperator(equipmentId: string, operator: string): boolean {
  const op = (operator || '').toLowerCase().trim();
  switch (equipmentId) {
    case 'fh':
      return op !== 'orange';
    case 'rrh':
      return op !== 'bouygues';
    case 'td':
      return op !== 'bouygues' && op !== 'orange';
    case 'coffrets_fibre':
      return op !== 'free';
    case 'boitier_jonction':
    case 'coffret_trans_fo':
    case 'cab':
    case 'convertisseur_mdea':
    case 'pile_amod':
      return op === 'free';
    case 'baie':
      return op === 'orange';
    case 'atelier_energie':
      return op === 'free' || op === 'bouygues';
    case 'bcube_radio':
    case 'tgbt':
      return op === 'bouygues';
    default:
      return true;
  }
}

export function extractSectorAerialState(sector?: SectorData) {
  const fallbackFoundation = sector?.equipmentFoundationType || 'dallettes';
  const fhFoundationType = sector?.fhFoundationType || fallbackFoundation;
  const fhSansPlot = isSansPlotFromFoundation(fhFoundationType);
  const fhHauteurMatM = sector?.fhHauteurMatM ?? 1.70;
  const fhEchelle = resolveSupportEchelle(fhHauteurMatM, 1.70);
  const rrhFoundationType = sector?.rrhFoundationType || fallbackFoundation;
  const rrhSansPlot = isSansPlotFromFoundation(rrhFoundationType);
  const rrhHauteurMatM = sector?.rrhHauteurMatM ?? 1.50;
  const rrhEchelle = resolveSupportEchelle(rrhHauteurMatM, 1.50);
  const rruFoundationType = sector?.rruFoundationType || fallbackFoundation;
  const rruSansPlot = isSansPlotFromFoundation(rruFoundationType);
  const rruHauteurMatM = sector?.rruHauteurMatM ?? 1.50;
  const rruEchelle = resolveSupportEchelle(rruHauteurMatM, 1.50);
  return {
    hasFhEquipment: !!sector?.hasFhEquipment,
    fhSansPlot,
    fhDiameter: sector?.fhDiameter ?? 300,
    fhReference: sector?.fhReference ?? '',
    fhQuantity: sector?.fhQuantity ?? 1,
    fhWeight: sector?.fhWeight,
    fhItems: sector?.fhItems ?? [],
    fhFoundationType,
    fhHauteurMatM,
    fhEchelle,
    hasRrhEquipment: !!sector?.hasRrhEquipment,
    rrhSansPlot,
    rrhItems: sector?.rrhItems ?? [],
    rrhFoundationType,
    rrhHauteurMatM,
    rrhEchelle,
    hasRruEquipment: !!sector?.hasRruEquipment,
    rruSansPlot,
    rruItems: sector?.rruItems ?? [],
    rruFoundationType,
    rruHauteurMatM,
    rruEchelle,
    hasCoffret: !!sector?.hasCoffret,
    coffretReference: sector?.coffretReference ?? '',
    coffretFoundationType: sector?.coffretFoundationType || fallbackFoundation,
    hasBoitierJonction: !!sector?.hasBoitierJonction,
    boitierJonctionQuantity: sector?.boitierJonctionQuantity ?? 1,
    boitierJonctionFoundationType: sector?.boitierJonctionFoundationType || fallbackFoundation,
    equipmentFoundationType: fallbackFoundation,
  };
}

export function buildEquipmentTogglesMap(
  sector: SectorData | undefined,
  zt: ZoneTechniqueData,
  operator: string
): Record<string, boolean> {
  const aerial = extractSectorAerialState(sector);
  return {
    fh: isEquipmentAllowedForOperator('fh', operator) && aerial.hasFhEquipment,
    rrh: isEquipmentAllowedForOperator('rrh', operator) && aerial.hasRrhEquipment,
    rru: aerial.hasRruEquipment,
    td: isEquipmentAllowedForOperator('td', operator) && zt.hasTdEquipment,
    gps: zt.hasGps,
    boitier_lovage: zt.hasBoitierLovage,
    coffrets_fibre: isEquipmentAllowedForOperator('coffrets_fibre', operator) && aerial.hasCoffret,
    boitier_jonction: isEquipmentAllowedForOperator('boitier_jonction', operator) && aerial.hasBoitierJonction,
    coffret_trans_fo: isEquipmentAllowedForOperator('coffret_trans_fo', operator) && !!zt.hasCoffretTransFo,
    coffrets_hybride: false,
    baie: isEquipmentAllowedForOperator('baie', operator) && zt.hasBaie,
    cab: isEquipmentAllowedForOperator('cab', operator) && zt.hasCab,
    atelier_energie: isEquipmentAllowedForOperator('atelier_energie', operator) && zt.hasAtelierEnergie,
    bcube_radio: isEquipmentAllowedForOperator('bcube_radio', operator) && zt.hasBcubeRadio,
    convertisseur_mdea: isEquipmentAllowedForOperator('convertisseur_mdea', operator) && zt.hasConvertisseurMdea,
    pile_amod: isEquipmentAllowedForOperator('pile_amod', operator) && zt.hasPileAmod,
    tgbt: isEquipmentAllowedForOperator('tgbt', operator) && zt.hasTgbt,
  };
}

export function hasAnyZoneTechnique(zt: ZoneTechniqueData, operator: string): boolean {
  return (
    (isEquipmentAllowedForOperator('td', operator) && zt.hasTdEquipment) ||
    zt.hasGps ||
    zt.hasBoitierLovage ||
    (isEquipmentAllowedForOperator('baie', operator) && zt.hasBaie) ||
    (isEquipmentAllowedForOperator('cab', operator) && zt.hasCab) ||
    (isEquipmentAllowedForOperator('atelier_energie', operator) && zt.hasAtelierEnergie) ||
    (isEquipmentAllowedForOperator('convertisseur_mdea', operator) && zt.hasConvertisseurMdea) ||
    (isEquipmentAllowedForOperator('coffret_trans_fo', operator) && !!zt.hasCoffretTransFo) ||
    (isEquipmentAllowedForOperator('pile_amod', operator) && zt.hasPileAmod) ||
    (isEquipmentAllowedForOperator('bcube_radio', operator) && zt.hasBcubeRadio) ||
    (isEquipmentAllowedForOperator('tgbt', operator) && zt.hasTgbt)
  );
}

export function getZoneTechniqueSummary(zt: ZoneTechniqueData, operator: string): string {
  const op = (operator || '').toLowerCase();
  const labels = [
    isEquipmentAllowedForOperator('td', op) && zt.hasTdEquipment ? 'TD' : null,
    zt.hasGps ? 'GPS' : null,
    zt.hasBoitierLovage ? 'Lovage' : null,
    isEquipmentAllowedForOperator('baie', op) && zt.hasBaie ? 'Baie' : null,
    isEquipmentAllowedForOperator('cab', op) && zt.hasCab ? 'CAB' : null,
    op === 'free' && zt.hasAtelierEnergie ? 'Atelier énergie' : null,
    isEquipmentAllowedForOperator('convertisseur_mdea', op) && zt.hasConvertisseurMdea ? 'Convertisseur MDEA' : null,
    isEquipmentAllowedForOperator('coffret_trans_fo', op) && zt.hasCoffretTransFo ? 'Coffret hybride' : null,
    isEquipmentAllowedForOperator('pile_amod', op) && zt.hasPileAmod ? 'Pile AMOD' : null,
    op === 'bouygues' && zt.hasAtelierEnergie ? 'B-cube énergie' : null,
    isEquipmentAllowedForOperator('bcube_radio', op) && zt.hasBcubeRadio ? 'BCube RADIO' : null,
    isEquipmentAllowedForOperator('tgbt', op) && zt.hasTgbt ? 'TGBT' : null,
  ].filter(Boolean);
  return labels.join(' • ') || 'Aucun équipement en zone technique';
}

// ============================================================================
// Unified Equipment Payload Serializer (Shared by Fast-Track & Robot Tracks)
// ============================================================================

export interface BuildEquipmentPayloadArgs {
  sector?: SectorData;
  zoneTechnique: ZoneTechniqueData;
  operator: string;
  config: CatalogueConfig | null;
  coffretQuantityMultiplier: number;
  resolveRru: (id: string) => string;
  resolveRrh: (id: string) => string;
  resolveBaieItems: (items: SelectedBaieItem[]) => any[];
}

export function buildSectorEquipmentPayload({
  sector,
  zoneTechnique: zt,
  operator,
  config,
  coffretQuantityMultiplier,
  resolveRru,
  resolveRrh,
  resolveBaieItems,
}: BuildEquipmentPayloadArgs) {
  const aerial = extractSectorAerialState(sector);
  const allowFh = isEquipmentAllowedForOperator('fh', operator);
  const hasFh = allowFh && aerial.hasFhEquipment;
  const fhOpt = hasFh
    ? config?.fh_references?.find(r => r.id === aerial.fhReference)
    : undefined;
  const allowRrh = isEquipmentAllowedForOperator('rrh', operator);
  const allowTd = isEquipmentAllowedForOperator('td', operator);
  const allowTgbt = isEquipmentAllowedForOperator('tgbt', operator);
  const allowBaie = isEquipmentAllowedForOperator('baie', operator);
  const allowCab = isEquipmentAllowedForOperator('cab', operator);
  const allowAtelier = isEquipmentAllowedForOperator('atelier_energie', operator);
  const allowBcubeRadio = isEquipmentAllowedForOperator('bcube_radio', operator);
  const allowMdea = isEquipmentAllowedForOperator('convertisseur_mdea', operator);
  const allowPileAmod = isEquipmentAllowedForOperator('pile_amod', operator);
  const allowBoitierJonction = isEquipmentAllowedForOperator('boitier_jonction', operator);
  const allowTransFo = isEquipmentAllowedForOperator('coffret_trans_fo', operator);
  const isFree = operator === 'free';
  const isBouygues = operator === 'bouygues';
  const baieCatalog = config?.baie_references && config.baie_references.length > 0
    ? config.baie_references
    : DEFAULT_ORANGE_BAIES;

  const allFhCatalog = config?.fh_references && config.fh_references.length > 0
    ? config.fh_references
    : DEFAULT_FH_REFERENCES;

  const ALLOWED_FH = [300, 600, 900, 1200];
  const sanitizeFhDiameter = (d?: number | null) => {
    const num = Number(d);
    return ALLOWED_FH.includes(num) ? num : 600;
  };

  const rawFhItems: EquipmentItem[] = hasFh
    ? (aerial.fhItems && aerial.fhItems.length > 0 && aerial.fhItems.some(i => i.reference)
        ? aerial.fhItems.filter(i => i.reference)
        : (aerial.fhReference ? [{ id: 'default-fh', reference: aerial.fhReference, quantity: aerial.fhQuantity || 1, diameter_mm: aerial.fhDiameter, weight_kg: aerial.fhWeight }] : [])
      )
    : [];

  const fhItemsList = rawFhItems.map(item => {
    const matchingRef = allFhCatalog.find(
      r => r.id === item.reference || r.reference === item.reference || r.name === item.reference
    );
    const refName = matchingRef?.reference || matchingRef?.name || item.reference || 'Antenne FH';
    const diam = sanitizeFhDiameter(matchingRef?.diameter ?? item.diameter_mm ?? aerial.fhDiameter ?? 600);
    const weight = Number(matchingRef?.weight ?? item.weight_kg ?? aerial.fhWeight ?? 15.0);
    return {
      reference: refName,
      diameter_mm: diam,
      weight_kg: weight > 0 ? weight : 15.0,
      quantity: Math.max(1, Number(item.quantity || 1)),
    };
  });

  const primaryFh = fhItemsList[0] || (hasFh ? {
    reference: 'Antenne FH',
    diameter_mm: sanitizeFhDiameter(aerial.fhDiameter),
    weight_kg: 15.0,
    quantity: aerial.fhQuantity || 1,
  } : null);

  const finalFhItems = fhItemsList.length > 0 ? fhItemsList : (primaryFh ? [primaryFh] : []);

  return {
    fh_equipment: {
      enabled: hasFh,
      sans_plot: aerial.fhSansPlot,
      with_plot: !aerial.fhSansPlot,
      hauteur_mat_m: Number(aerial.fhHauteurMatM ?? 1.70),
      diameter_mm: hasFh && primaryFh ? primaryFh.diameter_mm : null,
      reference: hasFh && primaryFh ? primaryFh.reference : null,
      quantity: hasFh && primaryFh ? primaryFh.quantity : null,
      weight_kg: hasFh && primaryFh ? primaryFh.weight_kg : null,
      ancrage: hasFh ? aerial.fhFoundationType : null,
      echelle: hasFh ? resolveSupportEchelle(aerial.fhHauteurMatM, 1.70) : null,
      items: hasFh ? finalFhItems : [],
    },
    structure_fh: hasFh
      ? {
          mast_section: 'TRON 114x3.6',
          plot_section: aerial.fhSansPlot ? null : 'TCAR 150x5',
          hauteur_mat_m: Number(aerial.fhHauteurMatM ?? 1.70),
          hauteur_plot_m: aerial.fhSansPlot ? 0.0 : 0.50,
        }
      : null,
    rrh_equipment: {
      enabled: allowRrh && aerial.hasRrhEquipment && !aerial.hasRruEquipment,
      sans_plot: aerial.rrhSansPlot,
      with_plot: !aerial.rrhSansPlot,
      ancrage: allowRrh && aerial.hasRrhEquipment ? aerial.rrhFoundationType : null,
      hauteur_mat_m: Number(aerial.rrhHauteurMatM ?? 1.50),
      echelle: allowRrh && aerial.hasRrhEquipment && !aerial.hasRruEquipment
        ? resolveSupportEchelle(aerial.rrhHauteurMatM, 1.50)
        : null,
      items: allowRrh && aerial.hasRrhEquipment && !aerial.hasRruEquipment
        ? aerial.rrhItems.map(item => ({ reference: resolveRrh(item.reference), quantity: item.quantity }))
        : [],
    },
    rru_equipment: {
      enabled: aerial.hasRruEquipment,
      sans_plot: aerial.rruSansPlot,
      with_plot: !aerial.rruSansPlot,
      ancrage: aerial.hasRruEquipment ? aerial.rruFoundationType : null,
      hauteur_mat_m: Number(aerial.rruHauteurMatM ?? 1.50),
      echelle: aerial.hasRruEquipment
        ? resolveSupportEchelle(aerial.rruHauteurMatM, 1.50)
        : null,
      items: aerial.hasRruEquipment
        ? aerial.rruItems.map(item => ({ reference: resolveRru(item.reference), quantity: item.quantity }))
        : [],
    },
    td_equipment: (() => {
      const tdEnabled = allowTd && zt.hasTdEquipment;
      const tdFoundation = zt.tdFoundationType || 'dallettes';
      const tdSansPlot = isSansPlotFromFoundation(tdFoundation);
      const tdH = Number(zt.tdHauteurMatM ?? 1.70);
      const tdEchelle = resolveSupportEchelle(tdH, 1.70);
      return {
        enabled: tdEnabled,
        type: tdEnabled ? zt.tdType : null,
        reference: tdEnabled ? zt.tdReference : null,
        tgbt_reference: tdEnabled && zt.tdType === 'monophase' ? zt.tgbtReference : null,
        ancrage: tdEnabled ? tdFoundation : null,
        sans_plot: tdSansPlot,
        with_plot: !tdSansPlot,
        hauteur_mat_m: tdH,
        echelle: tdEnabled ? tdEchelle : null,
      };
    })(),
    tgbt_equipment: (() => {
      const tgbtEnabled = allowTgbt && zt.hasTgbt;
      const tgbtFoundation = zt.tgbtFoundationType || 'dallettes';
      const tgbtSansPlot = isSansPlotFromFoundation(tgbtFoundation);
      const tgbtH = Number(zt.tgbtHauteurMatM ?? 1.50);
      const tgbtEchelle = resolveSupportEchelle(tgbtH, 1.50);
      return {
        enabled: tgbtEnabled,
        reference: tgbtEnabled ? (zt.tgbtReference || STATIC_EQUIPMENT_SPECS.tgbt.defaultRef) : null,
        emplacement: tgbtEnabled ? (zt.tgbtEmplacement || 'integre_bcube') : null,
        ancrage: tgbtEnabled ? tgbtFoundation : null,
        sans_plot: tgbtSansPlot,
        with_plot: !tgbtSansPlot,
        hauteur_mat_m: tgbtH,
        echelle: tgbtEnabled ? tgbtEchelle : null,
      };
    })(),
    gps: {
      enabled: zt.hasGps,
      quantity: 1,
      marque: zt.hasGps ? zt.gpsMarque : null,
      reference: zt.hasGps ? zt.gpsReference : null,
    },
    boitier_lovage: (() => {
      const lovageFoundation = zt.boitierLovageFoundationType || 'dallettes';
      const lovageSansPlot = isSansPlotFromFoundation(lovageFoundation);
      const lovageH = Number(zt.boitierLovageHauteurMatM ?? 1.50);
      const hasGpsCoMount = zt.hasBoitierLovage && zt.hasGps;
      const hasMdeaCoMount = zt.hasBoitierLovage && allowMdea && zt.hasConvertisseurMdea;
      const gpsSpec = zt.gpsReference ? GPS_REFERENCE_SPECS[zt.gpsReference] : undefined;
      return {
        enabled: zt.hasBoitierLovage,
        quantity: zt.boitierLovageQuantity,
        reference: zt.hasBoitierLovage ? zt.boitierLovageReference : null,
        ancrage: zt.hasBoitierLovage ? lovageFoundation : null,
        sans_plot: lovageSansPlot,
        with_plot: !lovageSansPlot,
        hauteur_mat_m: lovageH,
        echelle: zt.hasBoitierLovage ? resolveSupportEchelle(lovageH, 1.50) : null,
        cf_front: 1.47,
        cf_lat: 1.19,
        has_gps: hasGpsCoMount,
        has_mdea: hasMdeaCoMount,
        gps: hasGpsCoMount
          ? {
              enabled: true,
              quantity: 1,
              marque: zt.gpsMarque || gpsSpec?.marque || null,
              reference: zt.gpsReference || null,
              dimensions: gpsSpec?.dimensions ?? null,
              weight_kg: gpsSpec?.weightKg ?? 0,
            }
          : null,
        mdea: hasMdeaCoMount
          ? {
              enabled: true,
              quantity: Math.max(1, Number(zt.convertisseurMdeaQuantity || 1)),
              dimensions: STATIC_EQUIPMENT_SPECS.mdea.dimensions,
              hauteur_mm: STATIC_EQUIPMENT_SPECS.mdea.hMm,
              largeur_mm: STATIC_EQUIPMENT_SPECS.mdea.wMm,
              epaisseur_mm: STATIC_EQUIPMENT_SPECS.mdea.dMm,
              weight_kg: STATIC_EQUIPMENT_SPECS.mdea.weightKg,
              cf_front: STATIC_EQUIPMENT_SPECS.mdea.cfFront,
              cf_lat: STATIC_EQUIPMENT_SPECS.mdea.cfLat,
            }
          : null,
      };
    })(),
    structure_lovage: zt.hasBoitierLovage
      ? (() => {
          const lovageFoundation = zt.boitierLovageFoundationType || 'dallettes';
          const lovageSansPlot = isSansPlotFromFoundation(lovageFoundation);
          return {
            mast_section: 'TRON 88x3.2',
            plot_section: lovageSansPlot ? null : 'TCAR 150x5',
            hauteur_mat_m: Number(zt.boitierLovageHauteurMatM ?? 1.50),
            hauteur_plot_m: lovageSansPlot ? 0.0 : 0.50,
            sans_plot: lovageSansPlot,
            with_plot: !lovageSansPlot,
          };
        })()
      : null,
    boitier_jonction: {
      enabled: allowBoitierJonction && aerial.hasBoitierJonction,
      quantity: allowBoitierJonction && aerial.hasBoitierJonction ? (aerial.boitierJonctionQuantity || 1) : null,
      marque: STATIC_EQUIPMENT_SPECS.boitierJonction.marque,
      dimensions: STATIC_EQUIPMENT_SPECS.boitierJonction.dimensions,
      weight: STATIC_EQUIPMENT_SPECS.boitierJonction.weightKg,
    },
    coffrets_fibre: {
      enabled: isFree ? !!zt.hasCoffretTransFo : aerial.hasCoffret,
      quantity: isFree ? (zt.coffretTransFoQuantity || 1) : (aerial.hasCoffret ? coffretQuantityMultiplier : 1),
      reference: isFree
        ? (zt.hasCoffretTransFo ? STATIC_EQUIPMENT_SPECS.transFo.reference : null)
        : (aerial.hasCoffret ? aerial.coffretReference : null),
      ancrage: isFree
        ? (zt.hasCoffretTransFo ? aerial.boitierJonctionFoundationType : null)
        : (aerial.hasCoffret ? aerial.coffretFoundationType : null),
    },
    coffrets_hybride: {
      enabled: allowTransFo && !!zt.hasCoffretTransFo,
      quantity: allowTransFo && zt.hasCoffretTransFo ? (zt.coffretTransFoQuantity || 1) : null,
      reference: allowTransFo && zt.hasCoffretTransFo ? STATIC_EQUIPMENT_SPECS.transFo.reference : null,
    },
    coffret_trans_fo: {
      enabled: allowTransFo && !!zt.hasCoffretTransFo,
      quantity: allowTransFo && zt.hasCoffretTransFo ? (zt.coffretTransFoQuantity || 1) : null,
      reference: allowTransFo && zt.hasCoffretTransFo ? STATIC_EQUIPMENT_SPECS.transFo.reference : null,
    },
    baie: {
      enabled: allowBaie && zt.hasBaie,
      items: allowBaie && zt.hasBaie ? resolveBaieItems(zt.baieItems) : [],
      baie_radio: allowBaie && zt.hasBaie && (zt.baieRadio || zt.baieItems.some(i =>
        baieCatalog.find(b => b.id === i.referenceId)?.category === 'radio_trans'
      )),
      baie_energie: allowBaie && zt.hasBaie && (zt.baieEnergie || zt.baieItems.some(i =>
        baieCatalog.find(b => b.id === i.referenceId)?.category === 'energie'
      )),
    },
    cab: {
      enabled: allowCab && zt.hasCab,
      cab_one: allowCab && zt.hasCab && zt.cabOne,
      cab_two: allowCab && zt.hasCab && zt.cabTwo,
      cab_three: allowCab && zt.hasCab && zt.cabThree,
      support: allowCab && zt.hasCab ? zt.cabSupport : null,
    },
    atelier_energie: {
      enabled: allowAtelier && zt.hasAtelierEnergie,
      module_fprb: isFree && zt.hasAtelierEnergie && zt.atelierFprb,
      module_fprb_quantity: isFree && zt.hasAtelierEnergie && zt.atelierFprb ? zt.atelierFprbQuantity : 0,
      module_fpbc: isFree && zt.hasAtelierEnergie && zt.atelierFpbc,
      module_fpbc_quantity: isFree && zt.hasAtelierEnergie && zt.atelierFpbc ? zt.atelierFpbcQuantity : 0,
      bcube: isBouygues && zt.hasAtelierEnergie ? zt.bcubeReference : null,
    },
    bcube_radio: {
      enabled: allowBcubeRadio && zt.hasBcubeRadio,
      reference: allowBcubeRadio && zt.hasBcubeRadio ? (zt.bcubeRadioReference || STATIC_EQUIPMENT_SPECS.bcubeRadio.defaultRef) : null,
    },
    convertisseur_mdea: {
      enabled: allowMdea && zt.hasConvertisseurMdea,
      quantite: allowMdea && zt.hasConvertisseurMdea ? zt.convertisseurMdeaQuantity : 0,
      dimensions: STATIC_EQUIPMENT_SPECS.mdea.dimensions,
      poids: STATIC_EQUIPMENT_SPECS.mdea.weightKg,
      cf_front: STATIC_EQUIPMENT_SPECS.mdea.cfFront,
      cf_lat: STATIC_EQUIPMENT_SPECS.mdea.cfLat,
    },
    pile_amod: {
      enabled: allowPileAmod && zt.hasPileAmod,
      modules: allowPileAmod && zt.hasPileAmod ? zt.amodModules : {},
    },
  };
}

