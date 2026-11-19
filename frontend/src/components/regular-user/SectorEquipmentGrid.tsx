import React from 'react';
import { Anchor } from 'lucide-react';
import { FHEquipmentToggle } from './equipment/FHEquipmentToggle';
import { RRHEquipmentToggle } from './equipment/RRHEquipmentToggle';
import { RRUEquipmentToggle } from './equipment/RRUEquipmentToggle';
import { CoffretEquipmentToggle } from './equipment/CoffretEquipmentToggle';
import { BoitierJonctionEquipmentToggle } from './equipment/BoitierJonctionEquipmentToggle';
import type { SectorData, CatalogueConfig, EquipmentItem } from './types';

export interface SectorEquipmentGridProps {
  sector: SectorData;
  sectorIndex: number;
  updateSector: (index: number, updates: Partial<SectorData>) => void;
  config: CatalogueConfig | null;
  operator?: string;
  nombreSecteurs?: number;
}

export function SectorEquipmentGrid({
  sector,
  sectorIndex,
  updateSector,
  config,
  operator = 'bouygues',
  nombreSecteurs = 1
}: SectorEquipmentGridProps) {
  const syncUpdates = (updates: Partial<SectorData>) => {
    updateSector(sectorIndex, updates);
  };

  const isOrange = operator === 'orange';
  const isFree = operator === 'free';
  const isRrhDisabled = isOrange && !!sector.hasRruEquipment;
  const isRruDisabled = isOrange && !!sector.hasRrhEquipment;
  const hasAnyAerialEquipment = Boolean(
    sector.hasFhEquipment ||
    (operator !== 'bouygues' && sector.hasRrhEquipment) ||
    sector.hasRruEquipment ||
    (isFree ? sector.hasBoitierJonction : sector.hasCoffret)
  );
  const currentEquipmentFoundation = sector.equipmentFoundationType || 'metallique';
  
  return (
    <div className="flex flex-col gap-4">
      {/* Type d'ancrage pour équipements aériens avec 3 options dont dallettes */}
      {hasAnyAerialEquipment && (
        <div className="flex flex-col p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl animate-fadeIn">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-2 h-6">
            <span className="flex items-center gap-1.5">
              <Anchor className="w-3.5 h-3.5 text-violet-600" />
              Type d'ancrage <span className="text-red-500 font-bold">*</span>
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-xl">
            <button
              type="button"
              onClick={() => syncUpdates({ equipmentFoundationType: 'metallique' })}
              className={`py-2 px-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                currentEquipmentFoundation === 'metallique'
                  ? 'border-violet-600 bg-violet-50/70 text-violet-950 font-semibold shadow-2xs ring-1 ring-violet-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
              }`}
            >
              <span className="text-xs font-bold">Plot métallique</span>
              <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Disponible</span>
            </button>

            <button
              type="button"
              onClick={() => syncUpdates({ equipmentFoundationType: 'beton' })}
              disabled
              className={`py-2 px-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-not-allowed opacity-60 ${
                currentEquipmentFoundation === 'beton'
                  ? 'border-violet-600 bg-violet-50/70 text-violet-950 font-semibold shadow-2xs ring-1 ring-violet-500/20'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span className="text-xs font-bold">Plot Béton</span>
              <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Indispo.</span>
            </button>

            <button
              type="button"
              onClick={() => syncUpdates({ equipmentFoundationType: 'dallettes' })}
              disabled
              className={`py-2 px-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-not-allowed opacity-60 ${
                currentEquipmentFoundation === 'dallettes'
                  ? 'border-violet-600 bg-violet-50/70 text-violet-950 font-semibold shadow-2xs ring-1 ring-violet-500/20'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span className="text-xs font-bold">Dallettes</span>
              <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Indispo.</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. FH */}
      <FHEquipmentToggle
        hasFhEquipment={!!sector.hasFhEquipment}
        setHasFhEquipment={(val) => syncUpdates({ hasFhEquipment: val })}
        fhItems={sector.fhItems || []}
        setFhItems={(val) => {
          const newItems = typeof val === 'function' ? val(sector.fhItems || []) : val;
          syncUpdates({ fhItems: newItems });
        }}
        fhDiameter={sector.fhDiameter || 0}
        setFhDiameter={(val) => syncUpdates({ fhDiameter: val })}
        fhReference={sector.fhReference || ''}
        setFhReference={(val) => syncUpdates({ fhReference: val })}
        fhQuantity={sector.fhQuantity || 1}
        setFhQuantity={(val) => syncUpdates({ fhQuantity: val })}
        fhOptions={config?.fh_references || []}
        nombreSecteurs={nombreSecteurs}
      />

      {/* 2. RRH (Non-Bouygues) */}
      {operator !== 'bouygues' && (
        <RRHEquipmentToggle
          hasRrhEquipment={!!sector.hasRrhEquipment}
          setHasRrhEquipment={(val) => {
            if (val && isOrange) {
              syncUpdates({ hasRrhEquipment: true, hasRruEquipment: false });
            } else {
              syncUpdates({ hasRrhEquipment: val });
            }
          }}
          rrhItems={sector.rrhItems || []}
          setRrhItems={(val) => {
            const newItems = typeof val === 'function' ? val(sector.rrhItems || []) : val;
            syncUpdates({ rrhItems: newItems });
          }}
          rrhOptions={config?.rrh_references || []}
          operator={operator}
          nombreSecteurs={nombreSecteurs}
          disabled={isRrhDisabled}
          disabledReason={isRrhDisabled ? 'Non cumulable avec RRU' : undefined}
        />
      )}

      {/* 3. RRU */}
      <RRUEquipmentToggle
        hasRruEquipment={!!sector.hasRruEquipment}
        setHasRruEquipment={(val) => {
          if (val && isOrange) {
            syncUpdates({ hasRruEquipment: true, hasRrhEquipment: false });
          } else {
            syncUpdates({ hasRruEquipment: val });
          }
        }}
        rruItems={sector.rruItems || []}
        setRruItems={(val) => {
          const newItems = typeof val === 'function' ? val(sector.rruItems || []) : val;
          syncUpdates({ rruItems: newItems });
        }}
        rruOptions={config?.rru_references || []}
        isRfmMode={operator === 'free'}
        operator={operator}
        nombreSecteurs={nombreSecteurs}
        disabled={isRruDisabled}
        disabledReason={isRruDisabled ? 'Non cumulable avec RRH' : undefined}
      />

      {/* 4. Boîtier de jonction FO (Free) ou Coffrets fibre (hors Free) */}
      {operator === 'free' ? (
        <BoitierJonctionEquipmentToggle
          hasBoitierJonction={!!sector.hasBoitierJonction}
          setHasBoitierJonction={(val) => syncUpdates({ hasBoitierJonction: val })}
          boitierJonctionQuantity={sector.boitierJonctionQuantity || 1}
          setBoitierJonctionQuantity={(val) => syncUpdates({ boitierJonctionQuantity: val })}
        />
      ) : (
        <CoffretEquipmentToggle
          hasCoffret={!!sector.hasCoffret}
          setHasCoffret={(val) => syncUpdates({ hasCoffret: val })}
          coffretReference={sector.coffretReference || ''}
          setCoffretReference={(val) => syncUpdates({ coffretReference: val })}
          coffretOptions={config?.coffret_references || []}
          operator={operator}
          nombreSecteurs={nombreSecteurs}
        />
      )}
      </div>
    </div>
  );
}

export default SectorEquipmentGrid;
