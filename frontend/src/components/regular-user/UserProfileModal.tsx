import React, { useState, useEffect } from 'react';
import { User as UserIcon, Upload, X, Loader2, History, FileText, Download, Eye, Calendar, MapPin, Building2, Radio } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { styles } from './styles/UserProfileModal.styles';

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

interface UserProfileModalProps {
  onClose: () => void;
  clientLogoUrl: string | null;
  onClientLogoUploaded: (url: string | null) => void;
  apiBaseUrl: string;
  onSelectCalculation?: (pdfUrl: string) => void;
}

export default function UserProfileModal({
  onClose,
  clientLogoUrl,
  onClientLogoUploaded,
  apiBaseUrl,
  onSelectCalculation,
}: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('history');
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  // History state
  const [historyItems, setHistoryItems] = useState<CalculationHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

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
      setHistoryError('Erreur de connexion.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [apiBaseUrl]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploadError(null);

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setLogoUploadError('Format invalide. Seuls JPG et PNG sont acceptés.');
      e.target.value = '';
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setLogoUploadError('Fichier trop volumineux (max 10MB).');
      e.target.value = '';
      return;
    }

    try {
      setIsLogoUploading(true);
      let fileToUpload = file;
      
      // Compress if larger than 1MB
      if (file.size > 1024 * 1024) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1024,
          useWebWorker: true
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
        onClientLogoUploaded(data.client_logo);
      } else {
        const errText = await res.text();
        console.error('Logo upload failed:', errText);
        setLogoUploadError(`Erreur: ${res.status} ${errText.substring(0, 50)}`);
      }
    } catch (err) {
      console.error('Logo upload failed:', err);
      setLogoUploadError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setIsLogoUploading(false);
      e.target.value = '';
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
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={styles.overlay}>
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
              <UserIcon className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Mon Espace Utilisateur</h2>
              <p className="text-xs text-slate-500">Gérez votre profil et retrouvez vos Notes de Calcul</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={styles.closeButton}
            title="Fermer"
          >
            <X className={styles.closeIcon} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            Historique des Calculs
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-violet-100 text-violet-700 font-bold">
              {historyItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            Logo & Préférences
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'history' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Notes de Calcul Récentes</h3>
                  <p className="text-xs text-slate-500">Toutes les notes de calcul générées sur votre compte restent accessibles ici</p>
                </div>
                <button
                  onClick={fetchHistory}
                  disabled={isLoadingHistory}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium px-2.5 py-1 rounded-md bg-violet-50 hover:bg-violet-100 transition-colors"
                >
                  {isLoadingHistory ? 'Actualisation...' : 'Actualiser'}
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                  <span className="text-xs font-medium">Chargement de vos calculs...</span>
                </div>
              ) : historyError ? (
                <div className="p-4 rounded-xl bg-red-50 text-red-600 text-xs border border-red-100 text-center">
                  {historyError}
                </div>
              ) : historyItems.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700">Aucun calcul enregistré</h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Lorsque vous générez une note de calcul, elle apparaîtra automatiquement ici pour consultation ultérieure.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyItems.map((item) => {
                    const fullUrl = getFullPdfUrl(item.pdf_url);
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-violet-300 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 truncate">
                              {item.code_site ? `${item.code_site}` : (item.site_name || 'Note de Calcul')}
                            </span>
                            {item.site_name && item.code_site && (
                              <span className="text-xs text-slate-500 truncate">({item.site_name})</span>
                            )}
                            {item.operator && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-50 text-orange-600 border border-orange-200/60 uppercase">
                                {item.operator}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1 text-slate-400">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(item.created_at)}
                            </span>
                            {item.client_name && (
                              <span className="flex items-center gap-1 text-slate-600">
                                <Building2 className="w-3.5 h-3.5" />
                                {item.client_name}
                              </span>
                            )}
                            {item.address && (
                              <span className="flex items-center gap-1 text-slate-500 truncate max-w-xs" title={item.address}>
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{item.address}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          {onSelectCalculation && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectCalculation(fullUrl);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-500/20 transition-colors"
                              title="Afficher dans le panneau de droite"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Visualiser
                            </button>
                          )}
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title="Ouvrir dans un nouvel onglet"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Ouvrir
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.sectionContainer}>
              <label className={styles.label}>
                Logo Client Personnalisé
              </label>
              <p className={styles.description}>
                Cette image apparaîtra comme en-tête et logo du client sur toutes vos Notes de Calcul (pages de garde, cartouches et synthèses).
              </p>

              {clientLogoUrl && (
                <div className={styles.logoPreviewContainer}>
                  <button
                    type="button"
                    onClick={() => onClientLogoUploaded(null)}
                    className={styles.removeLogoButton}
                    title="Supprimer l'image"
                  >
                    <X className={styles.removeLogoIcon} />
                  </button>
                  <img 
                    src={clientLogoUrl.startsWith('http') || clientLogoUrl.startsWith('data:') ? clientLogoUrl : `${apiBaseUrl}${clientLogoUrl.startsWith('/') ? '' : '/'}${clientLogoUrl}`} 
                    alt="Client Logo" 
                    className={styles.logoImage}
                  />
                </div>
              )}

              <div className={styles.uploadContainer}>
                <input
                  type="file"
                  accept="image/jpeg, image/png"
                  id="profile-logo-upload"
                  className={styles.fileInput}
                  onChange={handleLogoUpload}
                  disabled={isLogoUploading}
                />
                <div className={`${styles.uploadBoxBase} ${logoUploadError ? styles.uploadBoxError : clientLogoUrl ? styles.uploadBoxSuccess : styles.uploadBoxDefault}`}>
                  {isLogoUploading ? (
                    <>
                      <Loader2 className={styles.loadingIcon} />
                      <span className={styles.loadingText}>Envoi en cours...</span>
                    </>
                  ) : (
                    <>
                      <Upload className={`${styles.uploadIconBase} ${logoUploadError ? styles.uploadIconError : styles.uploadIconDefault}`} />
                      <span className={styles.uploadTitle}>
                        {clientLogoUrl ? 'Changer l\'image' : 'Sélectionner une image'}
                      </span>
                      <span className={styles.uploadSubtitle}>
                        JPG ou PNG (Max 10MB)
                      </span>
                    </>
                  )}
                </div>
              </div>

              {logoUploadError && (
                <p className={styles.errorMessage}>
                  {logoUploadError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            onClick={onClose}
            className={styles.footerButton}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

