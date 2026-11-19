import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trash2, History, Upload, Download, RotateCcw, Eye, X, Loader2,
  Check, FileText, ChevronDown, ChevronRight, Search, File
} from 'lucide-react';
import { resolveMediaUrl } from '../../services/apiClient';

export interface Specification {
  id?: number;
  antenna_type: string;
  height_mm: number;
  width_mm: number;
  thickness_mm: number;
  weight_dan: number;
}

export interface TerrainCalc {
  id?: number;
  terrain_type: string;
  section_material: string;
  material_specification: string;
  plot_metallique?: string;
  bras_de_deport?: string;
  mat_secondaire?: string;
  document_urls?: string;
  load_calculations?: any;
  documentation?: {
    document_urls: string;
    local_document_urls: string;
    document_types: string[];
  };
}

export interface Equipment {
  id: number;
  name: string;
  sub_elements: string;
  responsible_person: string;
  status: string;
  date: string | null;
  region: number | null;
  building_height: number | null;
  mast_height: number | null;
  reference_4g?: string | null;
  reference_5g?: string | null;
  comments: string;
  item_id: string;
  is_deleted: boolean;
  specifications: Specification[];
  terrain_calculations: TerrainCalc[];
  created_at: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: number;
  equipment: number;
  user_display: string;
  action: string;
  changed_at: string;
  snapshot: Record<string, unknown>;
}

export interface CatalogueFile {
  name: string;
  size: number;
  url: string;
  source?: string;
  category?: string;
  terrain_type?: string;
  region?: string;
  height?: string;
  rel_path: string;
}

export const formatDate = (d: string) => {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(d));
  } catch {
    return d;
  }
};

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

export const actionBadge = (action: string) => {
  const map: Record<string, { bg: string; label: string }> = {
    CREATE: { bg: 'bg-emerald-100 text-emerald-700', label: 'Création' },
    UPDATE: { bg: 'bg-blue-100 text-blue-700', label: 'Modification' },
    DELETE: { bg: 'bg-red-100 text-red-700', label: 'Suppression' },
    RESTORE: { bg: 'bg-amber-100 text-amber-700', label: 'Restauration' },
  };
  const m = map[action] || { bg: 'bg-gray-100 text-gray-700', label: action };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${m.bg}`}>
      {m.label}
    </span>
  );
};

// --- History Item ---

export const HistoryItem: React.FC<{
  entry: HistoryEntry;
  isLatest: boolean;
  onRestore: () => void;
}> = ({ entry, isLatest, onRestore }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 transition" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
          <div>
            <div className="flex items-center gap-2">
              {actionBadge(entry.action)}
              <span className="text-xs text-gray-500">{formatDate(entry.changed_at)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">par {entry.user_display}</p>
          </div>
        </div>
        {!isLatest && (
          <button onClick={e => { e.stopPropagation(); onRestore(); }}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition">
            <RotateCcw size={12} /> Restaurer
          </button>
        )}
      </div>
      {expanded && (
        <div className="border-t border-gray-200 p-3 bg-white">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-60 overflow-y-auto font-mono bg-gray-50 p-3 rounded-lg">
            {JSON.stringify(entry.snapshot, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

// --- Equipment Form ---

export const EquipmentForm: React.FC<{
  initial?: Partial<Equipment>;
  onSave: (data: Partial<Equipment>) => void;
  onCancel: () => void;
}> = ({ initial, onSave, onCancel }) => {
  const [formTab, setFormTab] = useState<'general' | 'antennas' | 'terrains'>('general');

  const [form, setForm] = useState<Partial<Equipment>>(() => {
    const defaultForm = initial || {
      name: '', sub_elements: '', responsible_person: '', status: '', region: null,
      building_height: null, mast_height: null, reference_4g: '', reference_5g: '', comments: '', item_id: '',
    };

    const specs = defaultForm.specifications || [];
    const spec4G = specs.find(s => s.antenna_type === '4G') || { antenna_type: '4G', height_mm: 0, width_mm: 0, thickness_mm: 0, weight_dan: 0 };
    const spec5G = specs.find(s => s.antenna_type === '5G') || { antenna_type: '5G', height_mm: 0, width_mm: 0, thickness_mm: 0, weight_dan: 0 };

    const calcs = defaultForm.terrain_calculations || [];
    const terrainTypes = ['0', 'II', 'IIIa', 'IIIb', 'IV'];
    const terrainCalcs = terrainTypes.map(tt => {
      const existing = calcs.find(c => c.terrain_type === tt);
      return {
        terrain_type: tt,
        section_material: existing?.section_material || '',
        material_specification: existing?.material_specification || '',
        plot_metallique: existing?.plot_metallique || '',
        bras_de_deport: existing?.bras_de_deport || '',
        mat_secondaire: existing?.mat_secondaire || '',
        document_urls: existing?.document_urls || existing?.documentation?.document_urls || '',
        load_calculations: existing?.load_calculations || {},
      };
    });

    return {
      ...defaultForm,
      specifications: [spec4G, spec5G],
      terrain_calculations: terrainCalcs as any[]
    };
  });

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const updateSpec = (type: '4G' | '5G', field: string, value: number) => {
    setForm(prev => {
      const specs = prev.specifications ? [...prev.specifications] : [];
      const idx = specs.findIndex(s => s.antenna_type === type);
      if (idx > -1) {
        specs[idx] = { ...specs[idx], [field]: value };
      }
      return { ...prev, specifications: specs };
    });
  };

  const updateCalc = (type: string, field: string, value: string) => {
    setForm(prev => {
      const calcs = prev.terrain_calculations ? [...prev.terrain_calculations] : [];
      const idx = calcs.findIndex(c => c.terrain_type === type);
      if (idx > -1) {
        calcs[idx] = { ...calcs[idx], [field]: value };
      }
      return { ...prev, terrain_calculations: calcs };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-secondary text-white px-6 py-4 flex justify-between items-center flex-shrink-0 rounded-t-2xl">
          <h3 className="text-lg font-semibold">{initial?.id ? 'Modifier l\'équipement' : 'Nouvel équipement'}</h3>
          <button onClick={onCancel} className="hover:bg-white/20 p-1 rounded"><X size={20} /></button>
        </div>

        {/* Form Tabs Switcher */}
        <div className="flex border-b border-gray-200 px-6 bg-gray-50 flex-shrink-0">
          {([
            ['general', 'Informations Générales'],
            ['antennas', 'Antennes 4G / 5G'],
            ['terrains', 'Calculs Terrains']
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFormTab(tab)}
              className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition -mb-px ${formTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 max-h-[60vh]">
          {formTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input value={form.name || ''} onChange={e => update('name', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Article</label>
                  <input value={form.item_id || ''} onChange={e => update('item_id', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sous-éléments</label>
                  <input value={form.sub_elements || ''} onChange={e => update('sub_elements', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                  <input value={form.responsible_person || ''} onChange={e => update('responsible_person', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Région</label>
                  <select value={form.region ?? ''} onChange={e => update('region', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition">
                    <option value="">—</option>
                    {[1, 2, 3, 4].map(r => <option key={r} value={r}>Région {r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hauteur bâtiment (m)</label>
                  <input type="number" step="0.01" value={form.building_height ?? ''} onChange={e => update('building_height', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hauteur mât (m)</label>
                  <input type="number" step="0.01" value={form.mast_height ?? ''} onChange={e => update('mast_height', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <input value={form.status || ''} onChange={e => update('status', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={form.date || ''} onChange={e => update('date', e.target.value || null)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commentaires</label>
                <textarea rows={3} value={form.comments || ''} onChange={e => update('comments', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition resize-none" />
              </div>
            </div>
          )}

          {formTab === 'antennas' && (
            <div className="space-y-4">
              {(['4G', '5G'] as const).map(band => {
                const spec = form.specifications?.find(s => s.antenna_type === band);
                const refKey = band === '4G' ? 'reference_4g' : 'reference_5g';
                return (
                  <div key={band} className="space-y-3">
                    <div className="border-b pb-2 pt-1">
                      <h4 className="font-bold text-gray-700 text-sm">Spécifications Antennes {band}</h4>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Modèle (Référence {band})</label>
                      <input value={(form as any)[refKey] || ''} onChange={e => update(refKey, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {([
                        ['height_mm', 'Hauteur (mm)'],
                        ['width_mm', 'Largeur (mm)'],
                        ['thickness_mm', 'Épaisseur (mm)'],
                        ['weight_dan', 'Poids (daN)'],
                      ] as const).map(([field, label]) => (
                        <div key={field}>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                          <input type="number" value={(spec as any)?.[field] ?? ''}
                            onChange={e => updateSpec(band, field, parseFloat(e.target.value) || 0)}
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {formTab === 'terrains' && (
            <div className="space-y-4">
              {['0', 'II', 'IIIa', 'IIIb', 'IV'].map(tt => {
                const calc = form.terrain_calculations?.find(c => c.terrain_type === tt);
                return (
                  <div key={tt} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-3">
                    <div className="flex justify-between items-center border-b pb-1.5">
                      <span className="text-xs font-bold text-primary uppercase">Terrain {tt}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Section Matériau</label>
                        <input value={calc?.section_material ?? ''}
                          onChange={e => updateCalc(tt, 'section_material', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Mat Principal</label>
                        <input value={calc?.material_specification ?? ''}
                          onChange={e => updateCalc(tt, 'material_specification', e.target.value)}
                          placeholder="e.g. 139x6.3mm"
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Plot Métallique</label>
                        <input value={calc?.plot_metallique ?? ''}
                          onChange={e => updateCalc(tt, 'plot_metallique', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Bras de déport</label>
                        <input value={calc?.bras_de_deport ?? ''}
                          onChange={e => updateCalc(tt, 'bras_de_deport', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Mat 5G</label>
                        <input value={calc?.mat_secondaire ?? ''}
                          onChange={e => updateCalc(tt, 'mat_secondaire', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">URLs des Documents Monday (séparés par des virgules)</label>
                      <input value={calc?.document_urls ?? ''}
                        onChange={e => updateCalc(tt, 'document_urls', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            Annuler
          </button>
          <button onClick={() => onSave(form)}
            className="px-5 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-lg hover:opacity-90 transition font-medium shadow-md">
            <Check size={16} className="inline mr-1" />
            {initial?.id ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Equipment Detail Panel ---

export const DetailPanel: React.FC<{
  eq: Equipment;
  files: CatalogueFile[];
  historyLog: HistoryEntry[];
  uploading: boolean;
  onClose: () => void;
  onFetchFiles: (eqId: number) => void;
  onFetchHistory: (eqId: number) => void;
  onFileUpload: (eqId: number, file: File) => void;
  onFileDelete: (eqId: number, relPath: string, displayName: string) => void;
  onRestoreVersion: (historyId: number) => void;
  onPreviewFile: (f: CatalogueFile, eqId: number) => void;
}> = ({
  eq,
  files,
  historyLog,
  uploading,
  onClose,
  onFetchFiles,
  onFetchHistory,
  onFileUpload,
  onFileDelete,
  onRestoreVersion,
  onPreviewFile,
}) => {
  const [panelTab, setPanelTab] = useState<'info' | 'files' | 'history'>('info');
  const [fileSearch, setFileSearch] = useState('');
  const [fileCategory, setFileCategory] = useState<'all' | 'terrain' | 'uploaded'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onFetchFiles(eq.id);
    onFetchHistory(eq.id);
  }, [eq.id, onFetchFiles, onFetchHistory]);

  const { terrainFiles, uploadedFiles, totalFiltered } = useMemo(() => {
    const q = fileSearch.trim().toLowerCase();
    const filtered = files.filter(f => {
      const matchesSearch =
        !q ||
        f.name.toLowerCase().includes(q) ||
        (f.terrain_type || '').toLowerCase().includes(q) ||
        (f.region || '').toLowerCase().includes(q) ||
        (f.height || '').toLowerCase().includes(q);
      const matchesCat = fileCategory === 'all' || f.category === fileCategory;
      return matchesSearch && matchesCat;
    });
    return {
      terrainFiles: filtered.filter(f => f.category === 'terrain'),
      uploadedFiles: filtered.filter(f => f.category !== 'terrain'),
      totalFiltered: filtered.length,
    };
  }, [files, fileSearch, fileCategory]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl bg-white shadow-2xl h-full overflow-y-auto animate-slide-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-secondary text-white px-6 py-5 sticky top-0 z-10">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold">{eq.name}</h3>
              <p className="text-white/80 text-sm mt-1">{eq.item_id || 'Sans ID'} • Région {eq.region || '—'}</p>
            </div>
            <button onClick={onClose} className="hover:bg-white/20 p-1.5 rounded-lg transition"><X size={22} /></button>
          </div>
          {/* Sub tabs */}
          <div className="flex gap-1 mt-4">
            {([['info', 'Détails', Eye], ['files', 'Fichiers', FileText], ['history', 'Historique', History]] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setPanelTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${panelTab === key ? 'bg-white text-primary' : 'text-white/70 hover:bg-white/10'}`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Info tab */}
          {panelTab === 'info' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Sous-éléments', eq.sub_elements],
                  ['Responsable', eq.responsible_person],
                  ['Statut', eq.status],
                  ['Date', eq.date || '—'],
                  ['Hauteur bâtiment', eq.building_height ? `${eq.building_height}m` : '—'],
                  ['Hauteur mât', eq.mast_height ? `${eq.mast_height}m` : '—'],
                  ['Référence 4G', eq.reference_4g || '—'],
                  ['Référence 5G', eq.reference_5g || '—'],
                ].map(([label, value]) => (
                  value !== '—' && value ? (
                    <div key={label as string} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="font-medium text-gray-800 text-sm">{value}</p>
                    </div>
                  ) : (label !== 'Référence 4G' && label !== 'Référence 5G') ? (
                    <div key={label as string} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="font-medium text-gray-800 text-sm">—</p>
                    </div>
                  ) : null
                ))}
              </div>
              {eq.comments && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Commentaires</p>
                  <p className="text-sm text-gray-700">{eq.comments}</p>
                </div>
              )}

              {/* Specifications */}
              {eq.specifications.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2 text-sm">Spécifications antennes</h4>
                  <div className="space-y-2">
                    {eq.specifications.map(s => (
                      <div key={s.id} className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                        <span className="inline-block px-2 py-0.5 bg-blue-200 text-blue-800 rounded text-xs font-bold mb-1">{s.antenna_type}</span>
                        <p className="text-sm text-gray-700">
                          {s.height_mm}×{s.width_mm}×{s.thickness_mm} mm — {s.weight_dan} daN
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Terrain calculations */}
              {eq.terrain_calculations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2 text-sm">Calculs de terrain</h4>
                  <div className="space-y-2">
                    {eq.terrain_calculations.map(c => (
                      <div key={c.id} className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                        <span className="inline-block px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-xs font-bold mb-1">Terrain {c.terrain_type}</span>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-xs text-gray-700">
                          {c.section_material && <div className="col-span-2"><span className="text-gray-500">Matériau:</span> {c.section_material}</div>}
                          {c.material_specification && <div><span className="text-gray-500">Mat Principal:</span> {c.material_specification}</div>}
                          {c.plot_metallique && <div><span className="text-gray-500">Plot Métal.:</span> {c.plot_metallique}</div>}
                          {c.bras_de_deport && <div><span className="text-gray-500">Bras:</span> {c.bras_de_deport}</div>}
                          {c.mat_secondaire && <div><span className="text-gray-500">Mat Sec.:</span> {c.mat_secondaire}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 pt-2">
                Créé le {formatDate(eq.created_at)} • Modifié le {formatDate(eq.updated_at)}
              </p>
            </div>
          )}

          {/* Files tab */}
          {panelTab === 'files' && (
            <div className="space-y-4">
              {/* Local search & category filters (no API calls on keystroke) */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2.5 border border-gray-200">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={fileSearch}
                    placeholder="Filtrer les fichiers..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
                    onChange={e => setFileSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  {([
                    ['all', 'Tous'],
                    ['terrain', 'Monday / Terrain'],
                    ['uploaded', 'Téléversés']
                  ] as const).map(([cat, label]) => (
                    <button
                      key={cat}
                      onClick={() => setFileCategory(cat)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${fileCategory === cat
                        ? 'bg-primary border-primary text-white'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-700 text-sm">Fichiers du catalogue</h4>
                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) onFileUpload(eq.id, f);
                    }}
                  />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:opacity-90 transition disabled:opacity-50">
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Téléverser
                  </button>
                </div>
              </div>

              {totalFiltered === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FileText size={36} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Aucun fichier correspondant</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {terrainFiles.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200/50 uppercase tracking-wider">
                        Fichiers de Calcul Terrain (Monday.com)
                      </h5>
                      {terrainFiles.map(f => (
                        <div key={f.url} onClick={() => onPreviewFile(f, eq.id)} className="flex items-center justify-between bg-white border border-gray-200 hover:bg-gray-50 rounded-xl p-3 transition group cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-amber-100/60 rounded-lg flex items-center justify-center">
                              <FileText size={18} className="text-amber-700" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800 break-all">{f.name}</p>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">Terrain {f.terrain_type}</span>
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">Région {f.region}</span>
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">H. {f.height}</span>
                                <span className="text-[10px] text-gray-400 font-medium">({formatFileSize(f.size)})</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
                            <a href={resolveMediaUrl(f.url)} target="_blank" rel="noreferrer"
                              className="p-1.5 hover:bg-primary/10 rounded-lg transition text-primary">
                              <Download size={16} />
                            </a>
                            <button onClick={() => onFileDelete(eq.id, f.rel_path, f.name)}
                              className="p-1.5 hover:bg-red-50 rounded-lg transition text-red-500">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-primary bg-primary/5 px-2.5 py-1 rounded border border-primary/10 uppercase tracking-wider">
                        Fichiers Manuellement Téléversés
                      </h5>
                      {uploadedFiles.map(f => (
                        <div key={f.url} onClick={() => onPreviewFile(f, eq.id)} className="flex items-center justify-between bg-white border border-gray-200 hover:bg-gray-50 rounded-xl p-3 transition group cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                              <File size={18} className="text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800 break-all">{f.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{formatFileSize(f.size)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
                            <a href={resolveMediaUrl(f.url)} target="_blank" rel="noreferrer"
                              className="p-1.5 hover:bg-primary/10 rounded-lg transition text-primary">
                              <Download size={16} />
                            </a>
                            <button onClick={() => onFileDelete(eq.id, f.rel_path, f.name)}
                              className="p-1.5 hover:bg-red-50 rounded-lg transition text-red-500">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* History tab */}
          {panelTab === 'history' && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-700">Historique des versions</h4>
              {historyLog.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Aucun historique disponible</p>
              ) : (
                <div className="space-y-2">
                  {historyLog.map((h, i) => (
                    <HistoryItem key={h.id} entry={h} isLatest={i === 0} onRestore={() => onRestoreVersion(h.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

