import React from 'react';
import { TDEquipmentToggle } from './equipment/TDEquipmentToggle';
import { GPSEquipmentToggle } from './equipment/GPSEquipmentToggle';
import { BoitierLovageEquipmentToggle } from './equipment/BoitierLovageEquipmentToggle';
import { BCubeEquipmentToggle } from './equipment/BCubeEquipmentToggle';
import { BaieEquipmentToggle, DEFAULT_ORANGE_BAIES } from './equipment/BaieEquipmentToggle';
import { CabEquipmentToggle } from './equipment/CabEquipmentToggle';
import { AtelierEnergieEquipmentToggle } from './equipment/AtelierEnergieEquipmentToggle';
import { ConvertisseurMdeaEquipmentToggle } from './equipment/ConvertisseurMdeaEquipmentToggle';
import type { CatalogueConfig, ZoneTechniqueData } from './types';

export interface ZoneTechniqueGridProps {
  data: ZoneTechniqueData;
  onChange: (updates: Partial<ZoneTechniqueData>) => void;
  config: CatalogueConfig | null;
  operator?: string;
}

export function ZoneTechniqueGrid({
  data,
  onChange,
  config,
  operator = 'bouygues'
}: ZoneTechniqueGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. TD Equipment */}
      <TDEquipmentToggle
        hasTdEquipment={data.hasTdEquipment}
        setHasTdEquipment={(val) => onChange({ hasTdEquipment: val })}
        tdType={data.tdType}
        setTdType={(val) => onChange({ tdType: val })}
        tdReference={data.tdReference}
        setTdReference={(val) => onChange({ tdReference: val })}
        tgbtReference={data.tgbtReference}
        setTgbtReference={(val) => onChange({ tgbtReference: val })}
        tdOptions={config?.td_references || []}
        operator={operator}
      />

      {/* 2. GPS */}
      <GPSEquipmentToggle
        hasGps={data.hasGps}
        setHasGps={(val) => onChange({ hasGps: val })}
        gpsReference={data.gpsReference}
        setGpsReference={(val) => onChange({ gpsReference: val })}
        gpsMarque={data.gpsMarque}
        setGpsMarque={(val) => onChange({ gpsMarque: val })}
        operator={operator}
      />

      {/* 3. Boîtier Lovage */}
      <BoitierLovageEquipmentToggle
        hasBoitierLovage={data.hasBoitierLovage}
        setHasBoitierLovage={(val) => onChange({ hasBoitierLovage: val })}
        boitierLovageReference={data.boitierLovageReference}
        setBoitierLovageReference={(val) => onChange({ boitierLovageReference: val })}
        boitierLovageQuantity={data.boitierLovageQuantity}
        setBoitierLovageQuantity={(val) => onChange({ boitierLovageQuantity: val })}
        boitierOptions={config?.boitier_lovage_references || []}
        operator={operator}
      />

      {/* 4. BCube (Bouygues) */}
      {operator === 'bouygues' && (
        <BCubeEquipmentToggle
          hasAtelierEnergie={data.hasAtelierEnergie}
          setHasAtelierEnergie={(val) => onChange({ hasAtelierEnergie: val })}
          bcubeReference={data.bcubeReference}
          setBcubeReference={(val) => onChange({ bcubeReference: val })}
          options={config?.atelier_energie_references || []}
        />
      )}

      {/* 5. Baies (Orange) */}
      {operator === 'orange' && (
        <div className="lg:col-span-2">
          <BaieEquipmentToggle
            hasBaie={data.hasBaie}
            setHasBaie={(val) => onChange({ hasBaie: val })}
            baieItems={data.baieItems}
            setBaieItems={(val) => onChange({ baieItems: val })}
            baieOptions={config?.baie_references || DEFAULT_ORANGE_BAIES}
            baieRadio={data.baieRadio}
            setBaieRadio={(val) => onChange({ baieRadio: val })}
            baieEnergie={data.baieEnergie}
            setBaieEnergie={(val) => onChange({ baieEnergie: val })}
          />
        </div>
      )}

      {/* 6. CAB, Atelier Energie & Convertisseur MDEA (Free) */}
      {operator === 'free' && (
        <>
          <CabEquipmentToggle
            hasCab={data.hasCab}
            setHasCab={(val) => onChange({ hasCab: val })}
            cabOne={data.cabOne}
            setCabOne={(val) => onChange({ cabOne: val })}
            cabTwo={data.cabTwo}
            setCabTwo={(val) => onChange({ cabTwo: val })}
            cabThree={data.cabThree}
            setCabThree={(val) => onChange({ cabThree: val })}
            cabSupport={data.cabSupport}
            setCabSupport={(val) => onChange({ cabSupport: val })}
          />
          <AtelierEnergieEquipmentToggle
            hasAtelierEnergie={data.hasAtelierEnergie}
            setHasAtelierEnergie={(val) => onChange({ hasAtelierEnergie: val })}
            atelierFprb={data.atelierFprb}
            setAtelierFprb={(val) => onChange({ atelierFprb: val })}
            atelierFprbQuantity={data.atelierFprbQuantity}
            setAtelierFprbQuantity={(val) => onChange({ atelierFprbQuantity: val })}
            atelierFpbc={data.atelierFpbc}
            setAtelierFpbc={(val) => onChange({ atelierFpbc: val })}
            atelierFpbcQuantity={data.atelierFpbcQuantity}
            setAtelierFpbcQuantity={(val) => onChange({ atelierFpbcQuantity: val })}
          />
          <ConvertisseurMdeaEquipmentToggle
            hasConvertisseurMdea={data.hasConvertisseurMdea}
            setHasConvertisseurMdea={(val) => onChange({ hasConvertisseurMdea: val })}
            convertisseurMdeaQuantity={data.convertisseurMdeaQuantity}
            setConvertisseurMdeaQuantity={(val) => onChange({ convertisseurMdeaQuantity: val })}
          />
        </>
      )}
    </div>
  );
}

export default ZoneTechniqueGrid;
