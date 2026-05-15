// RegionControl component

import { Map } from 'lucide-react';
import type { RegionControlProps } from '../utils/types';

export default function RegionControl({ visible, onToggle }: RegionControlProps) {
  return (
    <button
      onClick={onToggle}
      className={`fixed top-20 right-4 px-4 py-3 bg-gradient-to-r from-primary to-secondary text-white border-none rounded-lg cursor-pointer font-semibold shadow-lg transition-all hover:-translate-y-px hover:shadow-xl z-[1000] flex items-center gap-2 ${
        visible ? 'ring-2 ring-white ring-offset-2' : ''
      }`}
    >
      <Map className="w-5 h-5" />
      <span>Regions</span>
    </button>
  );
}
