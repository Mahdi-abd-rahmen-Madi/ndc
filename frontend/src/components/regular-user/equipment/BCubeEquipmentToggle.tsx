import React, { useEffect } from 'react';
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
    name: 'AE ELTEK 9KW',
    reference: 'AE ELTEK 9KW',
    operator: 'bouygues',
    supplier: 'ACTIA'
  },
  {
    id: 'bcube_actia_ae_huawei_15kw',
    name: 'AE HUAWEI  15KW',
    reference: 'AE HUAWEI  15KW',
    operator: 'bouygues',
    supplier: 'ACTIA'
  },
  {
    id: 'bcube_actia_ae_huawei_9kw_15kw',
    name: 'AE HUAWEI 9KW / 15KW',
    reference: 'AE HUAWEI 9KW / 15KW',
    operator: 'bouygues',
    supplier: 'ACTIA'
  }
];

const VALID_CANONICAL_NAMES = new Set([
  'AE ELTEK 9KW',
  'AE HUAWEI 15KW',
  'AE HUAWEI  15KW',
  'AE HUAWEI 9KW / 15KW',
  'AE HUAWEI 9KW/15KW'
]);

export function BCubeEquipmentToggle({
  hasAtelierEnergie,
  setHasAtelierEnergie,
  bcubeReference,
  setBcubeReference,
  options = []
}: BCubeEquipmentToggleProps) {
  // Filter options strictly to the 3 allowed options, discarding any legacy/obsolete references
  const matchedOptions = options.filter(o => {
    const norm = (o.name || o.reference || '').toUpperCase().trim();
    return VALID_CANONICAL_NAMES.has(norm);
  });

  const availableOptions = matchedOptions.length > 0 ? matchedOptions : ALLOWED_BCUBE_OPTIONS;

  // Detect if current reference is invalid, empty, or from obsolete catalogue
  const isValidRef = availableOptions.some(
    o => o.id === bcubeReference || o.name === bcubeReference || o.reference === bcubeReference
  );

  useEffect(() => {
    if (hasAtelierEnergie && (!bcubeReference || !isValidRef) && availableOptions.length > 0) {
      setBcubeReference(availableOptions[0].id);
    }
  }, [hasAtelierEnergie, bcubeReference, isValidRef, availableOptions, setBcubeReference]);

  const selectedValue = isValidRef ? bcubeReference : availableOptions[0]?.id;

  return (
    <EquipmentToggleCard
      title="B-cube énergie ACTIA"
      enabled={hasAtelierEnergie}
      onToggle={(checked: boolean) => {
        setHasAtelierEnergie(checked);
        if (checked && (!bcubeReference || !isValidRef) && availableOptions.length > 0) {
          setBcubeReference(availableOptions[0].id);
        }
      }}
      icon={Zap}
      scopeBadgeText="Bouygues"
      color="violet"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
            Modèle B-cube énergie ACTIA
          </label>
          <CustomSelect
            value={selectedValue}
            onChange={(val) => setBcubeReference(val)}
            className="focus:ring-2 focus:ring-violet-500"
            options={availableOptions.map(opt => ({
              value: opt.id,
              label: opt.name || opt.reference || opt.id
            }))}
            placeholder="Sélectionner un modèle"
          />
        </div>
      </div>
    </EquipmentToggleCard>
  );
}

export default BCubeEquipmentToggle;
