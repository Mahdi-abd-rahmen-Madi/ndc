// BDTOPOControls component

import { Building, Eye, EyeOff } from 'lucide-react';
import type { BDTOPOControlsProps } from '../utils/types';

export default function BDTOPOControls({
  visible,
  onToggle,
  opacity,
  onOpacityChange,
  showDensity,
  onDensityToggle,
  colorByHeight,
  onHeightColoringToggle,
}: BDTOPOControlsProps) {
  return (
    <div className="bdtopo-control absolute top-16 right-3 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/80 z-[1000] min-w-[150px] overflow-hidden">
      <button
        onClick={onToggle}
        className={`control-btn flex items-center gap-2 w-full px-3.5 py-2 text-xs font-semibold cursor-pointer transition-all ${
          visible 
            ? 'bg-indigo-600 text-white shadow-xs' 
            : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <Building className="w-3.5 h-3.5" />
        <span>BDTOPO</span>
        {visible ? <EyeOff className="w-3.5 h-3.5 ml-auto opacity-80" /> : <Eye className="w-3.5 h-3.5 ml-auto text-slate-400" />}
      </button>

      {visible && (
        <div className="bdtopo-options p-3 border-t border-gray-200">
          <div className="bdtopo-option mb-2 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 flex-1">
              <input
                type="checkbox"
                checked={showDensity}
                onChange={(e) => onDensityToggle(e.target.checked)}
                className="m-0"
              />
              <span>Afficher la densité</span>
            </label>
          </div>

          <div className="bdtopo-option mb-2 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 flex-1">
              <input
                type="checkbox"
                checked={colorByHeight}
                onChange={(e) => onHeightColoringToggle(e.target.checked)}
                className="m-0"
              />
              <span>Colorier par hauteur</span>
            </label>
          </div>

          <div className="bdtopo-option mb-2 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 flex-1">
              <span>Opacité</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
              className="w-20"
            />
          </div>
        </div>
      )}
    </div>
  );
}
