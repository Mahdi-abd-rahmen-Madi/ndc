// RegionControl component

import { Map } from 'lucide-react';
import type { RegionControlProps } from '../utils/types';

export default function RegionControl({ visible, onToggle }: RegionControlProps) {
  return (
    <button
      onClick={onToggle}
      className={`absolute top-16 right-[172px] px-3.5 py-2 rounded-xl cursor-pointer text-xs font-semibold shadow-lg border transition-all z-[1000] flex items-center gap-1.5 backdrop-blur-md ${
        visible
          ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20'
          : 'bg-white/95 text-slate-700 hover:bg-slate-50 border-slate-200/80 hover:text-slate-900'
      }`}
    >
      <Map className="w-3.5 h-3.5" />
      <span>Régions</span>
    </button>
  );
}
