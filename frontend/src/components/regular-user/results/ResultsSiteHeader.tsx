import React from 'react';
import { Layers, Wind, MapPin } from 'lucide-react';
import type { LookupResult } from '../types';

export interface ResultsSiteHeaderProps {
  lookupResult: LookupResult | null;
  selectedAddress: any;
  isSearching: boolean;
  nombreSecteurs?: number;
  showSectorsCount?: boolean;
}

export function ResultsSiteHeader({
  lookupResult,
  selectedAddress,
  isSearching,
  nombreSecteurs = 3,
  showSectorsCount = true
}: ResultsSiteHeaderProps) {
  return (
    <div className="mb-5 p-4 sm:p-5 bg-gradient-to-r from-white via-violet-50/20 to-white rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
      {/* Subtle decorative glow */}
      <div className="absolute -right-8 -top-8 w-40 h-40 bg-violet-400/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-4">
        {/* Top row: Title on left, Metric badges on right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Configuration du site
            </h2>
            {isSearching && (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-600"></span>
              </span>
            )}
          </div>

          {/* Badges grouped cleanly together */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {showSectorsCount && (
              <div className="bg-white rounded-xl px-3.5 py-2 border border-slate-200 shadow-2xs flex items-center gap-2.5 hover:border-violet-300 transition-all">
                <div className="p-1.5 bg-violet-50 rounded-lg text-violet-600 shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">Secteurs</p>
                  <p className="text-sm font-bold text-slate-900 leading-none">
                    {nombreSecteurs}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl px-3.5 py-2 border border-slate-200 shadow-2xs flex items-center gap-2.5 hover:border-blue-300 transition-all">
              <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                <Wind className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">Région de Vent</p>
                <p className="text-sm font-bold text-slate-900 leading-none">
                  {lookupResult?.detected_region ? `Région ${lookupResult.detected_region}` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row: Full address */}
        {selectedAddress && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50/90 border border-slate-200/80 text-xs text-slate-600 w-full shadow-2xs">
            <MapPin className="w-4 h-4 text-violet-600 shrink-0" />
            <span className="font-semibold text-slate-700 shrink-0">Adresse :</span>
            <span className="text-slate-800 font-medium whitespace-normal break-words sm:whitespace-nowrap sm:overflow-x-auto sm:scrollbar-none">
              {selectedAddress.name}, {selectedAddress.city}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResultsSiteHeader;
