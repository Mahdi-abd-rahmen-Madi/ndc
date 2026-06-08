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
    <div className="bdtopo-control absolute top-[68px] right-4 bg-white rounded-lg shadow-lg z-[1000] min-w-[150px]">
      <button
        onClick={onToggle}
        className={`control-btn flex items-center gap-2 w-full p-2.5 bg-gradient-to-r from-primary to-secondary text-white border-none cursor-pointer font-semibold text-sm transition-all hover:-translate-y-px hover:shadow-lg ${
          visible ? 'rounded-t-lg' : 'rounded-lg'
        }`}
      >
        <Building className="icon text-base" />
        <span>BDTOPO</span>
        {visible ? <EyeOff className="w-4 h-4 ml-auto" /> : <Eye className="w-4 h-4 ml-auto" />}
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
