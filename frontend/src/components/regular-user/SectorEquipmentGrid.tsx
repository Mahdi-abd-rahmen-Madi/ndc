import React from 'react';
import { FHEquipmentToggle } from './equipment/FHEquipmentToggle';
import { RRHEquipmentToggle } from './equipment/RRHEquipmentToggle';
import { RRUEquipmentToggle } from './equipment/RRUEquipmentToggle';
import { CoffretEquipmentToggle } from './equipment/CoffretEquipmentToggle';
import { BoitierJonctionEquipmentToggle } from './equipment/BoitierJonctionEquipmentToggle';
import type { SectorData, CatalogueConfig } from './types';

export interface SectorEquipmentGridProps {
  sector: SectorData;
  sectorIndex: number;
  updateSector: (index: number, updates: Partial<SectorData>) => void;
  config: CatalogueConfig | null;
  operator?: string;
  nombreSecteurs?: number;
  /** Only render the per-sector FH block (used for sectors whose antennas mirror Secteur 1). */
  onlyFh?: boolean;
}

export function SectorEquipmentGrid({
  sector,
  sectorIndex,
  updateSector,
  config,
  operator = 'bouygues',
  nombreSecteurs = 1,
  onlyFh = false
}: SectorEquipmentGridProps) {
  const syncUpdates = (updates: Partial<SectorData>) => {
    updateSector(sectorIndex, updates);
  };

  const isRrhDisabled = !!sector.hasRruEquipment;
  const isRruDisabled = !!sector.hasRrhEquipment;

  if (onlyFh && operator === 'orange') {
    return null;
  }

  return (
    <div className={onlyFh ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
      {/* 1. FH (Hidden for Orange) */}
      {operator !== 'orange' && (
      <FHEquipmentToggle
        hasFhEquipment={!!sector.hasFhEquipment}
        setHasFhEquipment={(val) => {
          syncUpdates({ hasFhEquipment: val });
        }}
        fhItems={sector.fhItems || []}
        setFhItems={(val) => {
          const newItems = typeof val === 'function' ? val(sector.fhItems || []) : val;
          syncUpdates({ fhItems: newItems });
        }}
        fhDiameter={sector.fhDiameter}
        setFhDiameter={(val) => syncUpdates({ fhDiameter: val })}
        fhReference={sector.fhReference || ''}
        setFhReference={(val) => syncUpdates({ fhReference: val })}
        fhQuantity={sector.fhQuantity || 1}
        setFhQuantity={(val) => syncUpdates({ fhQuantity: val })}
        fhWeight={sector.fhWeight}
        setFhWeight={(val) => syncUpdates({ fhWeight: val })}
        fhOptions={config?.fh_references || []}
        operator={operator}
        nombreSecteurs={nombreSecteurs}
        foundationType={sector.fhFoundationType || sector.equipmentFoundationType || 'dallettes'}
        setFoundationType={(val) => syncUpdates({ fhFoundationType: val, equipmentFoundationType: val })}
        fhEchelle={sector.fhEchelle}
        setFhEchelle={(val) => syncUpdates({ fhEchelle: val })}
        hauteurMatM={sector.fhHauteurMatM ?? 1.70}
        setHauteurMatM={(val) => syncUpdates({ fhHauteurMatM: val })}
      />
      )}

      {!onlyFh && <>
      {/* 2. RRH (Non-Bouygues) */}
      {operator !== 'bouygues' && (
        <RRHEquipmentToggle
          hasRrhEquipment={!!sector.hasRrhEquipment}
          setHasRrhEquipment={(val) => {
            if (val) {
              syncUpdates({ hasRrhEquipment: true, hasRruEquipment: false });
            } else {
              syncUpdates({ hasRrhEquipment: false });
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
          disabledReason={isRrhDisabled ? 'RRH et RRU ne peuvent pas coexister sur le même site' : undefined}
          foundationType={sector.rrhFoundationType || sector.equipmentFoundationType || 'dallettes'}
          setFoundationType={(val) => syncUpdates({ rrhFoundationType: val, equipmentFoundationType: val })}
          hauteurMatM={sector.rrhHauteurMatM ?? 1.50}
          setHauteurMatM={(val) => syncUpdates({ rrhHauteurMatM: val })}
        />
      )}

      {/* 3. RRU */}
      <RRUEquipmentToggle
        hasRruEquipment={!!sector.hasRruEquipment}
        setHasRruEquipment={(val) => {
          if (val) {
            syncUpdates({ hasRruEquipment: true, hasRrhEquipment: false });
          } else {
            syncUpdates({ hasRruEquipment: false });
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
        disabledReason={isRruDisabled ? 'RRH et RRU ne peuvent pas coexister sur le même site' : undefined}
        foundationType={sector.rruFoundationType || sector.equipmentFoundationType || 'dallettes'}
        setFoundationType={(val) => syncUpdates({ rruFoundationType: val, equipmentFoundationType: val })}
        hauteurMatM={sector.rruHauteurMatM ?? 1.50}
        setHauteurMatM={(val) => syncUpdates({ rruHauteurMatM: val })}
      />

      {/* 4. Boîtier de jonction FO (Free) ou Coffrets fibre (hors Free) */}
      {operator === 'free' ? (
        <BoitierJonctionEquipmentToggle
          hasBoitierJonction={!!sector.hasBoitierJonction}
          setHasBoitierJonction={(val) => syncUpdates({ hasBoitierJonction: val })}
          boitierJonctionQuantity={sector.boitierJonctionQuantity || 1}
          setBoitierJonctionQuantity={(val) => syncUpdates({ boitierJonctionQuantity: val })}
          foundationType={sector.boitierJonctionFoundationType || sector.equipmentFoundationType || 'dallettes'}
          setFoundationType={(val) => syncUpdates({ boitierJonctionFoundationType: val, equipmentFoundationType: val })}
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
          foundationType={sector.coffretFoundationType || sector.equipmentFoundationType || 'dallettes'}
          setFoundationType={(val) => syncUpdates({ coffretFoundationType: val, equipmentFoundationType: val })}
        />
      )}
      </>}
    </div>
  );
}

export default SectorEquipmentGrid;
