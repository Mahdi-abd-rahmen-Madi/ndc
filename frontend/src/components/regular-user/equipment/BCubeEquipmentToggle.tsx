import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';

export interface BCubeItem {
  id: string;
  name: string;
  reference?: string;
  supplier?: string;
  operator?: string;
}

export interface BCubeEquipmentToggleProps {
  hasAtelierEnergie: boolean;
  setHasAtelierEnergie: (val: boolean) => void;
  bcubeReference: string;
  setBcubeReference: (val: string) => void;
  options?: BCubeItem[];
}

export const ALLOWED_BCUBE_OPTIONS: BCubeItem[] = [
  {
    id: 'bcube_actia_ae_eltek_9kw',
    name: 'AE ELTEK 9kw',
    reference: 'AE ELTEK 9kw',
    operator: 'bouygues',
    supplier: 'ACTIA'
  },
  {
    id: 'bcube_actia_ae_huawei_15kw',
    name: 'AE HUAWEI 15kw',
    reference: 'AE HUAWEI 15kw',
    operator: 'bouygues',
    supplier: 'ACTIA'
  },
  {
    id: 'bcube_tlti_ae_huawei_9kw',
    name: 'AE HUAWEI 9kw',
    reference: 'AE HUAWEI 9kw',
    operator: 'bouygues',
    supplier: 'TLTI'
  },
  {
    id: 'bcube_tlti_ae_huawei_15kw',
    name: 'AE HUAWEI 15kw',
    reference: 'AE HUAWEI 15kw',
    operator: 'bouygues',
    supplier: 'TLTI'
  }
];

export function BCubeEquipmentToggle({
  hasAtelierEnergie,
  setHasAtelierEnergie,
  bcubeReference,
  setBcubeReference,
  options = []
}: BCubeEquipmentToggleProps) {
  // Use options from config if valid/complete, otherwise fallback to ALLOWED_BCUBE_OPTIONS
  const bouyguesOptions = options.filter(o => o.operator === 'bouygues' && (o.supplier === 'ACTIA' || o.supplier === 'TLTI'));
  const allBcubeOptions = bouyguesOptions.length >= 4 ? bouyguesOptions : ALLOWED_BCUBE_OPTIONS;

  // Determine current marque based on current selected reference
  const currentItem = allBcubeOptions.find(
    o => o.id === bcubeReference || o.name === bcubeReference || o.reference === bcubeReference
  );

  const [selectedMarque, setSelectedMarque] = useState<string>(() => {
    return currentItem?.supplier || 'ACTIA';
  });

  // Keep selectedMarque in sync if bcubeReference changes externally
  useEffect(() => {
    if (currentItem?.supplier && currentItem.supplier !== selectedMarque) {
      setSelectedMarque(currentItem.supplier);
    }
  }, [currentItem, selectedMarque]);

  // Filter options by selected marque
  const filteredOptions = allBcubeOptions.filter(
    o => (o.supplier || '').toUpperCase() === selectedMarque.toUpperCase()
  );

  // Check if current reference is valid for the current marque
  const isValidRef = filteredOptions.some(
    o => o.id === bcubeReference || o.name === bcubeReference || o.reference === bcubeReference
  );

  useEffect(() => {
    if (hasAtelierEnergie && (!bcubeReference || !isValidRef) && filteredOptions.length > 0) {
      setBcubeReference(filteredOptions[0].id);
    }
  }, [hasAtelierEnergie, bcubeReference, isValidRef, filteredOptions, setBcubeReference]);

  const selectedValue = isValidRef ? bcubeReference : (filteredOptions[0]?.id || '');

  const handleMarqueChange = (newMarque: string) => {
    setSelectedMarque(newMarque);
    const newOptions = allBcubeOptions.filter(
      o => (o.supplier || '').toUpperCase() === newMarque.toUpperCase()
    );
    if (newOptions.length > 0) {
      setBcubeReference(newOptions[0].id);
    }
  };

  return (
    <EquipmentToggleCard
      title="B-cube énergie"
      enabled={hasAtelierEnergie}
      onToggle={(checked: boolean) => {
        setHasAtelierEnergie(checked);
        if (checked && (!bcubeReference || !isValidRef) && filteredOptions.length > 0) {
          setBcubeReference(filteredOptions[0].id);
        }
      }}
      icon={Zap}
      color="violet"
    >
      <div className="flex gap-3">
        <div className="flex flex-col flex-1 min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
            Marque
          </label>
          <CustomSelect
            value={selectedMarque}
            onChange={handleMarqueChange}
            className="focus:ring-2 focus:ring-violet-500"
            options={[
              { value: 'ACTIA', label: 'ACTIA' },
              { value: 'TLTI', label: 'TLTI' }
            ]}
            placeholder="Sélectionner la marque"
          />
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
            Modèle / Référence
          </label>
          <CustomSelect
            value={selectedValue}
            onChange={(val) => setBcubeReference(val)}
            className="focus:ring-2 focus:ring-violet-500"
            options={filteredOptions.map(opt => ({
              value: opt.id,
              label: opt.name || opt.reference || opt.id
            }))}
            placeholder="Sélectionner une référence"
          />
        </div>
      </div>
    </EquipmentToggleCard>
  );
}

export default BCubeEquipmentToggle;
