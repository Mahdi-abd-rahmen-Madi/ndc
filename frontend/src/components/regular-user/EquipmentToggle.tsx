import { Radio, Activity, ChevronUp, ChevronDown, Plus, Minus, Check, Trash2, Server, Zap, AlertCircle, Box, Layers } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { QuantityInput } from '../ui/QuantityInput';
import { EquipmentToggleCard } from '../ui/EquipmentToggleCard';
import { VendorTabSelector } from '../ui/VendorTabSelector';
import { EquipmentOptionCard } from '../ui/EquipmentOptionCard';
import React, { useEffect, useState } from 'react';
import type { EquipmentItem } from '../RegularUserView';
import type { BaieReference, SelectedBaieItem } from './types';


interface FHEquipmentToggleProps {
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
  nombreSecteurs = 1
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
      {/* Marque & Modèle */}
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

            {/* Paramètres FH */}
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

export { FHEquipmentToggle as EquipmentToggle };
export default FHEquipmentToggle;

export interface RRHEquipmentToggleProps {
  hasRrhEquipment: boolean;
  setHasRrhEquipment: (val: boolean) => void;
  rrhItems: EquipmentItem[];
  setRrhItems: (val: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => void;
  rrhOptions: { id: string; vendor: string; reference: string; operator?: string }[];
  operator?: string;
  nombreSecteurs?: number;
}

export function RRHEquipmentToggle({
  hasRrhEquipment,
  setHasRrhEquipment,
  rrhItems,
  setRrhItems,
  rrhOptions,
  operator = 'free',
  nombreSecteurs = 1
}: RRHEquipmentToggleProps) {
  const filteredRrhOptions = rrhOptions.filter(o =>
    o.operator ? o.operator.toLowerCase() === operator.toLowerCase() : false
  );
  const uniqueVendors = Array.from(new Set(filteredRrhOptions.map(o => o.vendor)));

  const addRrhRow = () => {
    setRrhItems(prev => [...prev, {
      id: crypto.randomUUID(),
      reference: '',
      quantity: 1,
      vendor: uniqueVendors.length === 1 ? uniqueVendors[0] : undefined
    }]);
  };

  useEffect(() => {
    setRrhItems(prev => prev.map(item => {
      let updated = { ...item };
      if (uniqueVendors.length === 1 && updated.vendor !== uniqueVendors[0]) {
        updated.vendor = uniqueVendors[0];
        updated.reference = '';
      } else if (updated.vendor && !uniqueVendors.includes(updated.vendor)) {
        updated.vendor = uniqueVendors.length === 1 ? uniqueVendors[0] : undefined;
        updated.reference = '';
      }
      if (updated.reference) {
        const exists = filteredRrhOptions.some(o => o.id === updated.reference && (!updated.vendor || o.vendor === updated.vendor));
        if (!exists) {
          updated.reference = '';
        }
      }
      return updated;
    }));
  }, [operator, filteredRrhOptions, uniqueVendors, setRrhItems]);

  const removeRrhRow = (id: string) => {
    if (rrhItems.length > 1) {
      setRrhItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateRrhItem = (id: string, field: 'reference' | 'quantity' | 'vendor', value: any) => {
    setRrhItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 'vendor') {
          return { ...item, vendor: value, reference: '' }; // reset reference when vendor changes
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const isRrhIncomplete = hasRrhEquipment && (rrhItems.length === 0 || rrhItems.some(i => !i.vendor || !i.reference));

  return (
    <EquipmentToggleCard
      title="Présence RRH"
      enabled={hasRrhEquipment}
      onToggle={setHasRrhEquipment}
      color="violet"
      scopeBadgeText="Par secteur"
      isIncomplete={isRrhIncomplete}
    >
            {rrhItems.map((item) => (
              <div key={item.id} className={`flex flex-col gap-3 p-3 rounded-lg border transition-all ${(!item.vendor || !item.reference)
                ? 'bg-amber-50/20 border-amber-200'
                : 'bg-slate-50 border-slate-200'
                }`}>
                <div className="flex gap-3">
                  {/* Marque */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                      Marque
                      {!item.vendor && <span className="text-amber-600 font-bold">*</span>}
                    </label>
                    <CustomSelect
                      value={item.vendor || ''}
                      onChange={(val) => updateRrhItem(item.id, 'vendor', val)}
                      className="focus:ring-2 focus:ring-rose-500"
                      options={uniqueVendors.map(vendor => ({ value: vendor, label: vendor }))}
                      placeholder="Sélectionner"
                      error={!item.vendor}
                    />
                  </div>

                  {/* Modèle */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                      Modèle
                      {!item.reference && <span className="text-amber-600 font-bold">*</span>}
                    </label>
                    <CustomSelect
                      value={item.reference}
                      onChange={(val) => updateRrhItem(item.id, 'reference', val)}
                      disabled={!item.vendor}
                      className="focus:ring-2 focus:ring-rose-500"
                      options={filteredRrhOptions.filter(o => o.vendor === item.vendor).map(opt => {
                        const isSelectedElsewhere = rrhItems.some(otherItem => otherItem.id !== item.id && otherItem.reference === opt.id);
                        return { value: opt.id, label: opt.reference + (isSelectedElsewhere ? ' (Déjà utilisé)' : ''), disabled: isSelectedElsewhere };
                      })}
                      placeholder="Sélectionner"
                      error={!item.reference}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  {/* Quantité */}
                  <QuantityInput
                    value={item.quantity || 1}
                    onChange={(val) => updateRrhItem(item.id, 'quantity', val)}
                    unitLabel="/ secteur"
                    nombreSecteurs={nombreSecteurs}
                  />

                  {/* Actions */}
                  <button
                    type="button"
                    onClick={() => removeRrhRow(item.id)}
                    disabled={rrhItems.length === 1}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addRrhRow}
              className="flex items-center gap-2 self-start px-3 py-1.5 mt-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter
            </button>
    </EquipmentToggleCard>
  );
}

export interface RRUEquipmentToggleProps {
  hasRruEquipment: boolean;
  setHasRruEquipment: (val: boolean) => void;
  rruItems: EquipmentItem[];
  setRruItems: (val: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => void;
  rruOptions: { id: string; vendor: string; reference: string; operator?: string; dimensions?: string; weight?: number }[];
  isRfmMode?: boolean;
  operator?: string;
  nombreSecteurs?: number;
}

export function RRUEquipmentToggle({
  hasRruEquipment,
  setHasRruEquipment,
  rruItems,
  setRruItems,
  rruOptions,
  isRfmMode = false,
  operator = 'bouygues',
  nombreSecteurs = 1
}: RRUEquipmentToggleProps) {
  const rfmModels: { id: string; vendor: string; reference: string; operator?: string; dimensions?: string; weight?: number }[] = [
    { id: 'ARGA', vendor: 'NOKIA', reference: 'ARGA' },
    { id: 'ARDB', vendor: 'NOKIA', reference: 'ARDB' },
    { id: 'ARHA', vendor: 'NOKIA', reference: 'ARHA' },
    { id: 'AREA', vendor: 'NOKIA', reference: 'AREA' },
    { id: 'ARPA', vendor: 'NOKIA', reference: 'ARPA' },
  ];

  const filteredRruOptions = rruOptions.filter(o =>
    o.operator ? o.operator.toLowerCase() === operator.toLowerCase() : (operator.toLowerCase() === 'bouygues')
  );
  const actualOptions = isRfmMode ? rfmModels : filteredRruOptions;
  const uniqueVendors = Array.from(new Set(actualOptions.map(o => o.vendor)));

  const addRruRow = () => {
    setRruItems(prev => [...prev, {
      id: crypto.randomUUID(),
      reference: '',
      quantity: 1,
      vendor: uniqueVendors.length === 1 ? uniqueVendors[0] : undefined
    }]);
  };

  useEffect(() => {
    setRruItems(prev => prev.map(item => {
      let updated = { ...item };
      // If only 1 vendor available for this operator, auto-select it
      if (uniqueVendors.length === 1 && updated.vendor !== uniqueVendors[0]) {
        updated.vendor = uniqueVendors[0];
        updated.reference = '';
      } else if (updated.vendor && !uniqueVendors.includes(updated.vendor)) {
        updated.vendor = uniqueVendors.length === 1 ? uniqueVendors[0] : undefined;
        updated.reference = '';
      }
      // If reference does not belong to vendor, reset reference
      if (updated.reference) {
        const exists = actualOptions.some(o => o.id === updated.reference && (!updated.vendor || o.vendor === updated.vendor));
        if (!exists) {
          updated.reference = '';
        }
      }
      return updated;
    }));
  }, [operator, actualOptions, uniqueVendors, setRruItems]);

  const removeRruRow = (id: string) => {
    if (rruItems.length > 1) {
      setRruItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateRruItem = (id: string, field: 'reference' | 'quantity' | 'vendor', value: any) => {
    setRruItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 'vendor') {
          return { ...item, vendor: value, reference: '' }; // reset reference when vendor changes
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };
  const isRruIncomplete = hasRruEquipment && (rruItems.length === 0 || rruItems.some(i => !i.vendor || !i.reference));

  return (
    <EquipmentToggleCard
      title={`Présence ${isRfmMode ? 'Module RF NSN' : 'RRU'}`}
      enabled={hasRruEquipment}
      onToggle={setHasRruEquipment}
      color="violet"
      scopeBadgeText="Par secteur"
      isIncomplete={isRruIncomplete}
    >
      {rruItems.map((item) => (
              <div key={item.id} className={`flex flex-col gap-3 p-3 rounded-lg border transition-all ${(!item.vendor || !item.reference)
                ? 'bg-amber-50/20 border-amber-200'
                : 'bg-slate-50 border-slate-200'
                }`}>
                <div className="flex gap-3">
                  {/* Marque */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                      Marque
                      {!item.vendor && <span className="text-amber-600 font-bold">*</span>}
                    </label>
                    <CustomSelect
                      value={item.vendor || ''}
                      onChange={(val) => updateRruItem(item.id, 'vendor', val)}
                      className="focus:ring-2 focus:ring-emerald-500"
                      options={uniqueVendors.map(vendor => ({ value: vendor, label: vendor }))}
                      placeholder="Sélectionner"
                      error={!item.vendor}
                    />
                  </div>

                  {/* Modèle */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                      Modèle
                      {!item.reference && <span className="text-amber-600 font-bold">*</span>}
                    </label>
                    <CustomSelect
                      value={item.reference}
                      onChange={(val) => updateRruItem(item.id, 'reference', val)}
                      disabled={!item.vendor}
                      className="focus:ring-2 focus:ring-emerald-500"
                      options={actualOptions.filter(o => o.vendor === item.vendor).map(opt => {
                        const isSelectedElsewhere = rruItems.some(otherItem => otherItem.id !== item.id && otherItem.reference === opt.id);
                        return { value: opt.id, label: opt.reference + (isSelectedElsewhere ? ' (Déjà utilisé)' : ''), disabled: isSelectedElsewhere };
                      })}
                      placeholder="Sélectionner"
                      error={!item.reference}
                    />
                  </div>
                </div>



                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  {/* Quantité */}
                  <QuantityInput
                    value={item.quantity || 1}
                    onChange={(val) => updateRruItem(item.id, 'quantity', val)}
                    unitLabel="/ secteur"
                    nombreSecteurs={nombreSecteurs}
                  />

                  {/* Actions */}
                  <button
                    type="button"
                    onClick={() => removeRruRow(item.id)}
                    disabled={rruItems.length === 1}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addRruRow}
              className="flex items-center gap-2 self-start px-3 py-1.5 mt-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter
            </button>
    </EquipmentToggleCard>
  );
}

export interface TDEquipmentToggleProps {
  hasTdEquipment: boolean;
  setHasTdEquipment: (val: boolean) => void;
  tdType: 'tetraphase' | 'monophase';
  setTdType: (val: 'tetraphase' | 'monophase') => void;
  tdReference: string;
  setTdReference: (val: string) => void;
  tgbtReference: string;
  setTgbtReference: (val: string) => void;
  tdOptions: { id: string; vendor: string; name: string; reference: string; weight: number; dimensions: string }[];
  operator?: string;
}

export function TDEquipmentToggle({
  hasTdEquipment,
  setHasTdEquipment,
  tdType,
  setTdType,
  tdReference,
  setTdReference,
  tgbtReference,
  setTgbtReference,
  tdOptions,
  operator = 'bouygues'
}: TDEquipmentToggleProps) {
  const isBouygues = operator.toLowerCase() === 'bouygues';

  React.useEffect(() => {
    if (hasTdEquipment) {
      const validOptions = tdOptions.filter(o =>
        tdType === 'tetraphase' ? o.reference === '68237' : o.reference === '68236'
      );
      if (!validOptions.some(o => o.id === tdReference)) {
        if (validOptions.length > 0) {
          setTdReference(validOptions[0].id);
        }
      }
      if (isBouygues && !tgbtReference) {
        setTgbtReference('TGBT ACTIA');
      }
    }
  }, [hasTdEquipment, tdType, tdOptions, tdReference, setTdReference, isBouygues, tgbtReference, setTgbtReference]);

  const filteredTdOptions = tdOptions.filter(opt => {
    if (tdType === 'tetraphase') return opt.reference === '68237';
    if (tdType === 'monophase') return opt.reference === '68236';
    return true;
  });

  return (
    <EquipmentToggleCard
      title="Présence TD"
      enabled={hasTdEquipment}
      onToggle={setHasTdEquipment}
      icon={Activity}
      color="violet"
      scopeBadgeText="1x par site"
    >
      {/* TD Type */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
          <input
            type="radio"
            checked={tdType === 'tetraphase'}
            onChange={() => setTdType('tetraphase')}
            className="text-violet-600 focus:ring-violet-500"
          />
          TD Tétraphasé
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
          <input
            type="radio"
            checked={tdType === 'monophase'}
            onChange={() => setTdType('monophase')}
            className="text-violet-600 focus:ring-violet-500"
          />
          TD Monophasé + TGBT
        </label>
      </div>

      {/* References */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col w-full md:w-1/2 min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Équipement</label>
          <CustomSelect
            value={tdReference}
            onChange={(val) => setTdReference(val)}
            className="focus:ring-2 focus:ring-violet-500"
            options={filteredTdOptions.map(opt => ({
              value: opt.id,
              label: opt.vendor ? `${opt.vendor} - ${opt.name}` : opt.name
            }))}
            placeholder="Sélectionner un équipement"
          />
        </div>

        {tdType === 'monophase' && (
          <div className="flex flex-col flex-1 mt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">TGBT</label>
              {isBouygues && (
                <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                  Bouygues
                </span>
              )}
            </div>

            {isBouygues && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 block">Modèle TGBT</label>
                  <CustomSelect
                    value={tgbtReference || 'TGBT ACTIA'}
                    onChange={(val) => setTgbtReference(val)}
                    className="focus:ring-2 focus:ring-violet-500"
                    options={[
                      { value: 'TGBT ACTIA', label: 'TGBT ACTIA' },
                      { value: 'TGBT TLTI', label: 'TGBT TLTI' }
                    ]}
                    placeholder="Sélectionner un TGBT"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </EquipmentToggleCard>
  );
}

export interface GenericEquipmentToggleProps {
  title: string;
  enabled: boolean;
  setEnabled: (val: boolean) => void;
  quantity?: number;
  setQuantity?: (val: number) => void;
  reference: string;
  setReference: (val: string) => void;
  colorClass?: string;
  icon?: React.ElementType;
}

export function GenericEquipmentToggle({
  title,
  enabled,
  setEnabled,
  quantity,
  setQuantity,
  reference,
  setReference,
  colorClass = 'violet',
  icon: Icon = Activity
}: GenericEquipmentToggleProps) {
  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${enabled ? 'border-violet-300 ring-1 ring-violet-500/10' : 'border-slate-200 hover:border-violet-200'}`}>
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm font-semibold text-slate-800 flex items-center gap-2 cursor-pointer shrink-0">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-10 h-6 rounded-full transition-colors ${enabled ? 'bg-violet-600' : 'bg-slate-300'}`}></div>
            <div className={`absolute left-1 top-1 bg-white shadow-sm w-4 h-4 rounded-full transition-transform ${enabled ? 'transform translate-x-4' : ''}`}></div>
          </div>
          <Icon className="w-4 h-4 text-violet-600" />
          {title}
        </label>

        {enabled && (
          <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1 justify-end mt-3 md:mt-0">
            {/* Quantité */}
            {quantity !== undefined && setQuantity !== undefined && (
              <QuantityInput
                value={quantity || 1}
                onChange={setQuantity}
                label="Qté :"
                size="md"
              />
            )}

            {/* Référence */}
            <div className="flex flex-col flex-1 md:max-w-[200px]">
              <label className="text-xs font-medium text-slate-500 mb-1">Référence:</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ex: Ref..."
                className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-violet-500 placeholder-slate-400 shadow-sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface BoitierLovageEquipmentToggleProps {
  hasBoitierLovage: boolean;
  setHasBoitierLovage: (val: boolean) => void;
  boitierLovageReference: string;
  setBoitierLovageReference: (val: string) => void;
  boitierLovageQuantity: number;
  setBoitierLovageQuantity: (val: number) => void;
  boitierOptions?: any[];
  operator?: string;
}

export function BoitierLovageEquipmentToggle({
  hasBoitierLovage,
  setHasBoitierLovage,
  boitierLovageReference,
  setBoitierLovageReference,
  boitierLovageQuantity,
  setBoitierLovageQuantity,
  boitierOptions = [],
  operator
}: BoitierLovageEquipmentToggleProps) {

  // Hardcoded option if none provided from backend (exclusive to free)
  const defaultOptions = [
    { id: 'BLM-515709', name: 'Boîte de dérivation OPTIBOX IP55', reference: 'BLM-515709', operator: 'free' }
  ];

  const allOptions = boitierOptions.length > 0 ? boitierOptions : defaultOptions;

  const options = allOptions.filter(opt => {
    if (!opt.operator || opt.operator === 'all') return true;
    if (operator) return opt.operator.toLowerCase() === operator.toLowerCase();
    return true;
  });

  React.useEffect(() => {
    if (options.length === 0) {
      if (hasBoitierLovage) setHasBoitierLovage(false);
      if (boitierLovageReference) setBoitierLovageReference('');
    } else if (hasBoitierLovage && !boitierLovageReference) {
      setBoitierLovageReference(options[0].id);
    }
  }, [hasBoitierLovage, boitierLovageReference, options, setBoitierLovageReference, setHasBoitierLovage]);

  if (options.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${hasBoitierLovage ? 'border-violet-300 ring-1 ring-violet-500/10' : 'border-slate-200 hover:border-violet-200'}`}>
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-semibold text-slate-800 flex items-center gap-2 cursor-pointer shrink-0">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={hasBoitierLovage}
                onChange={(e) => setHasBoitierLovage(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${hasBoitierLovage ? 'bg-violet-600' : 'bg-slate-300'}`}></div>
              <div className={`absolute left-1 top-1 bg-white shadow-sm w-4 h-4 rounded-full transition-transform ${hasBoitierLovage ? 'transform translate-x-4' : ''}`}></div>
            </div>
            <Activity className="w-4 h-4 text-violet-600" />
            Présence Boitiers de lovage
          </label>
        </div>

        {hasBoitierLovage && (
          <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Quantité */}
              <QuantityInput
                value={boitierLovageQuantity}
                onChange={setBoitierLovageQuantity}
                label="Qté :"
                size="md"
              />

              <div className="flex flex-col flex-1 min-w-0">
                <select
                  value={boitierLovageReference}
                  onChange={(e) => setBoitierLovageReference(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 shadow-sm"
                >
                  <option value="" disabled>Sélectionner une référence</option>
                  {options.map((opt, idx) => (
                    <option key={idx} value={opt.id}>{opt.reference}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 block">Hauteur (mm)</label>
                  <input
                    type="text"
                    value="225"
                    disabled
                    className="w-full bg-white border border-slate-200 rounded py-1.5 px-2 text-xs text-slate-800 font-medium cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Largeur (mm)</label>
                  <input
                    type="text"
                    value="175"
                    disabled
                    className="w-full bg-white border border-slate-200 rounded py-1.5 px-2 text-xs text-slate-800 font-medium cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Épaisseur (mm)</label>
                  <input
                    type="text"
                    value="100"
                    disabled
                    className="w-full bg-white border border-slate-200 rounded py-1.5 px-2 text-xs text-slate-800 font-medium cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Poids (Kg)</label>
                  <input
                    type="text"
                    value="0.55"
                    disabled
                    className="w-full bg-white border border-slate-200 rounded py-1.5 px-2 text-xs text-slate-800 font-medium cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface GPSEquipmentToggleProps {
  hasGps: boolean;
  setHasGps: (val: boolean) => void;
  gpsReference: string;
  setGpsReference: (val: string) => void;
  gpsMarque?: string;
  setGpsMarque?: (val: string) => void;
  operator?: string;
}

export function GPSEquipmentToggle({
  hasGps,
  setHasGps,
  gpsReference,
  setGpsReference,
  gpsMarque = 'NOKIA',
  setGpsMarque,
  operator = 'bouygues'
}: GPSEquipmentToggleProps) {
  const isBouygues = operator.toLowerCase() === 'bouygues';

  const marqueOptions = isBouygues
    ? [{ value: 'ERICSSON', label: 'ERICSSON' }, { value: 'NOKIA', label: 'NOKIA' }]
    : [{ value: 'NOKIA', label: 'NOKIA' }];

  React.useEffect(() => {
    if (hasGps) {
      if (!gpsMarque) {
        setGpsMarque?.(isBouygues ? 'ERICSSON' : 'NOKIA');
        setGpsReference(isBouygues ? 'KRE 101 2395/2' : 'FYGC 474074A');
      }
    }
  }, [hasGps, isBouygues, gpsMarque, setGpsMarque, setGpsReference]);

  React.useEffect(() => {
    if (hasGps) {
      if (gpsMarque === 'ERICSSON' && gpsReference !== 'KRE 101 2395/2') {
        setGpsReference('KRE 101 2395/2');
      } else if (gpsMarque === 'NOKIA' && !['FYGC 474074A', 'FYGB 472748A'].includes(gpsReference)) {
        setGpsReference('FYGC 474074A');
      }
    }
  }, [hasGps, gpsMarque, gpsReference, setGpsReference]);

  const modelOptions = gpsMarque === 'ERICSSON'
    ? [{ value: 'KRE 101 2395/2', label: 'KRE 101 2395/2' }]
    : [
      { value: 'FYGC 474074A', label: 'FYGC 474074A' },
      { value: 'FYGB 472748A', label: 'FYGB 472748A' }
    ];

  const isGpsIncomplete = hasGps && (!gpsMarque || !gpsReference);

  return (
    <EquipmentToggleCard
      title="Présence GPS"
      enabled={hasGps}
      onToggle={setHasGps}
      icon={Activity}
      color="blue"
      scopeBadgeText="1x par site"
      isIncomplete={isGpsIncomplete}
    >
      <div className="flex gap-3">
        <div className="flex flex-col flex-1 min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
            Marque
            {!gpsMarque && <span className="text-amber-600 font-bold">*</span>}
          </label>
          <CustomSelect
            value={gpsMarque}
            onChange={(val) => {
              setGpsMarque?.(val);
              if (val === 'ERICSSON') {
                setGpsReference('KRE 101 2395/2');
              } else if (val === 'NOKIA') {
                setGpsReference('FYGC 474074A');
              }
            }}
            className="focus:ring-2 focus:ring-blue-500"
            options={marqueOptions}
            placeholder="Sélectionner"
            error={!gpsMarque}
          />
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
            Modèle
            {!gpsReference && <span className="text-amber-600 font-bold">*</span>}
          </label>
          <CustomSelect
            value={gpsReference}
            onChange={(val) => setGpsReference(val)}
            disabled={!gpsMarque}
            className="focus:ring-2 focus:ring-blue-500"
            options={modelOptions}
            placeholder="Sélectionner"
            error={!gpsReference}
          />
        </div>
      </div>
    </EquipmentToggleCard>
  );
}

export interface CoffretEquipmentToggleProps {
  hasCoffret: boolean;
  setHasCoffret: (val: boolean) => void;
  coffretReference: string;
  setCoffretReference: (val: string) => void;
  coffretOptions: { id: string; name: string; operator?: string }[];
  operator?: string;
  nombreSecteurs?: number;
}

export function CoffretEquipmentToggle({
  hasCoffret,
  setHasCoffret,
  coffretReference,
  setCoffretReference,
  coffretOptions,
  operator,
  nombreSecteurs = 1
}: CoffretEquipmentToggleProps) {
  // Filter coffret options by operator if specified
  const filteredOptions = coffretOptions.filter(opt => {
    if (!opt.operator || opt.operator === 'all') return true;
    if (operator) return opt.operator.toLowerCase() === operator.toLowerCase();
    return true;
  });

  const httaOptions = filteredOptions.filter(opt => opt.name.includes('HTTA'));
  const otherOptions = filteredOptions.filter(opt => !opt.name.includes('HTTA'));
  const isHttaSelected = httaOptions.some(opt => opt.id === coffretReference) || coffretReference === 'HTTA';
  const mainSelectValue = isHttaSelected ? 'HTTA' : coffretReference;

  const isCoffretIncomplete = hasCoffret && (!coffretReference || !mainSelectValue);

  return (
    <EquipmentToggleCard
      title="Présence Coffrets fibre"
      enabled={hasCoffret}
      onToggle={setHasCoffret}
      color="violet"
      scopeBadgeText="Par secteur"
      isIncomplete={isCoffretIncomplete}
    >
      <div className="flex flex-col min-w-0">
        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
          Type
          {!mainSelectValue && <span className="text-amber-600 font-bold">*</span>}
        </label>
        <CustomSelect
          value={mainSelectValue}
          onChange={(val) => {
            if (val === 'HTTA' && httaOptions.length > 0) {
              setCoffretReference(httaOptions[0].id);
            } else {
              setCoffretReference(val);
            }
          }}
          className="focus:ring-2 focus:ring-fuchsia-500"
          options={[
            ...otherOptions.map(ref => ({ value: ref.id, label: ref.name.replace(/\s*\([^)]*\)/g, '').trim() })),
            ...(httaOptions.length > 0 ? [{ value: 'HTTA', label: 'Coffrets HTTA' }] : [])
          ]}
          placeholder="Sélectionner..."
          error={!mainSelectValue}
        />
      </div>

      {isHttaSelected && httaOptions.length > 0 && (
        <div className="flex flex-col min-w-0 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Référence HTTA</label>
          <select
            value={coffretReference === 'HTTA' ? httaOptions[0].id : coffretReference}
            onChange={(e) => setCoffretReference(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 shadow-sm"
          >
            {httaOptions.map(ref => (
              <option key={ref.id} value={ref.id}>
                {ref.id}
              </option>
            ))}
          </select>
        </div>
      )}

      {(() => {
        const actualRef = isHttaSelected && coffretReference === 'HTTA' && httaOptions.length > 0 ? httaOptions[0].id : coffretReference;
        const selectedRef = coffretOptions.find(r => r.id === actualRef);
        if (!selectedRef || isHttaSelected) return null;

        return (
          <div className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Référence</label>
              <input
                type="text"
                value={actualRef}
                disabled
                className="w-full bg-white border border-slate-200 rounded py-1.5 px-2 text-xs text-slate-800 font-medium cursor-not-allowed"
              />
            </div>
          </div>
        );
      })()}
    </EquipmentToggleCard>
  );
}

export const DEFAULT_ORANGE_BAIES: BaieReference[] = [
  // 1. Radio & Trans
  {
    id: 'orange_baie_radio_rb6120_outdoor',
    name: 'Baie radio RB6120 OUTDOOR',
    reference: 'RB6120 OUTDOOR',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '1540x700x700mm',
    height: 1540,
    width: 700,
    depth: 700,
    weight: 380,
    operator: 'orange'
  },
  {
    id: 'orange_baie_radio_rb6140',
    name: 'Baie radio RB6140',
    reference: 'RB6140',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '1650x650x700mm',
    height: 1650,
    width: 650,
    depth: 700,
    weight: 190,
    operator: 'orange'
  },
  {
    id: 'orange_baie_radio_rbs6330',
    name: 'Baie radio RBS6330',
    reference: 'RBS6330',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '650x900x425mm',
    height: 650,
    width: 900,
    depth: 425,
    weight: 50,
    operator: 'orange'
  },
  {
    id: 'orange_baie_tlti_fg2_radio_trans',
    name: 'Baie TLTI FG2 RADIO /TRANS',
    reference: 'FG2 RADIO /TRANS',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '1650x855x750mm',
    height: 1650,
    width: 855,
    depth: 750,
    weight: 93,
    operator: 'orange'
  },
  // 2. Énergie
  {
    id: 'orange_baie_energie_walkyrie_t3_18kw',
    name: 'Baie énergie Outdoor WALKYRIE T3 18kw',
    reference: 'WALKYRIE T3 18kw',
    category: 'energie',
    category_label: 'Énergie',
    dimensions: '1550x700x770mm',
    height: 1550,
    width: 700,
    depth: 770,
    weight: 211,
    operator: 'orange'
  },
  {
    id: 'orange_baie_energie_t3_10_8kw',
    name: 'Baie énergie Outdoor T3 10.8kw',
    reference: 'T3 10.8kw',
    category: 'energie',
    category_label: 'Énergie',
    dimensions: '1200x700x770mm',
    height: 1200,
    width: 700,
    depth: 770,
    weight: 150,
    operator: 'orange'
  },
  {
    id: 'orange_baie_energie_gbox',
    name: 'Baie énergie GBOX',
    reference: 'GBOX',
    category: 'energie',
    category_label: 'Énergie',
    dimensions: '',
    height: null,
    width: null,
    depth: null,
    weight: null,
    operator: 'orange'
  },
  {
    id: 'orange_baie_tlti_fg2_tgbt_48v',
    name: 'Baie TLTI FG2 TGBT /48V',
    reference: 'FG2 TGBT /48V',
    category: 'energie',
    category_label: 'Énergie',
    dimensions: '1650x855x750mm',
    height: 1650,
    width: 855,
    depth: 750,
    weight: null,
    operator: 'orange'
  },
  {
    id: 'orange_baie_tlti_fg2_tgbt_trans',
    name: 'Baie TLTI FG2 TGBT /TRANS',
    reference: 'FG2 TGBT /TRANS',
    category: 'energie',
    category_label: 'Énergie',
    dimensions: '1650x855x750mm',
    height: 1650,
    width: 855,
    depth: 750,
    weight: 95,
    operator: 'orange'
  },
  {
    id: 'orange_baie_seifel',
    name: 'Baie SEIFEL',
    reference: 'SEIFEL',
    category: 'energie',
    category_label: 'Énergie',
    dimensions: '1485x885x540mm',
    height: 1485,
    width: 885,
    depth: 540,
    weight: 86,
    operator: 'orange'
  },
  {
    id: 'orange_coffret_outdoor_trans_tlti_2015',
    name: 'Coffret Outdoor Trans TLTI 2015',
    reference: 'Trans TLTI 2015',
    category: 'energie',
    category_label: 'Énergie',
    dimensions: '1600x900x620mm',
    height: 1600,
    width: 900,
    depth: 620,
    weight: 65,
    operator: 'orange'
  }
];

export interface BaieEquipmentToggleProps {
  hasBaie: boolean;
  setHasBaie: (val: boolean) => void;
  baieItems?: SelectedBaieItem[];
  setBaieItems?: React.Dispatch<React.SetStateAction<SelectedBaieItem[]>> | ((val: SelectedBaieItem[]) => void);
  baieOptions?: BaieReference[];
  baieRadio?: boolean;
  setBaieRadio?: (val: boolean) => void;
  baieEnergie?: boolean;
  setBaieEnergie?: (val: boolean) => void;
}

export function BaieEquipmentToggle({
  hasBaie,
  setHasBaie,
  baieItems = [],
  setBaieItems,
  baieOptions = [],
  baieRadio,
  setBaieRadio,
  baieEnergie,
  setBaieEnergie
}: BaieEquipmentToggleProps) {
  const options = (baieOptions && baieOptions.length > 0) ? baieOptions : DEFAULT_ORANGE_BAIES;
  const [activeCategory, setActiveCategory] = useState<string>('radio');
  const categories = [
    { id: 'radio', label: '1. Radio', shortName: 'Radio', icon: Radio, count: options.filter(o => o.category === 'radio' || o.category === 'radio_trans').length },
    { id: 'energie', label: '2. Énergie', shortName: 'Énergie', icon: Zap, count: options.filter(o => o.category === 'energie' || o.category === 'distribution' || o.category === 'raccordement').length }
  ];

  const syncLegacyFlags = (items: SelectedBaieItem[]) => {
    const hasRadio = items.some(i => {
      const ref = options.find(o => o.id === i.referenceId);
      return ref?.category === 'radio' || ref?.category === 'radio_trans';
    });
    const hasEnergie = items.some(i => {
      const ref = options.find(o => o.id === i.referenceId);
      return ref?.category === 'energie' || ref?.category === 'distribution' || ref?.category === 'raccordement';
    });
    if (setBaieRadio) setBaieRadio(hasRadio);
    if (setBaieEnergie) setBaieEnergie(hasEnergie);
  };

  // Helper to normalize category matching
  const matchesCategory = (itemCategory: string | undefined, targetCat: string) => {
    if (targetCat === 'radio') return itemCategory === 'radio' || itemCategory === 'radio_trans';
    if (targetCat === 'energie') return itemCategory === 'energie' || itemCategory === 'distribution' || itemCategory === 'raccordement';
    return itemCategory === targetCat;
  };

  // Enforce 1 reference per category: clicking an unselected item replaces any existing item in that category
  const handleToggleItem = (item: BaieReference) => {
    if (!setBaieItems) return;
    const isCurrentSelected = baieItems.some(i => i.referenceId === item.id);
    let next: SelectedBaieItem[];
    if (isCurrentSelected) {
      // Deselect if already selected
      next = baieItems.filter(i => i.referenceId !== item.id);
    } else {
      // Replace any existing item from the same category (1 reference per category)
      const withoutSameCategory = baieItems.filter(i => {
        const ref = options.find(o => o.id === i.referenceId);
        return !matchesCategory(ref?.category, item.category);
      });
      next = [...withoutSameCategory, { id: crypto.randomUUID(), referenceId: item.id, quantity: 1 }];
    }
    setBaieItems(next);
    syncLegacyFlags(next);
  };

  const handleSetItemQty = (item: BaieReference, newQty: number) => {
    if (!setBaieItems) return;
    const exists = baieItems.find(i => i.referenceId === item.id);
    if (!exists) return;
    const qty = Math.max(1, newQty);
    const next = baieItems.map(i => i.referenceId === item.id ? { ...i, quantity: qty } : i);
    setBaieItems(next);
    syncLegacyFlags(next);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (setBaieItems) {
      setBaieItems([]);
      syncLegacyFlags([]);
    }
  };

  const filteredOptions = options.filter(o => matchesCategory(o.category, activeCategory));

  const totalSelectedCount = baieItems.reduce((acc, i) => acc + (i.quantity || 1), 0);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'radio':
      case 'radio_trans':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'energie':
      case 'distribution':
      case 'raccordement':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getSelectedForCategory = (catId: string) => {
    const sel = baieItems.find(i => {
      const ref = options.find(o => o.id === i.referenceId);
      return matchesCategory(ref?.category, catId);
    });
    if (!sel) return null;
    const ref = options.find(o => o.id === sel.referenceId);
    return { sel, ref };
  };

  const currentCategoryInfo = categories.find(c => c.id === activeCategory);
  const currentCategorySelection = getSelectedForCategory(activeCategory);

  return (
    <EquipmentToggleCard
      title="Présence Baie"
      enabled={hasBaie}
      onToggle={setHasBaie}
      icon={Server}
      color="orange"
      description="Sélectionnez 1 référence par catégorie en zone technique outdoor (Radio, Énergie)."
      headerRightContent={
        hasBaie ? (
          <span className="text-[11px] font-bold text-orange-700 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
            {baieItems.length} / 2 catégories
          </span>
        ) : null
      }
    >
            {/* Onglets des 2 Catégories (Sans "Toutes") avec indicateur direct du modèle choisi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                const catSelection = getSelectedForCategory(cat.id);
                const IconComponent = cat.icon;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex flex-col p-2.5 rounded-xl border text-left transition-all ${isActive
                      ? 'bg-orange-50/80 border-orange-400 ring-2 ring-orange-500/20 shadow-xs'
                      : catSelection
                        ? 'bg-slate-50/80 border-orange-200 hover:bg-orange-50/40'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5">
                        <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-orange-600' : 'text-slate-500'}`} />
                        <span className={`text-xs font-bold truncate ${isActive ? 'text-orange-950' : 'text-slate-800'}`}>
                          {cat.label}
                        </span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${isActive ? 'bg-orange-200/80 text-orange-900' : 'bg-slate-200/70 text-slate-600'
                        }`}>
                        {cat.count}
                      </span>
                    </div>

                    {/* Aperçu du choix sélectionné dans cette catégorie */}
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      {catSelection ? (
                        <div className="flex items-center gap-1 text-emerald-700 font-medium truncate">
                          <Check className="w-3 h-3 text-emerald-600 shrink-0 stroke-[3]" />
                          <span className="truncate">{catSelection.ref?.reference || catSelection.ref?.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">
                          Non sélectionné
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bannière de la catégorie active */}
            <div className="flex items-center justify-between bg-slate-50/80 border border-slate-200/80 rounded-lg px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">
                  {currentCategoryInfo?.label}
                </span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                  1 référence max
                </span>
              </div>
              <div className="text-[11px] text-slate-600">
                {currentCategorySelection ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Modèle sélectionné : {currentCategorySelection.ref?.name}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Aucun modèle sélectionné (cliquez pour en choisir un)</span>
                )}
              </div>
            </div>

            {/* Liste des équipements de la catégorie active (Comportement Radio : 1 référence par catégorie) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-0.5">
              {filteredOptions.map((item) => {
                const sel = baieItems.find(i => i.referenceId === item.id);
                const isSelected = !!sel;
                const qty = sel?.quantity || 1;

                return (
                  <EquipmentOptionCard
                    key={item.id}
                    title={item.name}
                    isSelected={isSelected}
                    onToggle={() => handleToggleItem(item)}
                    selectionType="radio"
                    badgeText={item.category_label || item.category}
                    badgeClass={getCategoryColor(item.category)}
                    quantity={qty}
                    onQuantityChange={(val) => handleSetItemQty(item, val)}
                    color="orange"
                  />
                );
              })}
            </div>

            {/* Barre de synthèse globale des 2 catégories */}
            <div className="mt-2 pt-3 border-t border-slate-200/80 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {categories.map((c) => {
                  const s = getSelectedForCategory(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => setActiveCategory(c.id)}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${s
                        ? 'bg-orange-50/60 border-orange-300 text-orange-950'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                    >
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                        {c.shortName}
                      </div>
                      <div className="text-[11px] font-semibold truncate">
                        {s ? (
                          <span className="text-slate-900">{s.sel.quantity > 1 ? `${s.sel.quantity}x ` : ''}{s.ref?.reference || s.ref?.name}</span>
                        ) : (
                          <span className="italic text-slate-400">Aucun</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {baieItems.length > 0 && (
                <div className="flex items-center justify-between pt-1 px-1 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      Total : {totalSelectedCount} {totalSelectedCount > 1 ? 'équipements configurés' : 'équipement configuré'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[11px] font-medium text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Réinitialiser tout
                  </button>
                </div>
              )}
            </div>
    </EquipmentToggleCard>
  );
}

export interface CabEquipmentToggleProps {
  hasCab: boolean;
  setHasCab: (val: boolean) => void;
  cabOne: boolean;
  setCabOne: (val: boolean) => void;
  cabTwo: boolean;
  setCabTwo: (val: boolean) => void;
  cabThree: boolean;
  setCabThree: (val: boolean) => void;
  cabSupport: string;
  setCabSupport: (val: string) => void;
}

export function CabEquipmentToggle({
  hasCab,
  setHasCab,
  cabOne,
  setCabOne,
  cabTwo,
  setCabTwo,
  cabThree,
  setCabThree,
  cabSupport,
  setCabSupport
}: CabEquipmentToggleProps) {
  const supportOptions = [
    { id: 'plinthes', label: 'Plinthes' },
    { id: 'support_autostable', label: 'Support Autostable' },
    { id: 'support_fimo', label: 'Support FIMO' },
    { id: 'support_muraux', label: 'Supports Muraux' }
  ];

  return (
    <EquipmentToggleCard
      title="Présence Baie CAB"
      enabled={hasCab}
      onToggle={(checked) => {
        setHasCab(checked);
        if (checked) {
          if (!cabOne && !cabTwo && !cabThree) {
            setCabOne(true);
          }
          if (!cabSupport) {
            setCabSupport('plinthes');
          }
        }
      }}
      icon={Server}
      color="rose"
      scopeBadgeText="1x par site"
    >
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Options CAB</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
          <EquipmentOptionCard
            title="CAB ONE"
            isSelected={cabOne}
            onToggle={setCabOne}
            color="red"
          />
          <EquipmentOptionCard
            title="CAB TWO"
            isSelected={cabTwo}
            onToggle={setCabTwo}
            color="red"
          />
          <EquipmentOptionCard
            title="CAB THREE"
            isSelected={cabThree}
            onToggle={setCabThree}
            color="red"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Supports</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
          {supportOptions.map((opt) => (
            <EquipmentOptionCard
              key={opt.id}
              title={opt.label}
              isSelected={cabSupport === opt.id}
              onToggle={() => setCabSupport(opt.id)}
              selectionType="radio"
              color="red"
            />
          ))}
        </div>
      </div>
    </EquipmentToggleCard>
  );
}

export interface AtelierEnergieEquipmentToggleProps {
  hasAtelierEnergie: boolean;
  setHasAtelierEnergie: (val: boolean) => void;
  atelierFprb: boolean;
  setAtelierFprb: (val: boolean) => void;
  atelierFprbQuantity?: number;
  setAtelierFprbQuantity?: (val: number) => void;
  atelierFpbc: boolean;
  setAtelierFpbc: (val: boolean) => void;
  atelierFpbcQuantity?: number;
  setAtelierFpbcQuantity?: (val: number) => void;
}

export function AtelierEnergieEquipmentToggle({
  hasAtelierEnergie,
  setHasAtelierEnergie,
  atelierFprb,
  setAtelierFprb,
  atelierFprbQuantity = 1,
  setAtelierFprbQuantity,
  atelierFpbc,
  setAtelierFpbc,
  atelierFpbcQuantity = 1,
  setAtelierFpbcQuantity
}: AtelierEnergieEquipmentToggleProps) {
  return (
    <EquipmentToggleCard
      title="Atelier d'énergie"
      enabled={hasAtelierEnergie}
      onToggle={(checked) => {
        setHasAtelierEnergie(checked);
        if (checked && !atelierFprb && !atelierFpbc) {
          setAtelierFprb(true);
        }
      }}
      icon={Zap}
      color="violet"
      scopeBadgeText="1x par site"
    >
      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Modules d'énergie</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
        <EquipmentOptionCard
          title="Module d'énergie FPRB"
          isSelected={atelierFprb}
          onToggle={setAtelierFprb}
          quantity={atelierFprbQuantity}
          onQuantityChange={setAtelierFprbQuantity}
          color="amber"
        />

        <EquipmentOptionCard
          title="Module FPBC (batterie)"
          isSelected={atelierFpbc}
          onToggle={setAtelierFpbc}
          quantity={atelierFpbcQuantity}
          onQuantityChange={setAtelierFpbcQuantity}
          color="amber"
        />
      </div>
    </EquipmentToggleCard>
  );
}

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

  // Derive available vendors
  const availableVendors = Array.from(new Set(bouyguesOptions.map(o => o.vendor || 'ELTEK')));
  const [selectedVendor, setSelectedVendor] = useState<string>(() => {
    const current = bouyguesOptions.find(o => o.id === bcubeReference);
    return current?.vendor || availableVendors[0] || 'ELTEK';
  });

  // Filter options by vendor
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
        {/* Vendor Tabs */}
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

        {/* Model Select */}
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

        {/* Specs Display */}
        {selectedItem && (
          <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 block">Fournisseur</label>
                <input
                  type="text"
                  value={selectedItem.supplier || 'N/A'}
                  disabled
                  className="w-full bg-white border border-slate-200 rounded py-1.5 px-2 text-xs text-slate-800 font-medium cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Puissance / Phase</label>
                <input
                  type="text"
                  value={[selectedItem.power, selectedItem.phase].filter(Boolean).join(' ') || 'N/A'}
                  disabled
                  className="w-full bg-white border border-slate-200 rounded py-1.5 px-2 text-xs text-slate-800 font-medium cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </EquipmentToggleCard>
  );
}

export interface ConvertisseurMdeaEquipmentToggleProps {
  hasConvertisseurMdea: boolean;
  setHasConvertisseurMdea: (val: boolean) => void;
  convertisseurMdeaQuantity: number;
  setConvertisseurMdeaQuantity: (val: number) => void;
}

export function ConvertisseurMdeaEquipmentToggle({
  hasConvertisseurMdea,
  setHasConvertisseurMdea,
  convertisseurMdeaQuantity,
  setConvertisseurMdeaQuantity
}: ConvertisseurMdeaEquipmentToggleProps) {
  return (
    <EquipmentToggleCard
      title="Présence convertisseur MDEA"
      enabled={hasConvertisseurMdea}
      onToggle={setHasConvertisseurMdea}
      icon={Zap}
      color="violet"
    >
      <div className="flex flex-col gap-3">
        {/* Quantité */}
        <QuantityInput
          value={convertisseurMdeaQuantity || 1}
          onChange={setConvertisseurMdeaQuantity}
          label="Qté :"
          size="md"
        />
      </div>
    </EquipmentToggleCard>
  );
}
