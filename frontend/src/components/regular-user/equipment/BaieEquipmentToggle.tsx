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
    vendor: 'ERICSSON',
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
    vendor: 'ERICSSON',
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
    vendor: 'ERICSSON',
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
    id: 'orange_baie_radio_rbs6201',
    name: 'Baie radio RBS 6201',
    reference: 'RBS 6201',
    vendor: 'ERICSSON',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '1435x600x483mm',
    height: 1435,
    width: 600,
    depth: 483,
    weight: 70,
    operator: 'orange'
  },
  {
    id: 'orange_baie_radio_rbs6102',
    name: 'Baie radio RBS 6102',
    reference: 'RBS 6102',
    vendor: 'ERICSSON',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '1450x1300x700mm',
    height: 1450,
    width: 1300,
    depth: 700,
    weight: 330,
    operator: 'orange'
  },
  {
    id: 'orange_baie_tlti_fg2_radio_trans',
    name: 'Baie TLTI FG2 RADIO /TRANS',
    reference: 'FG2 RADIO /TRANS',
    vendor: 'TLTI',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '1650x855x750mm',
    height: 1650,
    width: 855,
    depth: 750,
    weight: 93,
    operator: 'orange'
  },
  // 2. Énergie & Raccordement
  {
    id: 'orange_baie_energie_walkyrie_t3_18kw',
    name: 'Baie énergie Outdoor WALKYRIE T3 18kw',
    reference: 'WALKYRIE T3 18kw',
    vendor: 'WALKYRIE',
    category: 'energie',
    category_label: 'Énergie (-48V)',
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
    vendor: 'ELTEK',
    category: 'energie',
    category_label: 'Énergie (-48V)',
    dimensions: '1200x700x770mm',
    height: 1200,
    width: 700,
    depth: 770,
    weight: 150,
    operator: 'orange'
  },
  {
    id: 'orange_baie_tlti_fg2_tgbt_48v',
    name: 'Baie TLTI FG2 TGBT /48V',
    reference: 'FG2 TGBT /48V',
    vendor: 'TLTI',
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
    vendor: 'TLTI',
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
    vendor: 'SEIFEL',
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
    vendor: 'TLTI',
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
          const isWalkyrie = item.id === 'orange_baie_energie_walkyrie_t3_18kw' || item.name.toLowerCase().includes('walkyrie') || item.name.toLowerCase().includes('valkyrie');

          const subtitleParts: string[] = [];
          if (item.dimensions) subtitleParts.push(item.dimensions);
          if (item.weight) subtitleParts.push(`${item.weight} kg`);
          const subtitle = subtitleParts.join(' • ');

          return (
            <EquipmentOptionCard
              key={item.id}
              title={item.name}
              isSelected={isSelected}
              onToggle={() => handleToggleItem(item)}
              selectionType="radio"
              vendorBadge={item.vendor}
              subtitle={subtitle || undefined}
              badgeText={item.category_label || item.category}
              badgeClass={getCategoryColor(item.category)}
              quantity={qty}
              onQuantityChange={(val) => handleSetItemQty(item, val)}
              color="orange"
              className={isWalkyrie ? 'col-span-full' : ''}
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
