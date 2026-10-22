import React from 'react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';
import { QuantityInput } from '../../ui/QuantityInput';

export interface FHEquipmentToggleProps {
  hasFhEquipment: boolean;
  setHasFhEquipment: (val: boolean) => void;
  fhDiameter: number;
  setFhDiameter: (val: number) => void;
  fhReference: string;
  setFhReference: (val: string) => void;
  fhQuantity: number;
  setFhQuantity: (val: number) => void;
  fhOptions?: { id: string; vendor: string; name: string; diameter: number; weight: number }[];
  nombreSecteurs?: number;
}

export function FHEquipmentToggle({
  hasFhEquipment,
  setHasFhEquipment,
  setFhDiameter,
  fhReference,
  setFhReference,
  fhQuantity,
  setFhQuantity,
  fhOptions = [],
}: FHEquipmentToggleProps) {
  const selectedRef = fhOptions.find(r => r.id === fhReference);
  const vendors = Array.from(new Set(fhOptions.map(o => o.vendor)));
  const [selectedVendor, setSelectedVendor] = React.useState(selectedRef?.vendor || '');

  React.useEffect(() => {
    if (selectedRef && selectedRef.vendor !== selectedVendor) {
      setSelectedVendor(selectedRef.vendor);
    }
  }, [selectedRef]);

  const handleVendorChange = (vendor: string) => {
    setSelectedVendor(vendor);
    setFhReference('');
    setFhDiameter(0);
  };

  const isFhIncomplete = hasFhEquipment && (!selectedVendor || !fhReference);

  return (
    <EquipmentToggleCard
      title="Présence FH"
      enabled={hasFhEquipment}
      onToggle={setHasFhEquipment}
      color="violet"
      scopeBadgeText="1x par site"
      isIncomplete={isFhIncomplete}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-semibold flex items-center gap-1">
            Marque
            {!selectedVendor && <span className="text-amber-600 font-bold">*</span>}
          </label>
          <CustomSelect
            value={selectedVendor}
            onChange={handleVendorChange}
            className="focus:ring-2 focus:ring-violet-500"
            options={vendors.map(v => ({ value: v, label: v }))}
            placeholder="Sélectionner..."
            error={!selectedVendor}
          />
        </div>

        <div className="flex flex-col min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-semibold flex items-center gap-1">
            Modèle
            {!fhReference && <span className="text-amber-600 font-bold">*</span>}
          </label>
          <CustomSelect
            value={fhReference}
            onChange={(val) => {
              setFhReference(val);
              const ref = fhOptions.find(r => r.id === val);
              if (ref) {
                setFhDiameter(ref.diameter);
              }
            }}
            disabled={!selectedVendor}
            className="focus:ring-2 focus:ring-violet-500"
            options={fhOptions.filter(o => o.vendor === selectedVendor).map(ref => ({ value: ref.id, label: ref.name }))}
            placeholder="Sélectionner..."
            error={!fhReference}
          />
        </div>
      </div>

      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-1">
        <QuantityInput
          value={fhQuantity || 1}
          onChange={setFhQuantity}
          label="Qté :"
        />
      </div>
    </EquipmentToggleCard>
  );
}

export default FHEquipmentToggle;
