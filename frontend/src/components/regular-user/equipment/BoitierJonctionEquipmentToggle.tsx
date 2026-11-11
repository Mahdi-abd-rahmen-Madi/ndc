import React from 'react';
import { Box } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { QuantityInput } from '../../ui/QuantityInput';

export interface BoitierJonctionEquipmentToggleProps {
  hasBoitierJonction: boolean;
  setHasBoitierJonction: (val: boolean) => void;
  boitierJonctionQuantity?: number;
  setBoitierJonctionQuantity?: (val: number) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export function BoitierJonctionEquipmentToggle({
  hasBoitierJonction,
  setHasBoitierJonction,
  boitierJonctionQuantity = 1,
  setBoitierJonctionQuantity,
  disabled = false,
  disabledReason
}: BoitierJonctionEquipmentToggleProps) {
  return (
    <EquipmentToggleCard
      title="Présence Boitier de jonction FO"
      enabled={hasBoitierJonction}
      onToggle={setHasBoitierJonction}
      disabled={disabled}
      disabledReason={disabledReason}
      icon={Box}
      color="violet"
      scopeBadgeText="Par secteur"
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col min-w-0">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
              Marque
            </label>
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
              Aginode
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
              Dimensions
            </label>
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
              427 × 380 × 127 mm
            </div>
          </div>
        </div>

        {setBoitierJonctionQuantity && (
          <div>
            <QuantityInput
              value={boitierJonctionQuantity || 1}
              onChange={setBoitierJonctionQuantity}
              label="Qté :"
              size="md"
            />
          </div>
        )}
      </div>
    </EquipmentToggleCard>
  );
}

export default BoitierJonctionEquipmentToggle;

