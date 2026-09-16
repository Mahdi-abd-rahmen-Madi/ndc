import { Radio, Activity, ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import React from 'react';
import type { EquipmentItem } from '../RegularUserView';


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
}

export default function FHEquipmentToggle({
  hasFhEquipment,
  setHasFhEquipment,
    setFhDiameter,
  fhReference,
  setFhReference,
  fhQuantity,
  setFhQuantity,
  fhOptions = []
}: FHEquipmentToggleProps) {

  const handleReferenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFhReference(val);
    const ref = fhOptions.find(r => r.id === val);
    if (ref) {
      setFhDiameter(ref.diameter);
    }
  };

  const selectedRef = fhOptions.find(r => r.id === fhReference);
  const vendors = Array.from(new Set(fhOptions.map(o => o.vendor)));
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-white flex items-center gap-2 cursor-pointer">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={hasFhEquipment}
                onChange={(e) => setHasFhEquipment(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-6 bg-slate-700 rounded-full transition-colors ${hasFhEquipment ? 'bg-indigo-500' : ''}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${hasFhEquipment ? 'transform translate-x-4' : ''}`}></div>
            </div>
            <Radio className="w-4 h-4 text-indigo-400" />
            Présence équipement FH
          </label>
        </div>

        {hasFhEquipment && (
          <div className="flex flex-col gap-4 pt-2 border-t border-slate-850 animate-fadeIn">
            
            {/* Row 1: Quantité & Référence */}
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Quantité */}
              <div className="flex flex-col">
                <label className="text-xs text-slate-400 mb-1">Quantité:</label>
                <div className="flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={fhQuantity || 1}
                    onChange={(e) => setFhQuantity(Math.max(1, Number(e.target.value)))}
                    className="bg-transparent border-none py-1.5 px-2 text-sm text-center text-white focus:ring-0 w-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="flex flex-col border-l border-slate-700">
                    <button
                      type="button"
                      onClick={() => setFhQuantity((fhQuantity || 1) + 1)}
                      className="px-1.5 flex-1 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border-b border-slate-700"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFhQuantity(Math.max(1, (fhQuantity || 1) - 1))}
                      className="px-1.5 flex-1 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Référence */}
              <div className="flex flex-col flex-1">
                <label className="text-xs text-slate-400 mb-1">Référence:</label>
                <select
                  value={fhReference}
                  onChange={handleReferenceChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Sélectionner...</option>
                  {vendors.map(vendor => (
                    <optgroup key={vendor} label={vendor}>
                      {fhOptions.filter(o => o.vendor === vendor).map(ref => (
                        <option key={ref.id} value={ref.id}>{ref.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Diamètre & Poids (Visual Only) */}
            {selectedRef && (
              <div className="flex gap-4 opacity-80">
                <div className="flex flex-col">
                  <label className="text-xs text-slate-400 mb-1">Diamètre:</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={selectedRef.diameter}
                      disabled
                      className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-1.5 px-3 text-sm text-slate-300 w-24 cursor-not-allowed"
                    />
                    <span className="absolute right-3 top-1.5 text-slate-500 text-sm pointer-events-none">mm</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-slate-400 mb-1">Poids:</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={selectedRef.weight}
                      disabled
                      className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-1.5 px-3 text-sm text-slate-300 w-24 cursor-not-allowed"
                    />
                    <span className="absolute right-3 top-1.5 text-slate-500 text-sm pointer-events-none">kg</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

export interface RRHEquipmentToggleProps {
  hasRrhEquipment: boolean;
  setHasRrhEquipment: (val: boolean) => void;
  rrhItems: EquipmentItem[];
  setRrhItems: (val: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => void;
  rrhOptions: { id: string; vendor: string; reference: string }[];
}

export function RRHEquipmentToggle({
  hasRrhEquipment,
  setHasRrhEquipment,
  rrhItems,
  setRrhItems,
  rrhOptions
}: RRHEquipmentToggleProps) {
  const addRrhRow = () => {
    setRrhItems(prev => [...prev, { id: crypto.randomUUID(), reference: '', quantity: 1 }]);
  };

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
  
  const uniqueVendors = Array.from(new Set(rrhOptions.map(o => o.vendor)));
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-white flex items-center gap-2 cursor-pointer shrink-0">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              checked={hasRrhEquipment}
              onChange={(e) => setHasRrhEquipment(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-10 h-6 bg-slate-700 rounded-full transition-colors ${hasRrhEquipment ? 'bg-rose-500' : ''}`}></div>
            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${hasRrhEquipment ? 'transform translate-x-4' : ''}`}></div>
          </div>
          <Activity className="w-4 h-4 text-rose-400" />
          Présence équipement RRH
        </label>

        {hasRrhEquipment && (
          <div className="flex flex-col gap-3 animate-fadeIn mt-2 border-t border-slate-800/50 pt-3">
            {rrhItems.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 p-3 bg-slate-900/30 rounded-lg border border-slate-700/50">
                <div className="flex gap-3">
                  {/* Marque */}
                  <div className="flex flex-col flex-1">
                    <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Marque</label>
                    <select
                      value={item.vendor || ''}
                      onChange={(e) => updateRrhItem(item.id, 'vendor', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2 text-sm text-white focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="">Sélectionner</option>
                      {uniqueVendors.map(vendor => (
                        <option key={vendor} value={vendor}>{vendor}</option>
                      ))}
                    </select>
                  </div>

                  {/* Modèle */}
                  <div className="flex flex-col flex-1">
                    <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Modèle</label>
                    <select
                      value={item.reference}
                      onChange={(e) => updateRrhItem(item.id, 'reference', e.target.value)}
                      disabled={!item.vendor}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2 text-sm text-white focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
                    >
                      <option value="">Sélectionner</option>
                      {rrhOptions.filter(o => o.vendor === item.vendor).map(opt => {
                        const isSelectedElsewhere = rrhItems.some(otherItem => otherItem.id !== item.id && otherItem.reference === opt.id);
                        return (
                          <option key={opt.id} value={opt.id} disabled={isSelectedElsewhere}>
                            {opt.reference} {isSelectedElsewhere ? '(Déjà utilisé)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                  {/* Quantité */}
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-500 uppercase font-semibold">Qté:</label>
                    <div className="flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden h-7">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity || 1}
                        onChange={(e) => updateRrhItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        className="bg-transparent border-none py-0 px-2 text-sm text-center text-white focus:ring-0 w-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="flex flex-col border-l border-slate-700 w-5">
                        <button
                          type="button"
                          onClick={() => updateRrhItem(item.id, 'quantity', (item.quantity || 1) + 1)}
                          className="flex-1 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border-b border-slate-700"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateRrhItem(item.id, 'quantity', Math.max(1, (item.quantity || 1) - 1))}
                          className="flex-1 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    type="button"
                    onClick={() => removeRrhRow(item.id)}
                    disabled={rrhItems.length === 1}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={addRrhRow}
              className="flex items-center gap-2 self-start px-3 py-1.5 mt-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export interface RRUEquipmentToggleProps {
  hasRruEquipment: boolean;
  setHasRruEquipment: (val: boolean) => void;
  rruItems: EquipmentItem[];
  setRruItems: (val: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => void;
  rruOptions: { id: string; vendor: string; reference: string }[];
}

export function RRUEquipmentToggle({
  hasRruEquipment,
  setHasRruEquipment,
  rruItems,
  setRruItems,
  rruOptions
}: RRUEquipmentToggleProps) {
  const addRruRow = () => {
    setRruItems(prev => [...prev, { id: crypto.randomUUID(), reference: '', quantity: 1 }]);
  };

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
  
  const uniqueVendors = Array.from(new Set(rruOptions.map(o => o.vendor)));
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-white flex items-center gap-2 cursor-pointer shrink-0">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              checked={hasRruEquipment}
              onChange={(e) => setHasRruEquipment(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-10 h-6 bg-slate-700 rounded-full transition-colors ${hasRruEquipment ? 'bg-emerald-500' : ''}`}></div>
            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${hasRruEquipment ? 'transform translate-x-4' : ''}`}></div>
          </div>
          <Activity className="w-4 h-4 text-emerald-400" />
          Présence équipement RRU
        </label>

        {hasRruEquipment && (
          <div className="flex flex-col gap-3 animate-fadeIn mt-2 border-t border-slate-800/50 pt-3">
            {rruItems.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 p-3 bg-slate-900/30 rounded-lg border border-slate-700/50">
                <div className="flex gap-3">
                  {/* Marque */}
                  <div className="flex flex-col flex-1">
                    <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Marque</label>
                    <select
                      value={item.vendor || ''}
                      onChange={(e) => updateRruItem(item.id, 'vendor', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2 text-sm text-white focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Sélectionner</option>
                      {uniqueVendors.map(vendor => (
                        <option key={vendor} value={vendor}>{vendor}</option>
                      ))}
                    </select>
                  </div>

                  {/* Modèle */}
                  <div className="flex flex-col flex-1">
                    <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Modèle</label>
                    <select
                      value={item.reference}
                      onChange={(e) => updateRruItem(item.id, 'reference', e.target.value)}
                      disabled={!item.vendor}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    >
                      <option value="">Sélectionner</option>
                      {rruOptions.filter(o => o.vendor === item.vendor).map(opt => {
                        const isSelectedElsewhere = rruItems.some(otherItem => otherItem.id !== item.id && otherItem.reference === opt.id);
                        return (
                          <option key={opt.id} value={opt.id} disabled={isSelectedElsewhere}>
                            {opt.reference} {isSelectedElsewhere ? '(Déjà utilisé)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                  {/* Quantité */}
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-500 uppercase font-semibold">Qté:</label>
                    <div className="flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden h-7">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity || 1}
                        onChange={(e) => updateRruItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        className="bg-transparent border-none py-0 px-2 text-sm text-center text-white focus:ring-0 w-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="flex flex-col border-l border-slate-700 w-5">
                        <button
                          type="button"
                          onClick={() => updateRruItem(item.id, 'quantity', (item.quantity || 1) + 1)}
                          className="flex-1 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border-b border-slate-700"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateRruItem(item.id, 'quantity', Math.max(1, (item.quantity || 1) - 1))}
                          className="flex-1 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    type="button"
                    onClick={() => removeRruRow(item.id)}
                    disabled={rruItems.length === 1}
                    className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={addRruRow}
              className="flex items-center gap-2 self-start px-3 py-1.5 mt-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter
            </button>
          </div>
        )}
      </div>
    </div>
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
  tdOptions
}: TDEquipmentToggleProps) {

  React.useEffect(() => {
    if (hasTdEquipment) {
      if (tdType === 'tetraphase') {
        const opt = tdOptions.find(o => o.reference === '68237');
        if (opt && tdReference !== opt.id) setTdReference(opt.id);
      } else {
        const opt = tdOptions.find(o => o.reference === '68236');
        if (opt && tdReference !== opt.id) setTdReference(opt.id);
      }
    }
  }, [hasTdEquipment, tdType, tdOptions, tdReference, setTdReference]);

  const filteredTdOptions = tdOptions.filter(opt => {
    if (tdType === 'tetraphase') return opt.reference === '68237';
    if (tdType === 'monophase') return opt.reference === '68236';
    return true;
  });

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-white flex items-center gap-2 cursor-pointer">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={hasTdEquipment}
                onChange={(e) => setHasTdEquipment(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-6 bg-slate-700 rounded-full transition-colors ${hasTdEquipment ? 'bg-amber-500' : ''}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${hasTdEquipment ? 'transform translate-x-4' : ''}`}></div>
            </div>
            <Activity className="w-4 h-4 text-amber-400" />
            Présence équipement TD
          </label>
        </div>

        {hasTdEquipment && (
          <div className="flex flex-col gap-4 pt-2 border-t border-slate-850 animate-fadeIn">
            {/* TD Type */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  checked={tdType === 'tetraphase'}
                  onChange={() => setTdType('tetraphase')}
                  className="text-amber-500 focus:ring-amber-500"
                />
                TD Tétraphasé
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  checked={tdType === 'monophase'}
                  onChange={() => setTdType('monophase')}
                  className="text-amber-500 focus:ring-amber-500"
                />
                TD Monophasé + TGBT
              </label>
            </div>

            {/* References */}
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex flex-col flex-1">
                <label className="text-xs text-slate-400 mb-1">Référence TD:</label>
                <select
                  value={tdReference}
                  onChange={(e) => setTdReference(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Sélectionner une référence</option>
                  {filteredTdOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.vendor} - {opt.name} ({opt.reference})
                    </option>
                  ))}
                </select>
              </div>

              {tdType === 'monophase' && (
                <div className="flex flex-col flex-1 animate-fadeIn">
                  <label className="text-xs text-slate-400 mb-1">Référence TGBT:</label>
                  <input
                    type="text"
                    value={tgbtReference}
                    onChange={(e) => setTgbtReference(e.target.value)}
                    placeholder="Ex: TGBT-456"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500 placeholder-slate-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
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
  colorClass = 'indigo',
  icon: Icon = Activity
}: GenericEquipmentToggleProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm font-semibold text-white flex items-center gap-2 cursor-pointer shrink-0">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-10 h-6 bg-slate-700 rounded-full transition-colors ${enabled ? 'bg-' + colorClass + '-500' : ''}`}></div>
            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${enabled ? 'transform translate-x-4' : ''}`}></div>
          </div>
          <Icon className={`w-4 h-4 text-${colorClass}-400`} />
          {title}
        </label>

        {enabled && (
          <div className="flex flex-col md:flex-row md:items-center gap-4 animate-fadeIn flex-1 justify-end mt-3 md:mt-0">
            {/* Quantité */}
            {quantity !== undefined && setQuantity !== undefined && (
              <div className="flex flex-col">
                <label className="text-xs text-slate-400 mb-1">Quantité:</label>
                <div className={`flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-${colorClass}-500`}>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity || 1}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="bg-transparent border-none py-1.5 px-2 text-sm text-center text-white focus:ring-0 w-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="flex flex-col border-l border-slate-700">
                    <button
                      type="button"
                      onClick={() => setQuantity((quantity || 1) + 1)}
                      className="px-1.5 flex-1 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border-b border-slate-700"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, (quantity || 1) - 1))}
                      className="px-1.5 flex-1 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Référence */}
            <div className="flex flex-col flex-1 md:max-w-[200px]">
              <label className="text-xs text-slate-400 mb-1">Référence:</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ex: Ref..."
                className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-${colorClass}-500 placeholder-slate-500`}
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
}

export function BoitierLovageEquipmentToggle({
  hasBoitierLovage,
  setHasBoitierLovage,
  boitierLovageReference,
  setBoitierLovageReference
}: BoitierLovageEquipmentToggleProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-semibold text-white flex items-center gap-2 cursor-pointer shrink-0">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={hasBoitierLovage}
                onChange={(e) => setHasBoitierLovage(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-6 bg-slate-700 rounded-full transition-colors ${hasBoitierLovage ? 'bg-purple-500' : ''}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${hasBoitierLovage ? 'transform translate-x-4' : ''}`}></div>
            </div>
            <Activity className="w-4 h-4 text-purple-400" />
            Présence Boitiers de lovage
          </label>
        </div>

        {hasBoitierLovage && (
          <div className="flex flex-col gap-4 pt-2 border-t border-slate-850 animate-fadeIn">
            {/* Boitier Lovage Reference */}
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs text-slate-400 shrink-0">Réf. Boitier:</label>
                <input
                  type="text"
                  value={boitierLovageReference}
                  onChange={(e) => setBoitierLovageReference(e.target.value)}
                  placeholder="Référence Boitier"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-purple-500 placeholder-slate-500"
                />
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
}

export function GPSEquipmentToggle({
  hasGps,
  setHasGps,
  gpsReference,
  setGpsReference
}: GPSEquipmentToggleProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-semibold text-white flex items-center gap-2 cursor-pointer shrink-0">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={hasGps}
                onChange={(e) => setHasGps(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-6 bg-slate-700 rounded-full transition-colors ${hasGps ? 'bg-blue-500' : ''}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${hasGps ? 'transform translate-x-4' : ''}`}></div>
            </div>
            <Activity className="w-4 h-4 text-blue-400" />
            Présence GPS
          </label>
        </div>

        {hasGps && (
          <div className="flex flex-col gap-4 pt-2 border-t border-slate-850 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs text-slate-400 shrink-0">Réf. GPS:</label>
                <input
                  type="text"
                  value={gpsReference}
                  onChange={(e) => setGpsReference(e.target.value)}
                  placeholder="Référence GPS"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface CoffretEquipmentToggleProps {
  hasCoffret: boolean;
  setHasCoffret: (val: boolean) => void;
  coffretReference: string;
  setCoffretReference: (val: string) => void;
  coffretOptions: { id: string; name: string }[];
}

export function CoffretEquipmentToggle({
  hasCoffret,
  setHasCoffret,
  coffretReference,
  setCoffretReference,
  coffretOptions
}: CoffretEquipmentToggleProps) {
  
  const httaOptions = coffretOptions.filter(opt => opt.name.includes('HTTA'));
  const otherOptions = coffretOptions.filter(opt => !opt.name.includes('HTTA'));
  const isHttaSelected = httaOptions.some(opt => opt.id === coffretReference) || coffretReference === 'HTTA';
  const mainSelectValue = isHttaSelected ? 'HTTA' : coffretReference;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-white flex items-center gap-2 cursor-pointer">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={hasCoffret}
                onChange={(e) => setHasCoffret(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-6 bg-slate-700 rounded-full transition-colors ${hasCoffret ? 'bg-fuchsia-500' : ''}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${hasCoffret ? 'transform translate-x-4' : ''}`}></div>
            </div>
            <Activity className="w-4 h-4 text-fuchsia-400" />
            Présence Coffrets fibre
          </label>
        </div>

        {hasCoffret && (
          <div className="flex flex-col gap-4 pt-3 border-t border-slate-800/80 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs text-slate-400 shrink-0 w-16 md:w-auto">Type:</label>
                <select
                  value={mainSelectValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'HTTA' && httaOptions.length > 0) {
                      setCoffretReference(httaOptions[0].id);
                    } else {
                      setCoffretReference(val);
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-fuchsia-500"
                >
                  <option value="">Sélectionner...</option>
                  {otherOptions.map(ref => (
                    <option key={ref.id} value={ref.id}>{ref.name.replace(/\s*\([^)]*\)/g, '').trim()}</option>
                  ))}
                  {httaOptions.length > 0 && (
                    <option value="HTTA">Coffrets HTTA</option>
                  )}
                </select>
              </div>
            </div>

            {isHttaSelected && httaOptions.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 animate-fadeIn bg-slate-800/30 p-3 rounded-lg border border-slate-700/50 mt-4">
                <label className="text-xs font-medium text-slate-300 shrink-0 sm:w-24">Référence HTTA:</label>
                <select
                  value={coffretReference === 'HTTA' ? httaOptions[0].id : coffretReference}
                  onChange={(e) => setCoffretReference(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-fuchsia-500"
                >
                  {httaOptions.map(ref => (
                    <option key={ref.id} value={ref.id}>
                      {ref.name.replace(/\s*\([^)]*\)/g, '').trim()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(() => {
              const actualRef = isHttaSelected && coffretReference === 'HTTA' && httaOptions.length > 0 ? httaOptions[0].id : coffretReference;
              const selectedRef = coffretOptions.find(r => r.id === actualRef);
              if (!selectedRef) return null;
              
              let h = '', w = '', t = '', weight = '';
              const match = selectedRef.name.match(/\(([^,]+),\s*([\d.]+)kg\)/i);
              if (match) {
                const dims = match[1].replace(/mm/i, '').trim();
                const parts = dims.split(/x/i);
                if (parts.length === 3) {
                  h = parts[0].trim();
                  w = parts[1].trim();
                  t = parts[2].trim();
                }
                weight = match[2].trim();
              }

              return (
                <div className="space-y-2 mt-4 animate-fadeIn bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Hauteur (mm)</label>
                      <input
                        type="text"
                        value={h}
                        disabled
                        className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white opacity-70 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Largeur (mm)</label>
                      <input
                        type="text"
                        value={w}
                        disabled
                        className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white opacity-70 cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Épaisseur (mm)</label>
                      <input
                        type="text"
                        value={t}
                        disabled
                        className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white opacity-70 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Poids (Kg)</label>
                      <input
                        type="text"
                        value={weight}
                        disabled
                        className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white opacity-70 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
