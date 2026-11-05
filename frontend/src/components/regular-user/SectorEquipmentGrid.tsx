import React from 'react';
import { AlignJustify } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { FHEquipmentToggle } from './equipment/FHEquipmentToggle';
import { RRHEquipmentToggle } from './equipment/RRHEquipmentToggle';
import { RRUEquipmentToggle } from './equipment/RRUEquipmentToggle';
import { CoffretEquipmentToggle } from './equipment/CoffretEquipmentToggle';
import type { SectorData, CatalogueConfig, EquipmentItem } from './types';

export interface SectorEquipmentGridProps {
  sector: SectorData;
  sectorIndex: number;
  updateSector: (index: number, updates: Partial<SectorData>) => void;
  config: CatalogueConfig | null;
  operator?: string;
  nombreSecteurs?: number;
  selectedEchelle?: string;
  setSelectedEchelle?: (val: string) => void;
}

export function SectorEquipmentGrid({
  sector,
  sectorIndex,
  updateSector,
  config,
  operator = 'bouygues',
  nombreSecteurs = 1,
  selectedEchelle = '',
  setSelectedEchelle
}: SectorEquipmentGridProps) {
  const syncUpdates = (updates: Partial<SectorData>) => {
    updateSector(sectorIndex, updates);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 0. Échelle */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5 tracking-wider">
              <AlignJustify className="w-3.5 h-3.5 text-violet-600 shrink-0" />
              <span>Présence echelle + Palier de repos rabattable + PA <span className="text-red-500 font-bold">*</span></span>
            </label>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              1x par site
            </span>
          </div>
          <CustomSelect
            value={selectedEchelle}
            onChange={(val) => setSelectedEchelle?.(val)}
            options={[
              { value: "Pas d'échelle", label: "Pas d'échelle" },
              { value: 'Echelle Söll', label: 'Echelle Söll' },
              { value: 'Echelle Perroquet', label: 'Echelle Perroquet' },
              { value: 'Echelle Pivotloc', label: 'Echelle Pivotloc' }
            ]}
            placeholder="Sélectionner une échelle"
            className="w-full"
            error={!selectedEchelle}
          />
        </div>
      </div>
      {/* 1. FH */}
      <FHEquipmentToggle
        hasFhEquipment={!!sector.hasFhEquipment}
        setHasFhEquipment={(val) => syncUpdates({ hasFhEquipment: val })}
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
          setHasRrhEquipment={(val) => syncUpdates({ hasRrhEquipment: val })}
          rrhItems={sector.rrhItems || []}
          setRrhItems={(val) => {
            const newItems = typeof val === 'function' ? val(sector.rrhItems || []) : val;
            syncUpdates({ rrhItems: newItems });
          }}
          rrhOptions={config?.rrh_references || []}
          operator={operator}
          nombreSecteurs={nombreSecteurs}
        />
      )}

      {/* 3. RRU */}
      <RRUEquipmentToggle
        hasRruEquipment={!!sector.hasRruEquipment}
        setHasRruEquipment={(val) => syncUpdates({ hasRruEquipment: val })}
        rruItems={sector.rruItems || []}
        setRruItems={(val) => {
          const newItems = typeof val === 'function' ? val(sector.rruItems || []) : val;
          syncUpdates({ rruItems: newItems });
        }}
        rruOptions={config?.rru_references || []}
        isRfmMode={operator === 'free'}
        operator={operator}
        nombreSecteurs={nombreSecteurs}
      />

      {/* 4. Coffrets fibre (uniquement pour les opérateurs hors Free, car Free a son coffret TRANS FO en zone technique) */}
      {operator !== 'free' && (
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
  );
}

export default SectorEquipmentGrid;
