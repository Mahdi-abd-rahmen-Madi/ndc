import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, Trash2, History, Plus, Edit3, Upload, Download,
  RotateCcw, Eye, X, Loader2, AlertTriangle, Check, FileText,
  ChevronDown, ChevronRight, Search, RefreshCw, Archive, Undo2,
  Trash, File, Inbox, Clock, CheckCircle2, MessageSquare
} from 'lucide-react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/geodata/antenna-equipment`;

// --- Types ---

interface Specification {
  id?: number;
  antenna_type: string;
  height_mm: number;
  width_mm: number;
  thickness_mm: number;
  weight_dan: number;
}

interface TerrainCalc {
  id?: number;
  terrain_type: string;
  section_material: string;
  material_specification: string;
  document_urls?: string;
  load_calculations?: any;
  documentation?: {
    document_urls: string;
    local_document_urls: string;
    document_types: string[];
  };
}

interface Equipment {
  id: number;
  name: string;
  sub_elements: string;
  responsible_person: string;
  status: string;
  date: string | null;
  region: number | null;
  building_height: number | null;
  mast_height: number | null;
  comments: string;
  item_id: string;
  is_deleted: boolean;
  specifications: Specification[];
  terrain_calculations: TerrainCalc[];
  created_at: string;
  updated_at: string;
}

interface HistoryEntry {
  id: number;
  equipment: number;
  user_display: string;
  action: string;
  changed_at: string;
  snapshot: Record<string, unknown>;
}

interface CatalogueFile {
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

interface HeightRequest {
  id: number;
  requester_name: string;
  requester_email: string;
  requested_building_height: number;
  mast_height: number;
  montage_type: string;
  terrain_type: string;
  region: number | null;
  address: string;
  description: string;
  status: string;
  status_display: string;
  admin_notes: string;
  created_at: string;
}

// --- Main Component ---

export default function CatalogueManagement() {
  const [activeTab, setActiveTab] = useState<'list' | 'trash' | 'history' | 'requests'>('list');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [trashItems, setTrashItems] = useState<Equipment[]>([]);
  const [requests, setRequests] = useState<HeightRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Detail / edit states
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  const [historyEquipmentId, setHistoryEquipmentId] = useState<number | null>(null);
  const [files, setFiles] = useState<CatalogueFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [previewFile, setPreviewFile] = useState<CatalogueFile | null>(null);
  const [previewEquipmentId, setPreviewEquipmentId] = useState<number | null>(null);

  // --- API helpers ---

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchEquipment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur de chargement');
      const data = await res.json();
      setEquipment(data.results || data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/?only_deleted=true`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur de chargement');
      const data = await res.json();
      setTrashItems(data.results || data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (eqId: number) => {
    setHistoryEquipmentId(eqId);
    try {
      const res = await fetch(`${API_BASE}/${eqId}/history/`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur de chargement de l\'historique');
      const data = await res.json();
      setHistoryLog(data);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }, []);

  const fetchFiles = useCallback(async (eqId: number) => {
    try {
      const res = await fetch(`${API_BASE}/${eqId}/list_files/`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur');
      const data = await res.json();
      setFiles(data);
    } catch {
      setFiles([]);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the root geodata path
      const reqUrl = API_BASE.replace('/antenna-equipment', '/height-requests/');
      const res = await fetch(reqUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur de chargement des demandes');
      const data = await res.json();
      setRequests(data.results || data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial data based on tab
  useEffect(() => {
    if (activeTab === 'list') fetchEquipment();
    else if (activeTab === 'trash') fetchTrash();
    else if (activeTab === 'requests') fetchRequests();
  }, [activeTab, fetchEquipment, fetchTrash, fetchRequests]);

  // --- Actions ---

  const handleSoftDelete = async (eq: Equipment) => {
    if (!confirm(`Voulez-vous déplacer "${eq.name}" vers la corbeille ?`)) return;
    try {
      const res = await fetch(`${API_BASE}/${eq.id}/soft_delete/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Erreur de suppression');
      showToast('Déplacé vers la corbeille', 'success');
      fetchEquipment();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleUndelete = async (eq: Equipment) => {
    try {
      const res = await fetch(`${API_BASE}/${eq.id}/undelete/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Erreur de restauration');
      showToast('Restauré depuis la corbeille', 'success');
      fetchTrash();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handlePermanentDelete = async (eq: Equipment) => {
    if (!confirm(`⚠️ Supprimer DÉFINITIVEMENT "${eq.name}" ? Cette action est irréversible.`)) return;
    try {
      const res = await fetch(`${API_BASE}/${eq.id}/permanent_delete/`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.status !== 204 && !res.ok) throw new Error('Erreur');
      showToast('Supprimé définitivement', 'success');
      fetchTrash();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleRestoreVersion = async (historyId: number) => {
    if (!historyEquipmentId) return;
    if (!confirm('Restaurer cette version ? L\'état actuel sera sauvegardé dans l\'historique.')) return;
    try {
      const res = await fetch(`${API_BASE}/${historyEquipmentId}/restore/${historyId}/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Erreur de restauration');
      showToast('Version restaurée avec succès', 'success');
      fetchHistory(historyEquipmentId);
      fetchEquipment();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleFileUpload = async (eqId: number, file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/${eqId}/upload_file/`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Erreur de téléversement');
      showToast('Fichier téléversé', 'success');
      fetchFiles(eqId);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = async (eqId: number, relPath: string, displayName: string) => {
    if (!confirm(`Supprimer le fichier "${displayName}" ?`)) return;
    try {
      const encodedPath = encodeURIComponent(relPath);
      const res = await fetch(`${API_BASE}/${eqId}/delete_file/${encodedPath}/`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur');
      showToast('Fichier supprimé', 'success');
      fetchFiles(eqId);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleSaveEquipment = async (data: Partial<Equipment>, isNew: boolean) => {
    try {
      const url = isNew ? `${API_BASE}/` : `${API_BASE}/${data.id}/`;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(errData) || 'Erreur');
      }
      showToast(isNew ? 'Équipement créé' : 'Équipement mis à jour', 'success');
      setShowCreateForm(false);
      setEditingEquipment(null);
      fetchEquipment();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleUpdateRequestStatus = async (reqId: number, status: string, adminNotes: string) => {
    try {
      const reqUrl = API_BASE.replace('/antenna-equipment', `/height-requests/${reqId}/update_status/`);
      const res = await fetch(reqUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: adminNotes }),
      });
      if (!res.ok) throw new Error('Erreur lors de la mise à jour');
      showToast('Statut mis à jour et notification envoyée', 'success');
      fetchRequests();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // --- Filter ---
  const filteredEquipment = equipment.filter(eq =>
    eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (eq.item_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (eq.responsible_person || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Render Helpers ---

  const formatDate = (d: string) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(d));
    } catch {
      return d;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const actionBadge = (action: string) => {
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

  // ========== SUB-COMPONENTS ==========

  // --- Equipment Form ---
  const EquipmentForm = ({ initial, onSave, onCancel }: {
    initial?: Partial<Equipment>;
    onSave: (data: Partial<Equipment>) => void;
    onCancel: () => void;
  }) => {
    const [formTab, setFormTab] = useState<'general' | 'antennas' | 'terrains'>('general');
    
    const [form, setForm] = useState<Partial<Equipment>>(() => {
      const defaultForm = initial || {
        name: '', sub_elements: '', responsible_person: '', status: '', region: null,
        building_height: null, mast_height: null, comments: '', item_id: '',
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
                className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition -mb-px ${
                  formTab === tab
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
                <div className="border-b pb-2">
                  <h4 className="font-bold text-gray-700 text-sm">Spécifications Antennes 4G</h4>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Hauteur (mm)</label>
                    <input type="number" value={form.specifications?.find(s => s.antenna_type === '4G')?.height_mm ?? ''}
                      onChange={e => updateSpec('4G', 'height_mm', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Largeur (mm)</label>
                    <input type="number" value={form.specifications?.find(s => s.antenna_type === '4G')?.width_mm ?? ''}
                      onChange={e => updateSpec('4G', 'width_mm', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Épaisseur (mm)</label>
                    <input type="number" value={form.specifications?.find(s => s.antenna_type === '4G')?.thickness_mm ?? ''}
                      onChange={e => updateSpec('4G', 'thickness_mm', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Poids (daN)</label>
                    <input type="number" value={form.specifications?.find(s => s.antenna_type === '4G')?.weight_dan ?? ''}
                      onChange={e => updateSpec('4G', 'weight_dan', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                </div>

                <div className="border-b pb-2 pt-2">
                  <h4 className="font-bold text-gray-700 text-sm">Spécifications Antennes 5G</h4>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Hauteur (mm)</label>
                    <input type="number" value={form.specifications?.find(s => s.antenna_type === '5G')?.height_mm ?? ''}
                      onChange={e => updateSpec('5G', 'height_mm', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Largeur (mm)</label>
                    <input type="number" value={form.specifications?.find(s => s.antenna_type === '5G')?.width_mm ?? ''}
                      onChange={e => updateSpec('5G', 'width_mm', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Épaisseur (mm)</label>
                    <input type="number" value={form.specifications?.find(s => s.antenna_type === '5G')?.thickness_mm ?? ''}
                      onChange={e => updateSpec('5G', 'thickness_mm', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Poids (daN)</label>
                    <input type="number" value={form.specifications?.find(s => s.antenna_type === '5G')?.weight_dan ?? ''}
                      onChange={e => updateSpec('5G', 'weight_dan', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                </div>
              </div>
            )}

            {formTab === 'terrains' && (
              <div className="space-y-4">
                {['0', 'II', 'IIIa', 'IIIb', 'IV'].map(tt => (
                  <div key={tt} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-3">
                    <div className="flex justify-between items-center border-b pb-1.5">
                      <span className="text-xs font-bold text-primary uppercase">Terrain {tt}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Section Matériau</label>
                        <input value={form.terrain_calculations?.find(c => c.terrain_type === tt)?.section_material ?? ''}
                          onChange={e => updateCalc(tt, 'section_material', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Spécification Matériau</label>
                        <input value={form.terrain_calculations?.find(c => c.terrain_type === tt)?.material_specification ?? ''}
                          onChange={e => updateCalc(tt, 'material_specification', e.target.value)}
                          placeholder="e.g. 139x6.3mm"
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">URLs des Documents Monday (séparés par des virgules)</label>
                      <input value={form.terrain_calculations?.find(c => c.terrain_type === tt)?.document_urls ?? ''}
                        onChange={e => updateCalc(tt, 'document_urls', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                  </div>
                ))}
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
  const DetailPanel = ({ eq, onClose }: { eq: Equipment; onClose: () => void }) => {
    const [panelTab, setPanelTab] = useState<'info' | 'files' | 'history'>('info');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
      fetchFiles(eq.id);
      fetchHistory(eq.id);
    }, [eq.id]);

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
                  ].map(([label, value]) => (
                    <div key={label as string} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="font-medium text-gray-800 text-sm">{value || '—'}</p>
                    </div>
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
                          <p className="text-sm text-gray-700">{c.section_material} — {c.material_specification}</p>
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
                {/* Search & Categories inside DetailPanel */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-2.5 border border-gray-200">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filtrer les fichiers..."
                      className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
                      onChange={e => {
                        const val = e.target.value.toLowerCase();
                        // Search filter handled locally or by filter
                        (window as any)._fileSearchVal = val;
                        // Trigger re-render by calling a force update style state change
                        fetchFiles(eq.id);
                      }}
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
                        onClick={() => {
                          (window as any)._fileCatVal = cat;
                          fetchFiles(eq.id);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${
                          ((window as any)._fileCatVal || 'all') === cat
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
                        if (f) handleFileUpload(eq.id, f);
                      }}
                    />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:opacity-90 transition disabled:opacity-50">
                      {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      Téléverser
                    </button>
                  </div>
                </div>

                {(() => {
                  const searchVal = (window as any)._fileSearchVal || '';
                  const catVal = (window as any)._fileCatVal || 'all';

                  const filtered = files.filter(f => {
                    const matchesSearch =
                      f.name.toLowerCase().includes(searchVal) ||
                      (f.terrain_type || '').toLowerCase().includes(searchVal) ||
                      (f.region || '').toLowerCase().includes(searchVal) ||
                      (f.height || '').toLowerCase().includes(searchVal);
                    const matchesCat = catVal === 'all' || f.category === catVal;
                    return matchesSearch && matchesCat;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-400">
                        <FileText size={36} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Aucun fichier correspondant</p>
                      </div>
                    );
                  }

                  const terrainFiles = filtered.filter(f => f.category === 'terrain');
                  const uploadedFiles = filtered.filter(f => f.category !== 'terrain');

                  return (
                    <div className="space-y-4">
                      {/* Section Terrain Files */}
                      {terrainFiles.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200/50 uppercase tracking-wider">
                            Fichiers de Calcul Terrain (Monday.com)
                          </h5>
                          {terrainFiles.map(f => (
                            <div key={f.url} onClick={() => { setPreviewFile(f); setPreviewEquipmentId(eq.id); }} className="flex items-center justify-between bg-white border border-gray-150 hover:bg-gray-50 rounded-xl p-3 transition group cursor-pointer">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-amber-100/60 rounded-lg flex items-center justify-center">
                                  <FileText size={18} className="text-amber-700" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-800 break-all">{f.name}</p>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                                      Terrain {f.terrain_type}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                                      Région {f.region}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">
                                      H. {f.height}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-medium">
                                      ({formatFileSize(f.size)})
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
                                <a href={`${import.meta.env.VITE_API_URL || ''}${f.url}`} target="_blank" rel="noreferrer"
                                  className="p-1.5 hover:bg-primary/10 rounded-lg transition text-primary">
                                  <Download size={16} />
                                </a>
                                <button onClick={() => handleFileDelete(eq.id, f.rel_path, f.name)}
                                  className="p-1.5 hover:bg-red-50 rounded-lg transition text-red-500">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Section Uploaded Files */}
                      {uploadedFiles.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-primary bg-primary/5 px-2.5 py-1 rounded border border-primary/10 uppercase tracking-wider">
                            Fichiers Manuellement Téléversés
                          </h5>
                          {uploadedFiles.map(f => (
                            <div key={f.url} onClick={() => { setPreviewFile(f); setPreviewEquipmentId(eq.id); }} className="flex items-center justify-between bg-white border border-gray-150 hover:bg-gray-50 rounded-xl p-3 transition group cursor-pointer">
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
                                <a href={`${import.meta.env.VITE_API_URL || ''}${f.url}`} target="_blank" rel="noreferrer"
                                  className="p-1.5 hover:bg-primary/10 rounded-lg transition text-primary">
                                  <Download size={16} />
                                </a>
                                <button onClick={() => handleFileDelete(eq.id, f.rel_path, f.name)}
                                  className="p-1.5 hover:bg-red-50 rounded-lg transition text-red-500">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
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
                      <HistoryItem key={h.id} entry={h} isLatest={i === 0} onRestore={() => handleRestoreVersion(h.id)} />
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

  // --- History Item ---
  const HistoryItem = ({ entry, isLatest, onRestore }: { entry: HistoryEntry; isLatest: boolean; onRestore: () => void }) => {
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

  // ========== MAIN RENDER ==========

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-slide-in
          ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {([
            ['list', 'Équipements', Database],
            ['requests', 'Demandes', Inbox],
            ['trash', 'Corbeille', Trash2],
          ] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === key ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon size={15} />{label}
              {key === 'trash' && trashItems.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded-full font-bold">{trashItems.length}</span>
              )}
              {key === 'requests' && requests.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-600 text-[10px] rounded-full font-bold">{requests.filter(r => r.status === 'pending').length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          {activeTab === 'list' && (
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition w-64" />
            </div>
          )}
          <button onClick={() => {
            if (activeTab === 'list') fetchEquipment();
            else if (activeTab === 'trash') fetchTrash();
            else if (activeTab === 'requests') fetchRequests();
          }}
            className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500"><RefreshCw size={16} /></button>
          {activeTab === 'list' && (
            <button onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-lg text-sm font-medium hover:opacity-90 transition shadow-md">
              <Plus size={16} /> Nouveau
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Statistics Cards */}
        {activeTab === 'list' && !loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200/80 flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Database size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Équipements</p>
                <p className="text-2xl font-black text-gray-800 mt-0.5">{equipment.length}</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200/80 flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Spécifications</p>
                <p className="text-2xl font-black text-gray-800 mt-0.5">
                  {equipment.reduce((acc, eq) => acc + (eq.specifications?.length || 0), 0)}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200/80 flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Archive size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Régions Actives</p>
                <p className="text-2xl font-black text-gray-800 mt-0.5">
                  {new Set(equipment.map(eq => eq.region).filter(Boolean)).size}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200/80 flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                <Trash2 size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider font-semibold">Corbeille</p>
                <p className="text-2xl font-black text-gray-800 mt-0.5">{trashItems.length}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-500">
            <AlertTriangle size={32} className="mb-2" />
            <p>{error}</p>
          </div>
        ) : activeTab === 'list' ? (
          /* Equipment List */
          filteredEquipment.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Database size={48} className="mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">Aucun équipement trouvé</p>
              <p className="text-sm mt-1">Créez votre premier équipement avec le bouton ci-dessus</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {/* Table header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <span>Nom</span>
                <span>Région</span>
                <span>Haut. bâtiment</span>
                <span>Haut. mât</span>
                <span>Responsable</span>
                <span>Créé le</span>
                <span>Actions</span>
              </div>
              {filteredEquipment.map(eq => (
                <div key={eq.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center bg-white hover:bg-primary/[0.02] border border-gray-100 hover:border-primary/20 rounded-xl px-4 py-3 transition cursor-pointer group"
                  onClick={() => {
                    setSelectedEquipment(eq);
                    fetchFiles(eq.id);
                    fetchHistory(eq.id);
                  }}>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{eq.name}</p>
                    {eq.item_id && <p className="text-xs text-gray-400 mt-0.5">{eq.item_id}</p>}
                  </div>
                  <span className="text-sm text-gray-600">{eq.region ? `Région ${eq.region}` : '—'}</span>
                  <span className="text-sm text-gray-600">{eq.building_height ? `${eq.building_height}m` : '—'}</span>
                  <span className="text-sm text-gray-600">{eq.mast_height ? `${eq.mast_height}m` : '—'}</span>
                  <span className="text-sm text-gray-600">{eq.responsible_person || '—'}</span>
                  <span className="text-xs text-gray-400">{formatDate(eq.created_at)}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditingEquipment(eq)} title="Modifier"
                      className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 transition"><Edit3 size={15} /></button>
                    <button onClick={() => handleSoftDelete(eq)} title="Supprimer"
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'requests' ? (
          /* Requests List */
          requests.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Inbox size={48} className="mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">Aucune demande reçue</p>
              <p className="text-sm mt-1">Les demandes de hauteur personnalisée apparaîtront ici</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid grid-cols-[1fr_1fr_1fr_1.5fr_1.5fr] gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <span>Demandeur</span>
                <span>Config</span>
                <span>Statut</span>
                <span>Date</span>
                <span>Actions & Notes</span>
              </div>
              {requests.map(req => (
                <div key={req.id} className="bg-white border border-gray-100 hover:border-primary/20 rounded-xl p-4 transition shadow-sm">
                  <div className="grid grid-cols-[1fr_1fr_1fr_1.5fr_1.5fr] gap-4 items-start">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{req.requester_name}</p>
                      <p className="text-xs text-gray-500">{req.requester_email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">H: {req.requested_building_height}m</p>
                      <p className="text-xs text-gray-500">{req.montage_type} • Terrain {req.terrain_type}</p>
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        req.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        req.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {req.status === 'pending' && <Clock size={12} className="mr-1" />}
                        {req.status === 'completed' && <CheckCircle2 size={12} className="mr-1" />}
                        {req.status_display}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(req.created_at)}
                    </div>
                    <div className="flex flex-col gap-2">
                      <select
                        value={req.status}
                        onChange={(e) => handleUpdateRequestStatus(req.id, e.target.value, req.admin_notes)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-primary bg-gray-50"
                      >
                        <option value="pending">En attente</option>
                        <option value="processing">En cours</option>
                        <option value="completed">Terminé</option>
                        <option value="rejected">Rejeté</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-bold uppercase text-gray-400 mb-1 flex items-center gap-1">
                        <MessageSquare size={10} /> Message du demandeur
                      </p>
                      <p className="text-xs text-gray-700">{req.description || <span className="italic opacity-50">Aucun message</span>}</p>
                    </div>
                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 relative group">
                      <p className="text-[10px] font-bold uppercase text-blue-400 mb-1">Notes Génie Civil (interne)</p>
                      <textarea
                        defaultValue={req.admin_notes}
                        onBlur={(e) => {
                          if (e.target.value !== req.admin_notes) {
                            handleUpdateRequestStatus(req.id, req.status, e.target.value);
                          }
                        }}
                        className="w-full bg-transparent text-xs text-gray-700 resize-none outline-none"
                        rows={2}
                        placeholder="Ajouter une note..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Trash */
          trashItems.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Archive size={48} className="mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">La corbeille est vide</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {trashItems.map(eq => (
                <div key={eq.id} className="flex items-center justify-between bg-white border border-red-100 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-700 text-sm">{eq.name}</p>
                    <p className="text-xs text-gray-400">{eq.item_id || 'Sans ID'} • Région {eq.region || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleUndelete(eq)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-100 transition">
                      <Undo2 size={13} /> Restaurer
                    </button>
                    <button onClick={() => handlePermanentDelete(eq)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition">
                      <Trash size={13} /> Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Detail slide-over */}
      {selectedEquipment && (
        <DetailPanel eq={selectedEquipment} onClose={() => setSelectedEquipment(null)} />
      )}

      {/* Create / Edit form */}
      {(showCreateForm || editingEquipment) && (
        <EquipmentForm
          initial={editingEquipment || undefined}
          onSave={data => handleSaveEquipment(data, !editingEquipment)}
          onCancel={() => { setShowCreateForm(false); setEditingEquipment(null); }}
        />
      )}

      {/* Document Preview Modal */}
      {previewFile && previewEquipmentId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col m-4 overflow-hidden animate-zoom-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-secondary text-white px-6 py-5 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FileText size={20} />
                  Aperçu : {previewFile.name}
                </h3>
                <p className="text-xs text-white/80 mt-0.5">
                  Format: {previewFile.name.endsWith('.docx') ? 'Microsoft Word (.docx)' : previewFile.name.endsWith('.rtd') ? 'Robot Structural Analysis (.rtd)' : previewFile.name.endsWith('.rtf') ? 'Rich Text Format (.rtf)' : 'Document'} • {formatFileSize(previewFile.size)}
                </p>
              </div>
              <button onClick={() => setPreviewFile(null)} className="hover:bg-white/20 p-1.5 rounded-lg"><X size={20} /></button>
            </div>

            {/* Body */}
            <div className="flex-1 bg-gray-100 flex p-6 gap-6 overflow-hidden">
              {/* Left side: Simulated document page view */}
              <div className="flex-1 bg-white shadow-inner rounded-xl border border-gray-200 overflow-y-auto p-8 flex flex-col">
                <div className="flex items-center justify-between border-b pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold">
                      {previewFile.name.endsWith('.docx') ? 'W' : previewFile.name.endsWith('.rtd') ? 'R' : 'DOC'}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">{previewFile.name}</h4>
                      <p className="text-xs text-gray-400">Généré automatiquement</p>
                    </div>
                  </div>
                  {previewFile.terrain_type && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded text-xs font-bold">
                      Terrain {previewFile.terrain_type}
                    </span>
                  )}
                </div>

                <div className="space-y-4 flex-1">
                  <div className="h-6 bg-gray-100 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                  <div className="border-t border-dashed my-6 pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Métadonnées du calcul :</p>
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                      <div>• Nom du montage : <span className="font-medium text-gray-800">{previewFile.name.split('.')[0]}</span></div>
                      {previewFile.region && <div>• Région de vent : <span className="font-medium text-gray-800">Région {previewFile.region}</span></div>}
                      {previewFile.height && <div>• Hauteur de calcul : <span className="font-medium text-gray-800">{previewFile.height}m</span></div>}
                      {previewFile.terrain_type && <div>• Catégorie de terrain : <span className="font-medium text-gray-800">Terrain {previewFile.terrain_type}</span></div>}
                    </div>
                  </div>
                  <div className="h-40 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                    <FileText size={32} className="mb-2 opacity-50 text-primary" />
                    <p className="text-xs font-semibold text-gray-600">Aperçu du contenu structurel</p>
                    <p className="text-[10px] px-4 text-center mt-1">Le fichier est disponible en téléchargement local et est synchronisé avec les outils CAO.</p>
                  </div>
                </div>
              </div>

              {/* Right side: Sidebar info & actions */}
              <div className="w-80 bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wider border-b pb-2">Détails du document</h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between"><span className="text-gray-400">Source:</span> <span className="font-semibold text-gray-700">{previewFile.source || 'Import Monday'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Catégorie:</span> <span className="font-semibold text-gray-700">{previewFile.category === 'terrain' ? 'Calcul Terrain' : 'Manuel'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Taille:</span> <span className="font-semibold text-gray-700">{formatFileSize(previewFile.size)}</span></div>
                  </div>

                  <div className="bg-primary/5 rounded-xl p-3.5 border border-primary/10 text-xs text-primary mt-4">
                    <strong>Version Control :</strong> Toute suppression de ce fichier ou remplacement est enregistré dans l'historique et pourra être annulé.
                  </div>
                </div>

                <div className="space-y-2">
                  <a href={`${import.meta.env.VITE_API_URL || ''}${previewFile.url}`} download target="_blank" rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-primary to-secondary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-md">
                    <Download size={16} /> Télécharger
                  </a>
                  <button
                    onClick={() => {
                      handleFileDelete(previewEquipmentId, previewFile.rel_path, previewFile.name);
                      setPreviewFile(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition"
                  >
                    <Trash2 size={16} /> Supprimer le fichier
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
