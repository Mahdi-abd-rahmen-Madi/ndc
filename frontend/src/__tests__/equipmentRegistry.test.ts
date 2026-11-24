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
    assert.equal(payload.fh_equipment.sans_plot, false);
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

    // Structure FH check
    assert.deepEqual(payload.structure_fh, {
      mast_section: 'TRON 88x3.2',
      plot_section: 'TCAR 150x5',
      hauteur_mat_m: 1.70,
      hauteur_plot_m: 0.50,
    });

    // FH and RRU coexist, while RRH and RRU are mutually exclusive
    assert.equal(payload.rru_equipment.enabled, true);
    assert.equal(payload.rru_equipment.sans_plot, false);
    assert.equal(payload.rru_equipment.with_plot, true);
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
});
