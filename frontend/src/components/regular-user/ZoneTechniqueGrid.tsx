import React from 'react';
import { TDEquipmentToggle } from './equipment/TDEquipmentToggle';
import { GPSEquipmentToggle } from './equipment/GPSEquipmentToggle';
import { BoitierLovageEquipmentToggle } from './equipment/BoitierLovageEquipmentToggle';
import { CoffretTransFoEquipmentToggle } from './equipment/CoffretTransFoEquipmentToggle';
import { BCubeEquipmentToggle } from './equipment/BCubeEquipmentToggle';
import { BCubeRadioEquipmentToggle } from './equipment/BCubeRadioEquipmentToggle';
import { TGBTEquipmentToggle } from './equipment/TGBTEquipmentToggle';
import { BaieEquipmentToggle, DEFAULT_ORANGE_BAIES } from './equipment/BaieEquipmentToggle';
import { CabEquipmentToggle } from './equipment/CabEquipmentToggle';
import { AtelierEnergieEquipmentToggle } from './equipment/AtelierEnergieEquipmentToggle';
import { PileAmodEquipmentToggle } from './equipment/PileAmodEquipmentToggle';
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
  if (operator === 'free') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Row 1: Pile AMOD & Atelier d'énergie */}
        <PileAmodEquipmentToggle
          hasPileAmod={data.hasPileAmod}
          setHasPileAmod={(val) => onChange({ hasPileAmod: val })}
          amodModules={data.amodModules}
          setAmodModules={(val) => onChange({ amodModules: val })}
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

        {/* Row 2: TD & GPS */}
        <TDEquipmentToggle
          hasTdEquipment={data.hasTdEquipment}
          setHasTdEquipment={(val) => onChange({ hasTdEquipment: val })}
          tdType={data.tdType}
          setTdType={(val) => onChange({ tdType: val })}
          tdReference={data.tdReference}
          setTdReference={(val) => onChange({ tdReference: val })}
          tdOptions={config?.td_references || []}
          operator={operator}
        />
        <GPSEquipmentToggle
          hasGps={data.hasGps}
          setHasGps={(val) => onChange({ hasGps: val })}
          gpsReference={data.gpsReference}
          setGpsReference={(val) => onChange({ gpsReference: val })}
          gpsMarque={data.gpsMarque}
          setGpsMarque={(val) => onChange({ gpsMarque: val })}
          operator={operator}
        />

        {/* Row 3: Boîtier Lovage & Coffret TRANS FO sit on the same row */}
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
        <CoffretTransFoEquipmentToggle
          hasCoffretTransFo={!!data.hasCoffretTransFo}
          setHasCoffretTransFo={(val) => onChange({ hasCoffretTransFo: val })}
          coffretTransFoQuantity={data.coffretTransFoQuantity ?? 1}
          setCoffretTransFoQuantity={(val) => onChange({ coffretTransFoQuantity: val })}
          coffretReference={data.coffretTransFoReference || 'TRANS_FO'}
          setCoffretReference={(val) => onChange({ coffretTransFoReference: val })}
          coffretOptions={config?.coffret_references || []}
        />

        {/* Row 4: Convertisseur MDEA & Présence Baie CAB X */}
        <ConvertisseurMdeaEquipmentToggle
          hasConvertisseurMdea={data.hasConvertisseurMdea}
          setHasConvertisseurMdea={(val) => onChange({ hasConvertisseurMdea: val })}
          convertisseurMdeaQuantity={data.convertisseurMdeaQuantity}
          setConvertisseurMdeaQuantity={(val) => onChange({ convertisseurMdeaQuantity: val })}
        />
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
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* For Bouygues: Row 1 = BCube RADIO & B-cube énergie, Row 2 = TGBT & GPS */}
      {operator === 'bouygues' ? (
        <>
          {/* Row 1 */}
          <BCubeRadioEquipmentToggle
            hasBcubeRadio={data.hasBcubeRadio}
            setHasBcubeRadio={(val) => onChange({ hasBcubeRadio: val })}
            bcubeRadioReference={data.bcubeRadioReference}
            setBcubeRadioReference={(val) => onChange({ bcubeRadioReference: val })}
          />
          <BCubeEquipmentToggle
            hasAtelierEnergie={data.hasAtelierEnergie}
            setHasAtelierEnergie={(val) => onChange({ hasAtelierEnergie: val })}
            bcubeReference={data.bcubeReference}
            setBcubeReference={(val) => onChange({ bcubeReference: val })}
            options={config?.atelier_energie_references || []}
          />

          {/* Row 2 */}
          <TGBTEquipmentToggle
            hasTgbt={data.hasTgbt}
            setHasTgbt={(val) => onChange({ hasTgbt: val })}
            tgbtReference={data.tgbtReference}
            setTgbtReference={(val) => onChange({ tgbtReference: val })}
            options={(config?.tgbt_references || []).filter(item => item.id !== 'tgbt_standard_300' && item.reference !== 'TGBT 300x255x160mm' && item.reference !== '300x255x160mm')}
          />
          <GPSEquipmentToggle
            hasGps={data.hasGps}
            setHasGps={(val) => onChange({ hasGps: val })}
            gpsReference={data.gpsReference}
            setGpsReference={(val) => onChange({ gpsReference: val })}
            gpsMarque={data.gpsMarque}
            setGpsMarque={(val) => onChange({ gpsMarque: val })}
            operator={operator}
          />
        </>
      ) : (
        <>
          {/* 1. TD Equipment (Free only, as Orange uses Baies and Bouygues uses BCube/TGBT) */}
          {operator !== 'orange' && (
            <TDEquipmentToggle
              hasTdEquipment={data.hasTdEquipment}
              setHasTdEquipment={(val) => onChange({ hasTdEquipment: val })}
              tdType={data.tdType}
              setTdType={(val) => onChange({ tdType: val })}
              tdReference={data.tdReference}
              setTdReference={(val) => onChange({ tdReference: val })}
              tdOptions={config?.td_references || []}
              operator={operator}
            />
          )}

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
        </>
      )}

      {/* 4. Boîtier Lovage */}
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
    </div>
  );
}

export default ZoneTechniqueGrid;
