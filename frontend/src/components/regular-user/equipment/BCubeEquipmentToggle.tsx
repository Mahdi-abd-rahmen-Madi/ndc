import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';
import { VendorTabSelector } from '../../ui/VendorTabSelector';
import { EquipmentSpecsGrid } from '../../ui/EquipmentSpecsGrid';

export interface BCubeEquipmentToggleProps {
  hasAtelierEnergie: boolean;
  setHasAtelierEnergie: (val: boolean) => void;
  bcubeReference: string;
  setBcubeReference: (val: string) => void;
  options?: {
    id: string;
    vendor?: string;
    supplier?: string;
    name: string;
    reference: string;
    power?: string;
    phase?: string;
    dimensions?: string;
    weight?: number;
    height?: number;
    width?: number;
    thickness?: number;
    operator?: string;
  }[];
}

export function BCubeEquipmentToggle({
  hasAtelierEnergie,
  setHasAtelierEnergie,
  bcubeReference,
  setBcubeReference,
  options = []
}: BCubeEquipmentToggleProps) {
  const bouyguesOptions = options.filter(o => !o.operator || o.operator.toLowerCase() === 'bouygues');

  const availableVendors = Array.from(new Set(bouyguesOptions.map(o => o.vendor || 'ELTEK')));
  const [selectedVendor, setSelectedVendor] = useState<string>(() => {
    const current = bouyguesOptions.find(o => o.id === bcubeReference);
    return current?.vendor || availableVendors[0] || 'ELTEK';
  });

  const vendorOptions = bouyguesOptions.filter(o => (o.vendor || 'ELTEK') === selectedVendor);

  React.useEffect(() => {
    if (hasAtelierEnergie && !bcubeReference && vendorOptions.length > 0) {
      setBcubeReference(vendorOptions[0].id);
    }
  }, [hasAtelierEnergie, bcubeReference, vendorOptions, setBcubeReference]);

  const selectedItem = bouyguesOptions.find(o => o.id === bcubeReference);

  return (
    <EquipmentToggleCard
      title="BCube"
      enabled={hasAtelierEnergie}
      onToggle={(checked: boolean) => {
        setHasAtelierEnergie(checked);
        if (checked && !bcubeReference && vendorOptions.length > 0) {
          setBcubeReference(vendorOptions[0].id);
        }
      }}
      icon={Zap}
      scopeBadgeText="Bouygues"
      color="violet"
    >
      <div className="flex flex-col gap-3">
        <VendorTabSelector
          vendors={availableVendors}
          selectedVendor={selectedVendor}
          onSelectVendor={(vendor) => {
            setSelectedVendor(vendor);
            const firstInVendor = bouyguesOptions.find(o => (o.vendor || 'ELTEK') === vendor);
            if (firstInVendor) {
              setBcubeReference(firstInVendor.id);
            }
          }}
          color="violet"
        />

        <div className="flex flex-col">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
            Modèle BCube
          </label>
          <CustomSelect
            value={bcubeReference}
            onChange={(val) => setBcubeReference(val)}
            className="focus:ring-2 focus:ring-violet-500"
            options={vendorOptions.map(opt => ({
              value: opt.id,
              label: `${opt.supplier ? `FNRS : ${opt.supplier} - ` : ''}${opt.name}`
            }))}
            placeholder="Sélectionner un modèle BCube"
          />
        </div>

        {selectedItem && (
          <EquipmentSpecsGrid
            items={[
              { label: 'Fournisseur', value: selectedItem.supplier || 'N/A' },
              { label: 'Puissance / Phase', value: [selectedItem.power, selectedItem.phase].filter(Boolean).join(' ') || 'N/A' }
            ]}
          />
        )}
      </div>
    </EquipmentToggleCard>
  );
}

export default BCubeEquipmentToggle;
