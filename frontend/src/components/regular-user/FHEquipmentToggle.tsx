import { Radio, Activity } from 'lucide-react';
import React from 'react';

const FH_REFERENCES = [
  { id: 'Andrew VHLP1-38', name: 'Andrew VHLP1-38 (0.3m)', diameter: 300 },
  { id: 'Andrew VHLP2-38', name: 'Andrew VHLP2-38 (0.6m)', diameter: 600 },
  { id: 'Ericsson MINI-LINK 300', name: 'Ericsson MINI-LINK (0.3m)', diameter: 300 },
  { id: 'Ericsson MINI-LINK 600', name: 'Ericsson MINI-LINK (0.6m)', diameter: 600 },
  { id: 'Huawei RTN 300', name: 'Huawei RTN (0.3m)', diameter: 300 },
  { id: 'Huawei RTN 600', name: 'Huawei RTN (0.6m)', diameter: 600 },
];

interface FHEquipmentToggleProps {
  hasFhEquipment: boolean;
  setHasFhEquipment: (val: boolean) => void;
  fhDiameter: number;
  setFhDiameter: (val: number) => void;
  fhReference: string;
  setFhReference: (val: string) => void;
  fhQuantity: number;
  setFhQuantity: (val: number) => void;
}

export default function FHEquipmentToggle({
  hasFhEquipment,
  setHasFhEquipment,
  fhDiameter,
  setFhDiameter,
  fhReference,
  setFhReference,
  fhQuantity,
  setFhQuantity
}: FHEquipmentToggleProps) {

  const handleReferenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFhReference(val);
    const ref = FH_REFERENCES.find(r => r.id === val);
    if (ref) {
      setFhDiameter(ref.diameter);
    }
  };

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
          <div className="flex flex-col md:flex-row md:items-center gap-4 pt-2 border-t border-slate-850 animate-fadeIn">

            {/* Quantité */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 shrink-0">Quantité:</label>
              <input
                type="number"
                min="1"
                step="1"
                value={fhQuantity}
                onChange={(e) => setFhQuantity(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 w-16"
              />
            </div>

            {/* Référence */}
            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs text-slate-400 shrink-0">Référence:</label>
              <select
                value={fhReference}
                onChange={handleReferenceChange}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sélectionner...</option>
                {FH_REFERENCES.map(ref => (
                  <option key={ref.id} value={ref.id}>{ref.name}</option>
                ))}
              </select>
            </div>

            {/* Diamètre (Visual Only) */}
            <div className="flex items-center gap-2 opacity-70">
              <label className="text-xs text-slate-400 shrink-0">Diamètre:</label>
              <div className="relative">
                <input
                  type="text"
                  value={fhDiameter ? fhDiameter : ''}
                  disabled
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-1.5 px-3 text-sm text-slate-300 w-20 cursor-not-allowed"
                />
                <span className="absolute right-3 top-1.5 text-slate-500 text-sm pointer-events-none">mm</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export interface RRHEquipmentToggleProps {
  hasRrhEquipment: boolean;
  setHasRrhEquipment: (val: boolean) => void;
  rrhReference: string;
  setRrhReference: (val: string) => void;
  rrhQuantity: number;
  setRrhQuantity: (val: number) => void;
}

export function RRHEquipmentToggle({
  hasRrhEquipment,
  setHasRrhEquipment,
  rrhReference,
  setRrhReference,
  rrhQuantity,
  setRrhQuantity
}: RRHEquipmentToggleProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-4">
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
          <div className="flex items-center gap-4 animate-fadeIn flex-1 justify-end">
            {/* Quantité */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 shrink-0">Quantité:</label>
              <input
                type="number"
                min="1"
                step="1"
                value={rrhQuantity}
                onChange={(e) => setRrhQuantity(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-2 focus:ring-rose-500 w-16"
              />
            </div>

            {/* Référence */}
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <label className="text-xs text-slate-400 shrink-0">Référence:</label>
              <input
                type="text"
                value={rrhReference}
                onChange={(e) => setRrhReference(e.target.value)}
                placeholder="Ex: RRH-001"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-rose-500 placeholder-slate-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface RRUEquipmentToggleProps {
  hasRruEquipment: boolean;
  setHasRruEquipment: (val: boolean) => void;
  rruReference: string;
  setRruReference: (val: string) => void;
  rruQuantity: number;
  setRruQuantity: (val: number) => void;
}

export function RRUEquipmentToggle({
  hasRruEquipment,
  setHasRruEquipment,
  rruReference,
  setRruReference,
  rruQuantity,
  setRruQuantity
}: RRUEquipmentToggleProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-4">
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
          <div className="flex items-center gap-4 animate-fadeIn flex-1 justify-end">
            {/* Quantité */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 shrink-0">Quantité:</label>
              <input
                type="number"
                min="1"
                step="1"
                value={rruQuantity}
                onChange={(e) => setRruQuantity(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 w-16"
              />
            </div>

            {/* Référence */}
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <label className="text-xs text-slate-400 shrink-0">Référence:</label>
              <input
                type="text"
                value={rruReference}
                onChange={(e) => setRruReference(e.target.value)}
                placeholder="Ex: RRU-001"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 placeholder-slate-500"
              />
            </div>
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
}

export function TDEquipmentToggle({
  hasTdEquipment,
  setHasTdEquipment,
  tdType,
  setTdType,
  tdReference,
  setTdReference,
  tgbtReference,
  setTgbtReference
}: TDEquipmentToggleProps) {
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
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs text-slate-400 shrink-0">Référence TD:</label>
                <input
                  type="text"
                  value={tdReference}
                  onChange={(e) => setTdReference(e.target.value)}
                  placeholder="Ex: TD-123"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500 placeholder-slate-500"
                />
              </div>

              {tdType === 'monophase' && (
                <div className="flex items-center gap-2 flex-1 animate-fadeIn">
                  <label className="text-xs text-slate-400 shrink-0">Référence TGBT:</label>
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
  quantity: number;
  setQuantity: (val: number) => void;
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
          <div className="flex items-center gap-4 animate-fadeIn flex-1 justify-end">
            {/* Quantité */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 shrink-0">Quantité:</label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className={`bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-2 focus:ring-${colorClass}-500 w-16`}
              />
            </div>

            {/* Référence */}
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <label className="text-xs text-slate-400 shrink-0">Référence:</label>
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
                    <option key={ref.id} value={ref.id}>{ref.id}</option>
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
                      {ref.id}
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
