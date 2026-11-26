import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEquipmentTogglesMap,
  buildSectorEquipmentPayload,
  extractSectorAerialState,
  formatFoundationLabel,
  getZoneTechniqueSummary,
  hasAnyZoneTechnique,
  isEquipmentAllowedForOperator,
  stripVendorPrefix,
} from '../config/equipmentRegistry';
import { defaultSectorData, defaultZoneTechniqueData } from '../components/regular-user/types';

describe('equipmentRegistry', () => {
  it('enforces operator gating rules for TD, RRH, Baie, TGBT, and Free modules', () => {
    assert.equal(isEquipmentAllowedForOperator('td', 'free'), true);
    assert.equal(isEquipmentAllowedForOperator('td', 'sfr'), true);
    assert.equal(isEquipmentAllowedForOperator('td', 'orange'), false);
    assert.equal(isEquipmentAllowedForOperator('td', 'bouygues'), false);

    assert.equal(isEquipmentAllowedForOperator('fh', 'orange'), false);
    assert.equal(isEquipmentAllowedForOperator('fh', 'bouygues'), true);
    assert.equal(isEquipmentAllowedForOperator('fh', 'free'), true);

    assert.equal(isEquipmentAllowedForOperator('rrh', 'bouygues'), false);
    assert.equal(isEquipmentAllowedForOperator('rrh', 'orange'), true);

    assert.equal(isEquipmentAllowedForOperator('baie', 'orange'), true);
    assert.equal(isEquipmentAllowedForOperator('baie', 'free'), false);

    assert.equal(isEquipmentAllowedForOperator('tgbt', 'bouygues'), true);
    assert.equal(isEquipmentAllowedForOperator('tgbt', 'orange'), false);

    assert.equal(isEquipmentAllowedForOperator('pile_amod', 'free'), true);
    assert.equal(isEquipmentAllowedForOperator('pile_amod', 'sfr'), false);
  });

  it('strips vendor prefixes cleanly and formats foundation labels', () => {
    assert.equal(stripVendorPrefix('NOKIA AHHB 2600', 'NOKIA'), 'AHHB 2600');
    assert.equal(stripVendorPrefix('Radio 4486', 'ERICSSON'), 'Radio 4486');
    assert.equal(formatFoundationLabel('metallique'), 'Plot métallique');
    assert.equal(formatFoundationLabel('beton'), 'Plot Béton');
    assert.equal(formatFoundationLabel(undefined), 'Plot métallique');
  });

  it('extracts sector aerial state and builds toggle map per operator', () => {
    const sector = {
      ...defaultSectorData(1),
      hasFhEquipment: true,
      fhQuantity: 2,
      fhFoundationType: 'dallettes' as const,
      hasRrhEquipment: true,
      rrhItems: [{ id: '1', reference: 'AHHB', quantity: 2 }],
      rrhFoundationType: 'beton' as const,
      hasCoffret: true,
      coffretFoundationType: 'metallique' as const,
    };
    const zt = {
      ...defaultZoneTechniqueData,
      hasTdEquipment: true,
      hasGps: true,
    };

    const aerial = extractSectorAerialState(sector);
    assert.equal(aerial.hasFhEquipment, true);
    assert.equal(aerial.fhQuantity, 2);
    assert.equal(aerial.fhFoundationType, 'dallettes');
    assert.equal(aerial.rrhFoundationType, 'beton');
    assert.equal(aerial.coffretFoundationType, 'metallique');

    const bouyguesToggles = buildEquipmentTogglesMap(sector, zt, 'bouygues');
    assert.equal(bouyguesToggles.fh, true);
    assert.equal(bouyguesToggles.rrh, false); // blocked for Bouygues
    assert.equal(bouyguesToggles.td, false);  // blocked for Bouygues
    assert.equal(bouyguesToggles.gps, true);

    const freeToggles = buildEquipmentTogglesMap(sector, zt, 'free');
    assert.equal(freeToggles.td, true);
    assert.equal(freeToggles.coffrets_fibre, false); // blocked for Free
  });

  it('summarizes active zone technique items accurately', () => {
    assert.equal(hasAnyZoneTechnique(defaultZoneTechniqueData, 'orange'), false);
    const activeZt = {
      ...defaultZoneTechniqueData,
      hasGps: true,
      hasTgbt: true,
      tgbtReference: 'ACTIA',
    };
    assert.equal(hasAnyZoneTechnique(activeZt, 'bouygues'), true);
    const summary = getZoneTechniqueSummary(activeZt, 'bouygues');
    assert.ok(summary.includes('GPS'));
    assert.ok(summary.includes('TGBT'));
  });

  it('builds consistent multi-sector payload respecting operator restrictions', () => {
    const sector = {
      ...defaultSectorData(1),
      hasRruEquipment: true,
      rruItems: [{ id: 'r1', reference: 'Radio 4486', quantity: 3 }],
      rruFoundationType: 'dallettes' as const,
      hasCoffret: true,
      coffretReference: 'UTEL V3',
      coffretFoundationType: 'beton' as const,
    };
    const zt = {
      ...defaultZoneTechniqueData,
      hasTdEquipment: true,
    };

    const payload = buildSectorEquipmentPayload({
      sector,
      zoneTechnique: zt,
      operator: 'bouygues',
      config: null,
      coffretQuantityMultiplier: 3,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });

    assert.equal(payload.td_equipment.enabled, false);
    assert.equal(payload.rru_equipment.enabled, true);
    assert.equal(payload.rru_equipment.hauteur_mat_m, 1.50);
    assert.equal(payload.rru_equipment.items.length, 1);
    assert.equal(payload.rru_equipment.ancrage, 'dallettes');
    assert.equal(payload.coffrets_fibre.enabled, true);
    assert.equal(payload.coffrets_fibre.quantity, 3);
    assert.equal(payload.coffrets_fibre.ancrage, 'beton');
  });

  it('builds FH payload with catalogue reference and allows coexistence with RRU while segregating RRH', () => {
    const sector = {
      ...defaultSectorData(1),
      hasFhEquipment: true,
      fhItems: [
        { id: '1', reference: 'fh_huawei_30', quantity: 2 },
      ],
      fhFoundationType: 'dallettes' as const,
      fhEchelle: 'Echelle',
      hasRruEquipment: true, // Coexists with FH
      hasRrhEquipment: true, // Segregated because RRU is present
    };

    const payload = buildSectorEquipmentPayload({
      sector,
      zoneTechnique: defaultZoneTechniqueData,
      operator: 'bouygues',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });

    assert.equal(payload.fh_equipment.enabled, true);
    assert.equal(payload.fh_equipment.sans_plot, true);
    assert.equal(payload.fh_equipment.hauteur_mat_m, 1.70);
    // When Huawei 30cm Ø 300 mm is selected, diameter must be 300 and weight 6
    assert.equal(payload.fh_equipment.diameter_mm, 300);
    assert.equal(payload.fh_equipment.weight_kg, 6);
    assert.equal(payload.fh_equipment.quantity, 2);
    assert.equal(payload.fh_equipment.reference, '30cm Ø 300 mm');
    assert.equal(payload.fh_equipment.items.length, 1);
    assert.deepEqual(payload.fh_equipment.items[0], {
      reference: '30cm Ø 300 mm',
      diameter_mm: 300,
      weight_kg: 6,
      quantity: 2,
    });

    // Structure FH check (dallettes => sans plot)
    assert.deepEqual(payload.structure_fh, {
      mast_section: 'TRON 88x3.2',
      plot_section: null,
      hauteur_mat_m: 1.70,
      hauteur_plot_m: 0.0,
    });

    // FH and RRU coexist, while RRH and RRU are mutually exclusive (default foundation dallettes => sans_plot)
    assert.equal(payload.rru_equipment.enabled, true);
    assert.equal(payload.rru_equipment.sans_plot, true);
    assert.equal(payload.rru_equipment.with_plot, false);
    assert.equal(payload.rrh_equipment.enabled, false);
    assert.deepEqual(payload.rrh_equipment.items, []);
  });

  it('builds multi-dish FH payload with matching catalogue references', () => {
    const sector = {
      ...defaultSectorData(1),
      hasFhEquipment: true,
      fhItems: [
        { id: 'fh-1', reference: 'fh_ericsson_60', quantity: 1 },
        { id: 'fh-2', reference: 'fh_ericsson_120', quantity: 1 },
      ],
    };

    const payload = buildSectorEquipmentPayload({
      sector,
      zoneTechnique: defaultZoneTechniqueData,
      operator: 'bouygues',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });

    assert.equal(payload.fh_equipment.enabled, true);
    assert.equal(payload.fh_equipment.items.length, 2);
    assert.equal(payload.fh_equipment.items[0].reference, 'BFZ 622 32/3S03H Ø 600 mm');
    assert.equal(payload.fh_equipment.items[0].diameter_mm, 600);
    assert.equal(payload.fh_equipment.items[0].weight_kg, 7.6);
    assert.equal(payload.fh_equipment.items[1].reference, 'BFZ 622 34/3S03H Ø 1200 mm');
    assert.equal(payload.fh_equipment.items[1].diameter_mm, 1200);
    assert.equal(payload.fh_equipment.items[1].weight_kg, 32);
  });

  it('enforces and customizes mast heights for RRH, RRU, and FH', () => {
    // 1. Custom RRU mast height 2.20 m
    const rruSector = {
      ...defaultSectorData(1),
      hasRruEquipment: true,
      rruHauteurMatM: 2.20,
      rruItems: [{ id: '1', reference: 'RRU3281', quantity: 1 }],
    };
    const rruPayload = buildSectorEquipmentPayload({
      sector: rruSector,
      zoneTechnique: defaultZoneTechniqueData,
      operator: 'bouygues',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(rruPayload.rru_equipment.enabled, true);
    assert.equal(rruPayload.rru_equipment.hauteur_mat_m, 2.20);

    // 2. Custom RRH mast height 1.80 m
    const rrhSector = {
      ...defaultSectorData(1),
      hasRrhEquipment: true,
      rrhHauteurMatM: 1.80,
      rrhItems: [{ id: '1', reference: 'NOKIA AHHB 2600', quantity: 1 }],
    };
    const rrhPayload = buildSectorEquipmentPayload({
      sector: rrhSector,
      zoneTechnique: defaultZoneTechniqueData,
      operator: 'free',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(rrhPayload.rrh_equipment.enabled, true);
    assert.equal(rrhPayload.rrh_equipment.hauteur_mat_m, 1.80);

    // 3. Custom FH mast height 2.50 m
    const fhSector = {
      ...defaultSectorData(1),
      hasFhEquipment: true,
      fhHauteurMatM: 2.50,
      fhItems: [{ id: '1', reference: 'fh_huawei_30', quantity: 1 }],
    };
    const fhPayload = buildSectorEquipmentPayload({
      sector: fhSector,
      zoneTechnique: defaultZoneTechniqueData,
      operator: 'bouygues',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(fhPayload.fh_equipment.enabled, true);
    assert.equal(fhPayload.fh_equipment.hauteur_mat_m, 2.50);
    assert.equal(fhPayload.structure_fh?.hauteur_mat_m, 2.50);
  });

  it('enforces FH sans_plot and echelle from Type d\'ancrage (dallettes = sans plot, beton/metallique = with plot)', () => {
    // 1. Dallettes (sans plot) even with 2.50m mast => sans_plot=true, echelle forced to Pas d'échelle
    const sansPlotSector = {
      ...defaultSectorData(1),
      hasFhEquipment: true,
      fhFoundationType: 'dallettes' as const,
      fhHauteurMatM: 2.50,
      fhEchelle: 'Echelle',
      fhItems: [{ id: '1', reference: 'fh_huawei_30', quantity: 1 }],
    };
    const aerialSp = extractSectorAerialState(sansPlotSector);
    assert.equal(aerialSp.fhSansPlot, true);
    assert.equal(aerialSp.fhEchelle, "Pas d'échelle");

    const payloadSp = buildSectorEquipmentPayload({
      sector: sansPlotSector,
      zoneTechnique: defaultZoneTechniqueData,
      operator: 'bouygues',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(payloadSp.fh_equipment.sans_plot, true);
    assert.equal(payloadSp.fh_equipment.with_plot, false);
    assert.equal(payloadSp.fh_equipment.ancrage, 'dallettes');
    assert.equal(payloadSp.fh_equipment.echelle, "Pas d'échelle");
    assert.equal(payloadSp.structure_fh?.plot_section, null);
    assert.equal(payloadSp.structure_fh?.hauteur_plot_m, 0);

    // 2. Plot béton (with plot) but mast < 2.0m (1.70m) => with_plot=true, echelle forced to Pas d'échelle
    const shortWithPlotSector = {
      ...defaultSectorData(1),
      hasFhEquipment: true,
      fhFoundationType: 'beton' as const,
      fhHauteurMatM: 1.70,
      fhEchelle: 'Echelle',
      fhItems: [{ id: '1', reference: 'fh_huawei_30', quantity: 1 }],
    };
    const aerialShort = extractSectorAerialState(shortWithPlotSector);
    assert.equal(aerialShort.fhSansPlot, false);
    assert.equal(aerialShort.fhEchelle, "Pas d'échelle");

    const payloadShort = buildSectorEquipmentPayload({
      sector: shortWithPlotSector,
      zoneTechnique: defaultZoneTechniqueData,
      operator: 'bouygues',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(payloadShort.fh_equipment.sans_plot, false);
    assert.equal(payloadShort.fh_equipment.with_plot, true);
    assert.equal(payloadShort.fh_equipment.ancrage, 'beton');
    assert.equal(payloadShort.fh_equipment.echelle, "Pas d'échelle");
    assert.equal(payloadShort.structure_fh?.plot_section, 'TCAR 150x5');

    // 3. Plot métallique (with plot) AND mast >= 2.0m (2.00m) => Echelle allowed
    const tallWithPlotSector = {
      ...defaultSectorData(1),
      hasFhEquipment: true,
      fhFoundationType: 'metallique' as const,
      fhHauteurMatM: 2.00,
      fhEchelle: 'Echelle',
      fhItems: [{ id: '1', reference: 'fh_huawei_30', quantity: 1 }],
    };
    const aerialTall = extractSectorAerialState(tallWithPlotSector);
    assert.equal(aerialTall.fhSansPlot, false);
    assert.equal(aerialTall.fhEchelle, 'Echelle');

    const payloadTall = buildSectorEquipmentPayload({
      sector: tallWithPlotSector,
      zoneTechnique: defaultZoneTechniqueData,
      operator: 'bouygues',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(payloadTall.fh_equipment.sans_plot, false);
    assert.equal(payloadTall.fh_equipment.with_plot, true);
    assert.equal(payloadTall.fh_equipment.ancrage, 'metallique');
    assert.equal(payloadTall.fh_equipment.echelle, 'Echelle');
    assert.equal(payloadTall.structure_fh?.plot_section, 'TCAR 150x5');
    assert.equal(payloadTall.structure_fh?.hauteur_plot_m, 0.5);
  });

  it('serializes boitier_lovage from Type d\'ancrage (dallettes = sans plot, beton/metallique = with plot) with Cf,front=1.47 and Cf,lat=1.19', () => {
    const ztAvec = {
      ...defaultZoneTechniqueData,
      hasBoitierLovage: true,
      boitierLovageReference: 'BLM-515709',
      boitierLovageQuantity: 2,
      boitierLovageFoundationType: 'metallique' as const,
      boitierLovageHauteurMatM: 1.50,
    };
    const payloadAvec = buildSectorEquipmentPayload({
      sector: defaultSectorData(1),
      zoneTechnique: ztAvec,
      operator: 'free',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(payloadAvec.boitier_lovage.enabled, true);
    assert.equal(payloadAvec.boitier_lovage.quantity, 2);
    assert.equal(payloadAvec.boitier_lovage.ancrage, 'metallique');
    assert.equal(payloadAvec.boitier_lovage.sans_plot, false);
    assert.equal(payloadAvec.boitier_lovage.with_plot, true);
    assert.equal(payloadAvec.boitier_lovage.hauteur_mat_m, 1.5);
    assert.equal(payloadAvec.boitier_lovage.cf_front, 1.47);
    assert.equal(payloadAvec.boitier_lovage.cf_lat, 1.19);
    assert.equal(payloadAvec.structure_lovage?.mast_section, 'TRON 88x3.2');
    assert.equal(payloadAvec.structure_lovage?.plot_section, 'TCAR 150x5');
    assert.equal(payloadAvec.structure_lovage?.hauteur_plot_m, 0.5);

    const ztBeton = {
      ...ztAvec,
      boitierLovageFoundationType: 'beton' as const,
    };
    const payloadBeton = buildSectorEquipmentPayload({
      sector: defaultSectorData(1),
      zoneTechnique: ztBeton,
      operator: 'free',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(payloadBeton.boitier_lovage.ancrage, 'beton');
    assert.equal(payloadBeton.boitier_lovage.sans_plot, false);
    assert.equal(payloadBeton.boitier_lovage.with_plot, true);

    const ztSans = {
      ...ztAvec,
      boitierLovageFoundationType: 'dallettes' as const,
      boitierLovageHauteurMatM: 2.0,
    };
    const payloadSans = buildSectorEquipmentPayload({
      sector: defaultSectorData(1),
      zoneTechnique: ztSans,
      operator: 'free',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(payloadSans.boitier_lovage.ancrage, 'dallettes');
    assert.equal(payloadSans.boitier_lovage.sans_plot, true);
    assert.equal(payloadSans.boitier_lovage.with_plot, false);
    assert.equal(payloadSans.boitier_lovage.hauteur_mat_m, 2.0);
    assert.equal(payloadSans.boitier_lovage.echelle, "Pas d'échelle");
    assert.equal(payloadSans.structure_lovage?.plot_section, null);
    assert.equal(payloadSans.structure_lovage?.hauteur_plot_m, 0.0);

    // Lovage never supports Echelle even with plot (metallique) and hauteur >= 2.0m
    const ztAvecEch = {
      ...ztAvec,
      boitierLovageHauteurMatM: 2.2,
      boitierLovageEchelle: 'Echelle',
    };
    const payloadAvecEch = buildSectorEquipmentPayload({
      sector: defaultSectorData(1),
      zoneTechnique: ztAvecEch,
      operator: 'free',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(payloadAvecEch.boitier_lovage.echelle, "Pas d'échelle");

    // RRH & RRU derive sans_plot and echelle from foundationType (dallettes = sans plot, beton/metallique = with plot)
    const rrhWithPlotSector = {
      ...defaultSectorData(1),
      hasRrhEquipment: true,
      rrhItems: [{ id: '1', reference: 'AHHB', quantity: 1 }],
      rrhFoundationType: 'beton' as const,
      rrhHauteurMatM: 2.5,
      rrhEchelle: 'Echelle',
    };
    const rrhPayload = buildSectorEquipmentPayload({
      sector: rrhWithPlotSector,
      zoneTechnique: defaultZoneTechniqueData,
      operator: 'free',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(rrhPayload.rrh_equipment.sans_plot, false);
    assert.equal(rrhPayload.rrh_equipment.with_plot, true);
    assert.equal(rrhPayload.rrh_equipment.echelle, 'Echelle');

    const rruSansPlotSector = {
      ...defaultSectorData(1),
      hasRruEquipment: true,
      rruItems: [{ id: '1', reference: 'Radio 4486', quantity: 1 }],
      rruFoundationType: 'dallettes' as const,
      rruHauteurMatM: 2.5,
      rruEchelle: 'Echelle',
    };
    const rruPayload = buildSectorEquipmentPayload({
      sector: rruSansPlotSector,
      zoneTechnique: defaultZoneTechniqueData,
      operator: 'bouygues',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(rruPayload.rru_equipment.sans_plot, true);
    assert.equal(rruPayload.rru_equipment.with_plot, false);
    assert.equal(rruPayload.rru_equipment.echelle, "Pas d'échelle");

    // TGBT (Bouygues) & TD (Free) derive sans_plot and 2m echelle from Type d'ancrage
    const tgbtPayload = buildSectorEquipmentPayload({
      sector: defaultSectorData(1),
      zoneTechnique: {
        ...defaultZoneTechniqueData,
        hasTgbt: true,
        tgbtReference: 'ACTIA',
        tgbtEmplacement: 'integre_mat',
        tgbtFoundationType: 'metallique',
        tgbtHauteurMatM: 2.0,
        tgbtEchelle: 'Echelle',
      },
      operator: 'bouygues',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(tgbtPayload.tgbt_equipment.ancrage, 'metallique');
    assert.equal(tgbtPayload.tgbt_equipment.sans_plot, false);
    assert.equal(tgbtPayload.tgbt_equipment.with_plot, true);
    assert.equal(tgbtPayload.tgbt_equipment.hauteur_mat_m, 2.0);
    assert.equal(tgbtPayload.tgbt_equipment.echelle, 'Echelle');

    const tdPayload = buildSectorEquipmentPayload({
      sector: defaultSectorData(1),
      zoneTechnique: {
        ...defaultZoneTechniqueData,
        hasTdEquipment: true,
        tdReference: 'td_5g',
        tdFoundationType: 'beton',
        tdHauteurMatM: 2.3,
        tdEchelle: 'Echelle',
      },
      operator: 'free',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(tdPayload.td_equipment.ancrage, 'beton');
    assert.equal(tdPayload.td_equipment.sans_plot, false);
    assert.equal(tdPayload.td_equipment.with_plot, true);
    assert.equal(tdPayload.td_equipment.hauteur_mat_m, 2.3);
    assert.equal(tdPayload.td_equipment.echelle, 'Echelle');

    const tdDallettesPayload = buildSectorEquipmentPayload({
      sector: defaultSectorData(1),
      zoneTechnique: {
        ...defaultZoneTechniqueData,
        hasTdEquipment: true,
        tdReference: 'td_5g',
        tdFoundationType: 'dallettes',
        tdHauteurMatM: 2.5,
        tdEchelle: 'Echelle',
      },
      operator: 'free',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(tdDallettesPayload.td_equipment.sans_plot, true);
    assert.equal(tdDallettesPayload.td_equipment.with_plot, false);
    assert.equal(tdDallettesPayload.td_equipment.echelle, "Pas d'échelle");
  });

  it('serializes co-mounted GPS and Convertisseur MDEA on boitier_lovage mast respecting operator gating', () => {
    const ztFull = {
      ...defaultZoneTechniqueData,
      hasBoitierLovage: true,
      boitierLovageReference: 'BLM-515709',
      boitierLovageQuantity: 2,
      boitierLovageFoundationType: 'metallique' as const,
      boitierLovageHauteurMatM: 1.50,
      hasGps: true,
      gpsMarque: 'NOKIA',
      gpsReference: 'FYGC 474074A',
      hasConvertisseurMdea: true,
      convertisseurMdeaQuantity: 2,
    };

    const freePayload = buildSectorEquipmentPayload({
      sector: defaultSectorData(1),
      zoneTechnique: ztFull,
      operator: 'free',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });

    assert.equal(freePayload.boitier_lovage.has_gps, true);
    assert.equal(freePayload.boitier_lovage.has_mdea, true);
    assert.equal(freePayload.boitier_lovage.gps?.reference, 'FYGC 474074A');
    assert.equal(freePayload.boitier_lovage.gps?.dimensions, 'Ø95 x 72.5');
    assert.equal(freePayload.boitier_lovage.gps?.weight_kg, 0.154);
    assert.equal(freePayload.boitier_lovage.mdea?.enabled, true);
    assert.equal(freePayload.boitier_lovage.mdea?.quantity, 2);
    assert.equal(freePayload.boitier_lovage.mdea?.hauteur_mm, 338);
    assert.equal(freePayload.boitier_lovage.mdea?.largeur_mm, 295);
    assert.equal(freePayload.boitier_lovage.mdea?.epaisseur_mm, 140);
    assert.equal(freePayload.boitier_lovage.mdea?.weight_kg, 10);
    assert.equal(freePayload.boitier_lovage.mdea?.cf_front, 1.46);
    assert.equal(freePayload.boitier_lovage.mdea?.cf_lat, 1.12);
    assert.equal(freePayload.convertisseur_mdea.cf_front, 1.46);
    assert.equal(freePayload.convertisseur_mdea.cf_lat, 1.12);

    // Non-free operator gates out MDEA while keeping GPS co-mounted (verify Ericsson GPS specs too)
    const bouyguesPayload = buildSectorEquipmentPayload({
      sector: defaultSectorData(1),
      zoneTechnique: {
        ...ztFull,
        gpsMarque: 'ERICSSON',
        gpsReference: 'KRE 101 2395/2',
      },
      operator: 'bouygues',
      config: null,
      coffretQuantityMultiplier: 1,
      resolveRru: (ref) => ref,
      resolveRrh: (ref) => ref,
      resolveBaieItems: () => [],
    });
    assert.equal(bouyguesPayload.boitier_lovage.has_gps, true);
    assert.equal(bouyguesPayload.boitier_lovage.gps?.reference, 'KRE 101 2395/2');
    assert.equal(bouyguesPayload.boitier_lovage.gps?.dimensions, 'Ø78');
    assert.equal(bouyguesPayload.boitier_lovage.gps?.weight_kg, 0.225);
    assert.equal(bouyguesPayload.boitier_lovage.has_mdea, false);
    assert.equal(bouyguesPayload.boitier_lovage.mdea, null);
  });
});
