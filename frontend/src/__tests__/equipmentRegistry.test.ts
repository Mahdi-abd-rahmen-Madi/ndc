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
      hasRrhEquipment: true,
      rrhItems: [{ id: '1', reference: 'AHHB', quantity: 2 }],
      hasCoffret: true,
    };
    const zt = {
      ...defaultZoneTechniqueData,
      hasTdEquipment: true,
      hasGps: true,
    };

    const aerial = extractSectorAerialState(sector);
    assert.equal(aerial.hasFhEquipment, true);
    assert.equal(aerial.fhQuantity, 2);

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
      hasCoffret: true,
      coffretReference: 'UTEL V3',
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
    assert.equal(payload.rru_equipment.items.length, 1);
    assert.equal(payload.coffrets_fibre.enabled, true);
    assert.equal(payload.coffrets_fibre.quantity, 3);
  });
});
