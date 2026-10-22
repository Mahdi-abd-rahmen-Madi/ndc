import React, { useState } from 'react';
import { Server, Radio, Zap, Check, Trash2 } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { EquipmentOptionCard } from '../../ui/EquipmentOptionCard';
import type { BaieReference, SelectedBaieItem } from '../types';

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
    id: 'orange_baie_radio_rb6601_outdoor',
    name: 'Baie radio RB6601 OUTDOOR',
    reference: 'RB6601 OUTDOOR',
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
    id: 'orange_baie_radio_byod_indoor',
    name: 'Baie radio BYOD INDOOR',
    reference: 'BYOD INDOOR',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '2000x600x600mm',
    height: 2000,
    width: 600,
    depth: 600,
    weight: 150,
    operator: 'orange'
  },
  // 2. Énergie & Raccordement
  {
    id: 'orange_baie_energie_delta_outdoor',
    name: 'Baie énergie DELTA OUTDOOR',
    reference: 'DELTA OUTDOOR',
    category: 'energie',
    category_label: 'Énergie & Raccordement',
    dimensions: '1600x750x750mm',
    height: 1600,
    width: 750,
    depth: 750,
    weight: 320,
    operator: 'orange'
  },
  {
    id: 'orange_baie_energie_eltek_outdoor',
    name: 'Baie énergie ELTEK OUTDOOR',
    reference: 'ELTEK OUTDOOR',
    category: 'energie',
    category_label: 'Énergie & Raccordement',
    dimensions: '1600x750x750mm',
    height: 1600,
    width: 750,
    depth: 750,
    weight: 310,
    operator: 'orange'
  },
  {
    id: 'orange_coffret_ac_distribution',
    name: 'Coffret AC Distribution',
    reference: 'COFFRET AC',
    category: 'distribution',
    category_label: 'Énergie & Raccordement',
    dimensions: '600x400x250mm',
    height: 600,
    width: 400,
    depth: 250,
    weight: 25,
    operator: 'orange'
  }
];

export interface BaieEquipmentToggleProps {
  hasBaie: boolean;
  setHasBaie: (val: boolean) => void;
  baieItems: SelectedBaieItem[];
  setBaieItems?: (val: SelectedBaieItem[]) => void;
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
  setBaieRadio,
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

  const matchesCategory = (itemCategory: string | undefined, targetCat: string) => {
    if (targetCat === 'radio') return itemCategory === 'radio' || itemCategory === 'radio_trans';
    if (targetCat === 'energie') return itemCategory === 'energie' || itemCategory === 'distribution' || itemCategory === 'raccordement';
    return itemCategory === targetCat;
  };

  const handleToggleItem = (item: BaieReference) => {
    if (!setBaieItems) return;
    const isCurrentSelected = baieItems.some(i => i.referenceId === item.id);
    let next: SelectedBaieItem[];
    if (isCurrentSelected) {
      next = baieItems.filter(i => i.referenceId !== item.id);
    } else {
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
      {/* Onglets des 2 Catégories */}
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

      {/* Liste des équipements */}
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

      {/* Synthèse globale */}
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

export default BaieEquipmentToggle;
