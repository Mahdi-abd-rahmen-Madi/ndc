import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Calendar,
  MapPin,
  Search,
  FileText,
  Download,
  ExternalLink,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Eye,
  Filter,
  User as UserIcon,
  Layers,
  FileCheck2,
  Image as ImageIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import imageCompression from 'browser-image-compression';

export interface CalculationHistoryItem {
  id: number;
  site_name: string;
  code_site: string;
  client_name: string;
  address: string;
  operator: string;
  pdf_url: string;
  created_at: string;
}

interface AccountViewProps {
  apiBaseUrl: string;
  userEmail: string | null;
  onLogout: () => void;
}

export default function AccountView({ apiBaseUrl, userEmail, onLogout }: AccountViewProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'history' | 'branding'>('history');

  // History state
  const [historyItems, setHistoryItems] = useState<CalculationHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<string>('all');

  // Branding & Logo state
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [logoUploadSuccess, setLogoUploadSuccess] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  // Fetch initial profile & history
  useEffect(() => {
    fetchProfile();
    fetchHistory();
  }, [apiBaseUrl]);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('ndc_auth_token');
      if (!token) return;
      const res = await fetch(`${apiBaseUrl}/api/user-profiles/me/`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.client_logo) {
          setClientLogoUrl(data.client_logo);
        }
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      setIsLoadingHistory(true);
      setHistoryError(null);
      const token = localStorage.getItem('ndc_auth_token');
      const res = await fetch(`${apiBaseUrl}/api/user-profiles/calculations_history/`, {
        headers: token ? { 'Authorization': `Token ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data);
      } else {
        setHistoryError('Impossible de charger l\'historique des calculs.');
      }
    } catch (err) {
      console.error('Failed to load calculations history:', err);
      setHistoryError('Erreur de connexion au serveur.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploadError(null);
    setLogoUploadSuccess(false);

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setLogoUploadError('Format invalide. Seuls les formats PNG et JPG sont acceptés.');
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setLogoUploadError('Fichier trop lourd (maximum 10 Mo).');
      e.target.value = '';
      return;
    }

    try {
      setIsLogoUploading(true);
      let fileToUpload = file;

      if (file.size > 1024 * 1024) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        };
        fileToUpload = await imageCompression(file, options);
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);

      const token = localStorage.getItem('ndc_auth_token');
      const res = await fetch(`${apiBaseUrl}/api/user-profiles/upload_logo/`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Token ${token}` } : {},
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setClientLogoUrl(data.client_logo);
        setLogoUploadSuccess(true);
        setTimeout(() => setLogoUploadSuccess(false), 4000);
      } else {
        const errText = await res.text();
        setLogoUploadError(`Erreur lors du téléversement (${res.status})`);
      }
    } catch (err) {
      setLogoUploadError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setIsLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm('Voulez-vous vraiment supprimer votre logo personnalisé ?')) return;
    try {
      setIsLogoUploading(true);
      const token = localStorage.getItem('ndc_auth_token');
      const res = await fetch(`${apiBaseUrl}/api/user-profiles/me/`, {
        method: 'PATCH',
        headers: {
          'Authorization': token ? `Token ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ client_logo: null })
      });
      if (res.ok) {
        setClientLogoUrl(null);
      }
    } catch (err) {
      console.error('Failed to remove logo:', err);
    } finally {
      setIsLogoUploading(false);
    }
  };

  const getFullPdfUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${apiBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Filtered history
  const filteredHistory = useMemo(() => {
    return historyItems.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        (item.code_site && item.code_site.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.site_name && item.site_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.address && item.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.client_name && item.client_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesOperator =
        selectedOperator === 'all' ||
        (item.operator && item.operator.toLowerCase() === selectedOperator.toLowerCase());

      return matchesSearch && matchesOperator;
    });
  }, [historyItems, searchQuery, selectedOperator]);

  // Unique operators for filters
  const operators = useMemo(() => {
    const set = new Set<string>();
    historyItems.forEach((i) => {
      if (i.operator) set.add(i.operator.toLowerCase());
    });
    return Array.from(set);
  }, [historyItems]);

  const resolvedLogoUrl = clientLogoUrl
    ? clientLogoUrl.startsWith('http') || clientLogoUrl.startsWith('data:')
      ? clientLogoUrl
      : `${apiBaseUrl}${clientLogoUrl.startsWith('/') ? '' : '/'}${clientLogoUrl}`
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-200/80 bg-white sticky top-0 z-30 px-6 sm:px-10 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/portail')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-lg transition-colors border border-slate-200/70"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour au Portail
          </button>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">Mon Compte Client</h1>
              <p className="text-[11px] text-slate-500">{userEmail || 'Gestion de votre espace'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onLogout}
            className="text-xs px-3 py-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200/80 transition-colors font-medium"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-10 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-8">
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2.5 border-b-2 transition-all ${activeTab === 'history'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
          >
            <FileText className="w-4 h-4" />
            Historique des Notes de Calcul
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200/80">
              {historyItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('branding')}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2.5 border-b-2 transition-all ${activeTab === 'branding'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
          >
            <Sparkles className="w-4 h-4" />
            Logo & Personnalisation du Document
            {resolvedLogoUrl && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>
        </div>

        {/* TAB 1: HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par code site, ville, adresse..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-400/20 focus:border-slate-400 transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                  <Filter className="w-3.5 h-3.5" />
                  Opérateur :
                </span>
                <button
                  onClick={() => setSelectedOperator('all')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors shrink-0 ${selectedOperator === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                >
                  Tous ({historyItems.length})
                </button>
                {operators.map((op) => (
                  <button
                    key={op}
                    onClick={() => setSelectedOperator(op)}
                    className={`px-3 py-1 text-xs font-semibold uppercase rounded-lg transition-colors shrink-0 ${selectedOperator === op
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                      }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>

            {/* List / Table */}
            {isLoadingHistory ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
                <span className="text-xs font-medium">Chargement de votre archive technique...</span>
              </div>
            ) : historyError ? (
              <div className="p-6 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200 text-center">
                {historyError}
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Aucune note de calcul trouvée</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  {searchQuery || selectedOperator !== 'all'
                    ? 'Aucun résultat ne correspond à vos filtres de recherche.'
                    : 'Les notes de calcul générées sur le portail s\'archiveront automatiquement ici.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredHistory.map((item) => {
                  const fullUrl = getFullPdfUrl(item.pdf_url);
                  return (
                    <div
                      key={item.id}
                      className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-600 shrink-0 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">
                              {item.code_site || 'Site sans référence'}
                            </span>
                            {item.site_name && (
                              <span className="text-xs text-slate-600 font-medium">
                                • {item.site_name}
                              </span>
                            )}
                            {item.operator && (
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase border ${item.operator.toLowerCase() === 'orange'
                                    ? 'bg-orange-50 border-orange-200 text-orange-800'
                                    : item.operator.toLowerCase() === 'free'
                                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                                      : 'bg-sky-50 border-sky-200 text-sky-800'
                                  }`}
                              >
                                {item.operator}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1.5 text-slate-400">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(item.created_at)}
                            </span>
                            {item.client_name && (
                              <span className="flex items-center gap-1.5 text-slate-600">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                {item.client_name}
                              </span>
                            )}
                            {item.address && (
                              <span className="flex items-center gap-1.5 text-slate-500 truncate max-w-md" title={item.address}>
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{item.address}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Consulter PDF
                        </a>
                        <a
                          href={fullUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 transition-colors"
                          title="Télécharger le document"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Télécharger
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BRANDING */}
        {activeTab === 'branding' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Logo de votre Organisation</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Ce logo officiel apparaîtra en haut à droite des pages de garde, dans le cartouche technique et les en-têtes de toutes vos Notes de Calcul générées.
                </p>
              </div>

              {/* Logo Preview if exists */}
              {resolvedLogoUrl ? (
                <div className="p-5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-16 rounded-lg border border-slate-200 bg-white p-2 flex items-center justify-center shadow-2xs">
                      <img
                        src={resolvedLogoUrl}
                        alt="Logo client"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <FileCheck2 className="w-4 h-4 text-emerald-600" />
                        Logo actuel enregistré
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Format vérifié et prêt pour vos prochains calculs</p>
                    </div>
                  </div>

                  <button
                    onClick={handleRemoveLogo}
                    disabled={isLogoUploading}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 border border-rose-200 shrink-0 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                </div>
              ) : null}

              {/* Upload Zone */}
              <div className="relative">
                <input
                  type="file"
                  accept="image/jpeg, image/png"
                  id="account-logo-upload"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                  onChange={handleLogoUpload}
                  disabled={isLogoUploading}
                />

                <div className="border-2 border-dashed border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer">
                  {isLogoUploading ? (
                    <>
                      <Loader2 className="w-8 h-8 text-slate-600 animate-spin mb-2" />
                      <span className="text-xs font-semibold text-slate-700">Téléversement et optimisation...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs mb-3">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        {resolvedLogoUrl ? 'Remplacer par un nouveau logo' : 'Sélectionner un logo'}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        PNG avec transparence ou JPG • Max 10 Mo
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Feedback Messages */}
              {logoUploadSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Logo enregistré avec succès.</span>
                </div>
              )}
              {logoUploadError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{logoUploadError}</span>
                </div>
              )}
            </div>

            {/* Recommendations Card */}
            <div className="bg-slate-100/70 p-5 rounded-2xl border border-slate-200/70 text-xs text-slate-600 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-700" />
                Recommandations techniques
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Pour un rendu optimal sur la note de calcul PDF, utilisez un logo au format paysage sur fond transparent ou fond blanc. Le système redimensionne automatiquement l'image sans déformation.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

