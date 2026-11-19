import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Database, Trash2, Plus, Edit3, Download,
  X, Loader2, AlertTriangle, Check, FileText,
  Search, RefreshCw, Archive, Undo2,
  Trash, Inbox, Clock, CheckCircle2, MessageSquare
} from 'lucide-react';
import {
  Equipment,
  HistoryEntry,
  CatalogueFile,
  formatDate,
  formatFileSize,
  EquipmentForm,
  DetailPanel,
} from './catalogue/CataloguePanels';
import { apiClient, resolveMediaUrl } from '../services/apiClient';

const EQ_BASE = '/api/geodata/antenna-equipment';

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
      const data = await apiClient.get<any>(`${EQ_BASE}/`, { credentials: 'include' });
      setEquipment(data.results || data);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<any>(`${EQ_BASE}/?only_deleted=true`, { credentials: 'include' });
      setTrashItems(data.results || data);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (eqId: number) => {
    setHistoryEquipmentId(eqId);
    try {
      const data = await apiClient.get<HistoryEntry[]>(`${EQ_BASE}/${eqId}/history/`, { credentials: 'include' });
      setHistoryLog(data);
    } catch (e: any) {
      showToast(e.message || 'Erreur de chargement de l\'historique', 'error');
    }
  }, []);

  const fetchFiles = useCallback(async (eqId: number) => {
    try {
      const data = await apiClient.get<CatalogueFile[]>(`${EQ_BASE}/${eqId}/list_files/`, { credentials: 'include' });
      setFiles(data);
    } catch {
      setFiles([]);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<any>('/api/geodata/height-requests/', { credentials: 'include' });
      setRequests(data.results || data);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des demandes');
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
      await apiClient.post(`${EQ_BASE}/${eq.id}/soft_delete/`, {}, { credentials: 'include' });
      showToast('Déplacé vers la corbeille', 'success');
      fetchEquipment();
    } catch (e: any) {
      showToast(e.message || 'Erreur de suppression', 'error');
    }
  };

  const handleUndelete = async (eq: Equipment) => {
    try {
      await apiClient.post(`${EQ_BASE}/${eq.id}/undelete/`, {}, { credentials: 'include' });
      showToast('Restauré depuis la corbeille', 'success');
      fetchTrash();
    } catch (e: any) {
      showToast(e.message || 'Erreur de restauration', 'error');
    }
  };

  const handlePermanentDelete = async (eq: Equipment) => {
    if (!confirm(`⚠️ Supprimer DÉFINITIVEMENT "${eq.name}" ? Cette action est irréversible.`)) return;
    try {
      await apiClient.delete(`${EQ_BASE}/${eq.id}/permanent_delete/`, { credentials: 'include' });
      showToast('Supprimé définitivement', 'success');
      fetchTrash();
    } catch (e: any) {
      showToast(e.message || 'Erreur', 'error');
    }
  };

  const handleRestoreVersion = async (historyId: number) => {
    if (!historyEquipmentId) return;
    if (!confirm('Restaurer cette version ? L\'état actuel sera sauvegardé dans l\'historique.')) return;
    try {
      await apiClient.post(`${EQ_BASE}/${historyEquipmentId}/restore/${historyId}/`, {}, { credentials: 'include' });
      showToast('Version restaurée avec succès', 'success');
      fetchHistory(historyEquipmentId);
      fetchEquipment();
    } catch (e: any) {
      showToast(e.message || 'Erreur de restauration', 'error');
    }
  };

  const handleFileUpload = async (eqId: number, file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await apiClient.post(`${EQ_BASE}/${eqId}/upload_file/`, formData, { credentials: 'include' });
      showToast('Fichier téléversé', 'success');
      fetchFiles(eqId);
    } catch (e: any) {
      showToast(e.message || 'Erreur de téléversement', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = async (eqId: number, relPath: string, displayName: string) => {
    if (!confirm(`Supprimer le fichier "${displayName}" ?`)) return;
    try {
      const encodedPath = encodeURIComponent(relPath);
      await apiClient.delete(`${EQ_BASE}/${eqId}/delete_file/${encodedPath}/`, { credentials: 'include' });
      showToast('Fichier supprimé', 'success');
      fetchFiles(eqId);
    } catch (e: any) {
      showToast(e.message || 'Erreur', 'error');
    }
  };

  const handleSaveEquipment = async (data: Partial<Equipment>, isNew: boolean) => {
    try {
      if (isNew) {
        await apiClient.post(`${EQ_BASE}/`, data, { credentials: 'include' });
      } else {
        await apiClient.patch(`${EQ_BASE}/${data.id}/`, data, { credentials: 'include' });
      }
      showToast(isNew ? 'Équipement créé' : 'Équipement mis à jour', 'success');
      setShowCreateForm(false);
      setEditingEquipment(null);
      fetchEquipment();
    } catch (e: any) {
      showToast(e.message || 'Erreur', 'error');
    }
  };

  const handleUpdateRequestStatus = async (reqId: number, status: string, adminNotes: string) => {
    try {
      await apiClient.post(
        `/api/geodata/height-requests/${reqId}/update_status/`,
        { status, admin_notes: adminNotes },
        { credentials: 'include' }
      );
      showToast('Statut mis à jour et notification envoyée', 'success');
      fetchRequests();
    } catch (e: any) {
      showToast(e.message || 'Erreur lors de la mise à jour', 'error');
    }
  };

  // --- Filter ---
  const filteredEquipment = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return equipment;
    return equipment.filter(eq =>
      eq.name.toLowerCase().includes(q) ||
      (eq.item_id || '').toLowerCase().includes(q) ||
      (eq.responsible_person || '').toLowerCase().includes(q)
    );
  }, [equipment, searchQuery]);


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
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
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
        <DetailPanel
          eq={selectedEquipment}
          files={files}
          historyLog={historyLog}
          uploading={uploading}
          onClose={() => setSelectedEquipment(null)}
          onFetchFiles={fetchFiles}
          onFetchHistory={fetchHistory}
          onFileUpload={handleFileUpload}
          onFileDelete={handleFileDelete}
          onRestoreVersion={handleRestoreVersion}
          onPreviewFile={(f, eqId) => {
            setPreviewFile(f);
            setPreviewEquipmentId(eqId);
          }}
        />
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
                  <a href={resolveMediaUrl(previewFile.url)} download target="_blank" rel="noreferrer"
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
