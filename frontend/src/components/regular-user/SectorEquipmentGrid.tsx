import React from 'react';
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
  const isRrhDisabled = isOrange && !!sector.hasRruEquipment;
  const isRruDisabled = isOrange && !!sector.hasRrhEquipment;
  
  return (
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
  );
}

export default SectorEquipmentGrid;
