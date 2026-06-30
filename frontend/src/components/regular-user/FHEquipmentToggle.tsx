import { Radio, Activity } from 'lucide-react';
import { CatalogueConfig } from './types';

interface FHEquipmentToggleProps {
  hasFhEquipment: boolean;
  setHasFhEquipment: (val: boolean) => void;
  fhWeight: number;
  setFhWeight: (val: number) => void;
  fhReference: string;
  setFhReference: (val: string) => void;
  config: CatalogueConfig | null;
}

export default function FHEquipmentToggle({
  hasFhEquipment,
  setHasFhEquipment,
  fhWeight,
  setFhWeight,
  fhReference,
  setFhReference,
  config
}: FHEquipmentToggleProps) {
  const weightOptions = config?.fh_weight_options || [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];

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
            {/* Poids total */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-400 shrink-0">Poids total:</label>
              <div className="relative">
                <select
                  value={fhWeight}
                  onChange={(e) => setFhWeight(Number(e.target.value))}
                  className="appearance-none bg-slate-800 border border-slate-700 rounded-lg py-1.5 pl-3 pr-8 text-sm text-white focus:ring-2 focus:ring-indigo-500"
                >
                  {weightOptions.map((w) => (
                    <option key={w} value={w}>{w} kg</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Référence */}
            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs text-slate-400 shrink-0">Référence:</label>
              <input
                type="text"
                value={fhReference}
                onChange={(e) => setFhReference(e.target.value)}
                placeholder="Ex: FH-001"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 placeholder-slate-500"
              />
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
}

export function RRHEquipmentToggle({
  hasRrhEquipment,
  setHasRrhEquipment,
  rrhReference,
  setRrhReference
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
          <div className="flex items-center gap-2 animate-fadeIn flex-1 justify-end max-w-[240px]">
            <label className="text-xs text-slate-400 shrink-0">Référence:</label>
            <input
              type="text"
              value={rrhReference}
              onChange={(e) => setRrhReference(e.target.value)}
              placeholder="Ex: RRH-001"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1 px-2.5 text-sm text-white focus:ring-2 focus:ring-rose-500 placeholder-slate-500"
            />
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
}

export function RRUEquipmentToggle({
  hasRruEquipment,
  setHasRruEquipment,
  rruReference,
  setRruReference
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
          <div className="flex items-center gap-2 animate-fadeIn flex-1 justify-end max-w-[240px]">
            <label className="text-xs text-slate-400 shrink-0">Référence:</label>
            <input
              type="text"
              value={rruReference}
              onChange={(e) => setRruReference(e.target.value)}
              placeholder="Ex: RRU-001"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1 px-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 placeholder-slate-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}
