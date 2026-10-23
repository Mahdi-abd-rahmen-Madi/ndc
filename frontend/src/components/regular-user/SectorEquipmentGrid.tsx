import React from 'react';
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
  // Optional root sync callbacks if sectorIndex === 0
  onRootSync?: (updates: Partial<SectorData>) => void;
}

export function SectorEquipmentGrid({
  sector,
  sectorIndex,
  updateSector,
  config,
  operator = 'bouygues',
  nombreSecteurs = 1,
  onRootSync
}: SectorEquipmentGridProps) {
  const syncUpdates = (updates: Partial<SectorData>) => {
    updateSector(sectorIndex, updates);
    if (sectorIndex === 0 && onRootSync) {
      onRootSync(updates);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

      {/* 4. Coffrets fibre */}
      <CoffretEquipmentToggle
        hasCoffret={!!sector.hasCoffret}
        setHasCoffret={(val) => syncUpdates({ hasCoffret: val })}
        coffretReference={sector.coffretReference || ''}
        setCoffretReference={(val) => syncUpdates({ coffretReference: val })}
        coffretOptions={config?.coffret_references || []}
        operator={operator}
        nombreSecteurs={nombreSecteurs}
      />
    </div>
  );
}

export default SectorEquipmentGrid;
