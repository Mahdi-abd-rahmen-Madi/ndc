import React from 'react';
import { Layers } from 'lucide-react';
import { TDEquipmentToggle } from './equipment/TDEquipmentToggle';
import { GPSEquipmentToggle } from './equipment/GPSEquipmentToggle';
import { BoitierLovageEquipmentToggle } from './equipment/BoitierLovageEquipmentToggle';
import { BCubeEquipmentToggle } from './equipment/BCubeEquipmentToggle';
import { BCubeRadioEquipmentToggle } from './equipment/BCubeRadioEquipmentToggle';
import { TGBTEquipmentToggle } from './equipment/TGBTEquipmentToggle';
import { BaieEquipmentToggle, DEFAULT_ORANGE_BAIES } from './equipment/BaieEquipmentToggle';
import { CabEquipmentToggle } from './equipment/CabEquipmentToggle';
import { AtelierEnergieEquipmentToggle } from './equipment/AtelierEnergieEquipmentToggle';
import { PileAmodEquipmentToggle } from './equipment/PileAmodEquipmentToggle';
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
    const configMode = data.freeConfigMode || 'standard';

    const handleConfigModeChange = (mode: 'standard' | 'alternative') => {
      if (mode === configMode) return;
      if (mode === 'alternative') {
        onChange({
          freeConfigMode: 'alternative',
          hasPileAmod: false,
          hasAtelierEnergie: false,
          hasTdEquipment: false,
        });
      } else {
        onChange({
          freeConfigMode: 'standard',
          hasCab: false,
          cabOne: false,
          cabTwo: false,
          cabThree: false,
        });
      }
    };

    return (
      <div className="flex flex-col gap-4">
        {/* Free Zone Technique Configuration Switcher */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-violet-600" />
              Configuration Zone Technique (Free)
            </span>
            <p className="text-[11px] text-slate-500">
              {configMode === 'standard'
                ? 'Standard : Pile système AMOD, Atelier d’énergie, TD, GPS & Coffret TRANS FO'
                : 'Alternative : Baie outdoor CAB X (CAB ONE, TWO, THREE), GPS & Coffret TRANS FO'}
            </p>
          </div>

          <div className="relative flex p-1 bg-slate-200/90 rounded-xl border border-slate-300/80 w-full sm:w-60 shrink-0">
            <div
              className="absolute inset-y-1 bg-white rounded-lg shadow-sm duration-300 ease-out transition-all"
              style={{
                width: 'calc(50% - 4px)',
                left: configMode === 'standard' ? '4px' : 'calc(50%)'
              }}
            />
            <button
              type="button"
              onClick={() => handleConfigModeChange('standard')}
              className={`relative flex-1 py-1.5 rounded-lg text-xs font-bold z-10 transition-colors text-center ${
                configMode === 'standard' ? 'text-violet-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => handleConfigModeChange('alternative')}
              className={`relative flex-1 py-1.5 rounded-lg text-xs font-bold z-10 transition-colors text-center ${
                configMode === 'alternative' ? 'text-violet-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Alternative
            </button>
          </div>
        </div>

        {configMode === 'standard' ? (
          <>
            {/* Ligne 1 : BAIE SYSTEME RADIO AMOD & BAIE ENERGIE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
            </div>

            {/* Ligne 2 : TABLEAU DIVISIONNAIRE & GPS empilés à gauche, BOITIER LOVAGE / COFFRET TRANS FO à droite */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Colonne gauche : TD & GPS empilés */}
              <div className="flex flex-col gap-4">
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
              </div>

              {/* Colonne droite : Boîtier Lovage & Coffret TRANS FO */}
              <div>
                <BoitierLovageEquipmentToggle
                  hasBoitierLovage={data.hasBoitierLovage}
                  setHasBoitierLovage={(val) => onChange({ hasBoitierLovage: val })}
                  boitierLovageReference={data.boitierLovageReference}
                  setBoitierLovageReference={(val) => onChange({ boitierLovageReference: val })}
                  boitierLovageQuantity={data.boitierLovageQuantity}
                  setBoitierLovageQuantity={(val) => onChange({ boitierLovageQuantity: val })}
                  boitierOptions={config?.boitier_lovage_references || []}
                  operator={operator}
                  hasCoffretTransFo={!!data.hasCoffretTransFo}
                  setHasCoffretTransFo={(val) => onChange({ hasCoffretTransFo: val })}
                  coffretTransFoQuantity={data.coffretTransFoQuantity ?? 1}
                  setCoffretTransFoQuantity={(val) => onChange({ coffretTransFoQuantity: val })}
                  coffretOptions={config?.coffret_references || []}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Alternative Config : CAB X à gauche, BOITIER LOVAGE / TRANS FO & GPS empilés à droite */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Colonne gauche : Présence Baie CAB X */}
              <div>
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

              {/* Colonne droite : Boîtier Lovage / Coffret TRANS FO & GPS empilés */}
              <div className="flex flex-col gap-4">
                <BoitierLovageEquipmentToggle
                  hasBoitierLovage={data.hasBoitierLovage}
                  setHasBoitierLovage={(val) => onChange({ hasBoitierLovage: val })}
                  boitierLovageReference={data.boitierLovageReference}
                  setBoitierLovageReference={(val) => onChange({ boitierLovageReference: val })}
                  boitierLovageQuantity={data.boitierLovageQuantity}
                  setBoitierLovageQuantity={(val) => onChange({ boitierLovageQuantity: val })}
                  boitierOptions={config?.boitier_lovage_references || []}
                  operator={operator}
                  hasCoffretTransFo={!!data.hasCoffretTransFo}
                  setHasCoffretTransFo={(val) => onChange({ hasCoffretTransFo: val })}
                  coffretTransFoQuantity={data.coffretTransFoQuantity ?? 1}
                  setCoffretTransFoQuantity={(val) => onChange({ coffretTransFoQuantity: val })}
                  coffretOptions={config?.coffret_references || []}
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
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* For Bouygues: Row 1 = BCube RADIO & B-cube énergie ACTIA, Row 2 = TGBT & GPS */}
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
          {/* 1. TD Equipment */}
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
