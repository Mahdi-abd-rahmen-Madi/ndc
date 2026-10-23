import React from 'react';
import { TDEquipmentToggle } from './equipment/TDEquipmentToggle';
import { GPSEquipmentToggle } from './equipment/GPSEquipmentToggle';
import { BoitierLovageEquipmentToggle } from './equipment/BoitierLovageEquipmentToggle';
import { BCubeEquipmentToggle } from './equipment/BCubeEquipmentToggle';
import { BaieEquipmentToggle, DEFAULT_ORANGE_BAIES } from './equipment/BaieEquipmentToggle';
import { CabEquipmentToggle } from './equipment/CabEquipmentToggle';
import { AtelierEnergieEquipmentToggle } from './equipment/AtelierEnergieEquipmentToggle';
import { ConvertisseurMdeaEquipmentToggle } from './equipment/ConvertisseurMdeaEquipmentToggle';
import type { CatalogueConfig, SelectedBaieItem } from './types';

export interface ZoneTechniqueState {
  hasTdEquipment: boolean;
  setHasTdEquipment: (val: boolean) => void;
  tdType: 'tetraphase' | 'monophase';
  setTdType: (val: 'tetraphase' | 'monophase') => void;
  tdReference: string;
  setTdReference: (val: string) => void;
  tgbtReference: string;
  setTgbtReference: (val: string) => void;

  hasGps: boolean;
  setHasGps: (val: boolean) => void;
  gpsReference: string;
  setGpsReference: (val: string) => void;
  gpsMarque?: string;
  setGpsMarque?: (val: string) => void;

  hasBoitierLovage: boolean;
  setHasBoitierLovage: (val: boolean) => void;
  boitierLovageReference: string;
  setBoitierLovageReference: (val: string) => void;
  boitierLovageQuantity: number;
  setBoitierLovageQuantity: (val: number) => void;

  hasAtelierEnergie: boolean;
  setHasAtelierEnergie: (val: boolean) => void;
  bcubeReference: string;
  setBcubeReference: (val: string) => void;

  hasBaie: boolean;
  setHasBaie: (val: boolean) => void;
  baieItems: SelectedBaieItem[];
  setBaieItems: (val: SelectedBaieItem[]) => void;
  baieRadio?: boolean;
  setBaieRadio?: (val: boolean) => void;
  baieEnergie?: boolean;
  setBaieEnergie?: (val: boolean) => void;

  hasCab: boolean;
  setHasCab: (val: boolean) => void;
  cabOne: boolean;
  setCabOne: (val: boolean) => void;
  cabTwo: boolean;
  setCabTwo: (val: boolean) => void;
  cabThree: boolean;
  setCabThree: (val: boolean) => void;
  cabSupport: string;
  setCabSupport: (val: string) => void;

  atelierFprb: boolean;
  setAtelierFprb: (val: boolean) => void;
  atelierFprbQuantity?: number;
  setAtelierFprbQuantity?: (val: number) => void;
  atelierFpbc: boolean;
  setAtelierFpbc: (val: boolean) => void;
  atelierFpbcQuantity?: number;
  setAtelierFpbcQuantity?: (val: number) => void;

  hasConvertisseurMdea: boolean;
  setHasConvertisseurMdea: (val: boolean) => void;
  convertisseurMdeaQuantity: number;
  setConvertisseurMdeaQuantity: (val: number) => void;
}

export interface ZoneTechniqueGridProps {
  state: ZoneTechniqueState;
  config: CatalogueConfig | null;
  operator?: string;
}

export function ZoneTechniqueGrid({
  state,
  config,
  operator = 'bouygues'
}: ZoneTechniqueGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. TD Equipment */}
      <TDEquipmentToggle
        hasTdEquipment={state.hasTdEquipment}
        setHasTdEquipment={state.setHasTdEquipment}
        tdType={state.tdType}
        setTdType={state.setTdType}
        tdReference={state.tdReference}
        setTdReference={state.setTdReference}
        tgbtReference={state.tgbtReference}
        setTgbtReference={state.setTgbtReference}
        tdOptions={config?.td_references || []}
        operator={operator}
      />

      {/* 2. GPS */}
      <GPSEquipmentToggle
        hasGps={state.hasGps}
        setHasGps={state.setHasGps}
        gpsReference={state.gpsReference}
        setGpsReference={state.setGpsReference}
        gpsMarque={state.gpsMarque}
        setGpsMarque={state.setGpsMarque}
        operator={operator}
      />

      {/* 3. Boîtier Lovage */}
      <BoitierLovageEquipmentToggle
        hasBoitierLovage={state.hasBoitierLovage}
        setHasBoitierLovage={state.setHasBoitierLovage}
        boitierLovageReference={state.boitierLovageReference}
        setBoitierLovageReference={state.setBoitierLovageReference}
        boitierLovageQuantity={state.boitierLovageQuantity}
        setBoitierLovageQuantity={state.setBoitierLovageQuantity}
        boitierOptions={config?.boitier_lovage_references || []}
        operator={operator}
      />

      {/* 4. BCube (Bouygues) */}
      {operator === 'bouygues' && (
        <BCubeEquipmentToggle
          hasAtelierEnergie={state.hasAtelierEnergie}
          setHasAtelierEnergie={state.setHasAtelierEnergie}
          bcubeReference={state.bcubeReference}
          setBcubeReference={state.setBcubeReference}
          options={config?.atelier_energie_references || []}
        />
      )}

      {/* 5. Baies (Orange) */}
      {operator === 'orange' && (
        <div className="lg:col-span-2">
          <BaieEquipmentToggle
            hasBaie={state.hasBaie}
            setHasBaie={state.setHasBaie}
            baieItems={state.baieItems}
            setBaieItems={state.setBaieItems}
            baieOptions={config?.baie_references || DEFAULT_ORANGE_BAIES}
            baieRadio={state.baieRadio}
            setBaieRadio={state.setBaieRadio}
            baieEnergie={state.baieEnergie}
            setBaieEnergie={state.setBaieEnergie}
          />
        </div>
      )}

      {/* 6. CAB, Atelier Energie & Convertisseur MDEA (Free) */}
      {operator === 'free' && (
        <>
          <CabEquipmentToggle
            hasCab={state.hasCab}
            setHasCab={state.setHasCab}
            cabOne={state.cabOne}
            setCabOne={state.setCabOne}
            cabTwo={state.cabTwo}
            setCabTwo={state.setCabTwo}
            cabThree={state.cabThree}
            setCabThree={state.setCabThree}
            cabSupport={state.cabSupport}
            setCabSupport={state.setCabSupport}
          />
          <AtelierEnergieEquipmentToggle
            hasAtelierEnergie={state.hasAtelierEnergie}
            setHasAtelierEnergie={state.setHasAtelierEnergie}
            atelierFprb={state.atelierFprb}
            setAtelierFprb={state.setAtelierFprb}
            atelierFprbQuantity={state.atelierFprbQuantity}
            setAtelierFprbQuantity={state.setAtelierFprbQuantity}
            atelierFpbc={state.atelierFpbc}
            setAtelierFpbc={state.setAtelierFpbc}
            atelierFpbcQuantity={state.atelierFpbcQuantity}
            setAtelierFpbcQuantity={state.setAtelierFpbcQuantity}
          />
          <ConvertisseurMdeaEquipmentToggle
            hasConvertisseurMdea={state.hasConvertisseurMdea}
            setHasConvertisseurMdea={state.setHasConvertisseurMdea}
            convertisseurMdeaQuantity={state.convertisseurMdeaQuantity}
            setConvertisseurMdeaQuantity={state.setConvertisseurMdeaQuantity}
          />
        </>
      )}
    </div>
  );
}

export default ZoneTechniqueGrid;
