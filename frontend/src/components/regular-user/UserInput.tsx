import { useState } from 'react';
import { ArrowUpToLine, Layers, FileStack, ShieldAlert, GitMerge, Camera, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { SimilarityMode } from './types';

interface UserInputProps {
  siteType?: string | null;
  foundationType?: string | null;
  selectedBuildingHeight: number;
  setSelectedBuildingHeight: (val: number) => void;
  nombreSecteurs: number;
  setNombreSecteurs: (val: number) => void;
  dalleThickness: number | string;
  setDalleThickness: (val: number | string) => void;
  plotHeight: number;
  setPlotHeight: (val: number) => void;
  etancheite?: number | string;
  setEtancheite?: (val: number | string) => void;
  similarityMode: SimilarityMode;
  setSimilarityMode: (mode: SimilarityMode) => void;
  apiBaseUrl?: string;
  siteImageUrl?: string | null;
  onSiteImageUploaded?: (url: string | null) => void;
  siteName: string;
  setSiteName: (val: string) => void;
  clientName: string;
  setClientName: (val: string) => void;
  clientLogoUrl?: string | null;
  onClientLogoUploaded?: (url: string | null) => void;
}

export default function UserInput({
  siteType,
  foundationType,
  selectedBuildingHeight,
  setSelectedBuildingHeight,
  nombreSecteurs,
  setNombreSecteurs,
  dalleThickness,
  setDalleThickness,
  plotHeight,
  setPlotHeight,
  etancheite = "",
  setEtancheite,
  similarityMode,
  setSimilarityMode,
  apiBaseUrl = '',
  siteImageUrl,
  onSiteImageUploaded,
  siteName,
  setSiteName,
  clientName,
  setClientName,
  clientLogoUrl,
  onClientLogoUploaded
}: UserInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!onSiteImageUploaded) {
      setUploadError("Erreur de configuration (Handler non disponible).");
      e.target.value = '';
      return;
    }

    setUploadError(null);
    setUploadSuccess(false);

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setUploadError('Format invalide. Seuls JPG et PNG sont acceptés.');
      e.target.value = '';
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB max
      setUploadError('Fichier trop volumineux (max 10MB).');
      e.target.value = '';
      return;
    }

    try {
      setIsUploading(true);

      let fileToUpload = file;
      
      // Compress if larger than 1MB
      if (file.size > 1024 * 1024) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true
        };
        fileToUpload = await imageCompression(file, options);
      }

      const formData = new FormData();
      formData.append('photo', fileToUpload);

      const res = await fetch(`${apiBaseUrl}/api/upload-photo/`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        onSiteImageUploaded(data.photo_url);
        setUploadSuccess(true);
      } else {
        setUploadError('Erreur lors de l\'upload de l\'image.');
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      setUploadError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input to allow re-uploading the same file
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!onClientLogoUploaded) return;

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

  return (
    <>
      {/* Image Upload Field */}
      {onSiteImageUploaded && (
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-indigo-400" />
              Photo du site <span className="text-red-400 ml-1">* (Requis)</span>
            </span>
            {siteImageUrl && (
              <button 
                onClick={() => onSiteImageUploaded(null)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Retirer
              </button>
            )}
          </label>
          <div className="flex items-center gap-3">
            {siteImageUrl && (
              <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center">
                <img 
                  src={siteImageUrl.startsWith('http') || siteImageUrl.startsWith('data:') ? siteImageUrl : `${apiBaseUrl}${siteImageUrl.startsWith('/') ? '' : '/'}${siteImageUrl}`} 
                  alt="Site" 
                  className="w-full h-full object-cover" 
                />
              </div>
            )}
            <div className="relative group flex-1">
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={handleImageUpload}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              />
              <div className={`w-full py-2.5 px-3 bg-slate-900 border ${uploadError ? 'border-red-500/50' : (uploadSuccess || siteImageUrl) ? 'border-emerald-500/50' : 'border-slate-800'} rounded-xl text-sm flex items-center justify-center gap-2 transition-all group-hover:border-indigo-500/50`}>
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    <span className="text-slate-400">Compression & Upload...</span>
                  </>
                ) : uploadError ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 font-medium">{uploadError}</span>
                  </>
                ) : (uploadSuccess || siteImageUrl) ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-medium truncate max-w-[200px]">Photo sélectionnée</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    <span className="text-slate-400 group-hover:text-slate-300 transition-colors">Ajouter une image (JPG, PNG)</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client Logo Upload Field */}
      {onClientLogoUploaded && (
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-indigo-400" />
              Logo du client <span className="text-red-400 ml-1">* (Requis)</span>
            </span>
            {clientLogoUrl && (
              <button 
                onClick={() => onClientLogoUploaded(null)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Retirer
              </button>
            )}
          </label>
          <div className="flex items-center gap-3">
            {clientLogoUrl && (
              <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center p-1">
                <img 
                  src={clientLogoUrl.startsWith('http') || clientLogoUrl.startsWith('data:') ? clientLogoUrl : `${apiBaseUrl}${clientLogoUrl.startsWith('/') ? '' : '/'}${clientLogoUrl}`} 
                  alt="Client Logo" 
                  className="w-full h-full object-contain" 
                />
              </div>
            )}
            <div className="relative group flex-1">
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={handleLogoUpload}
                disabled={isLogoUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              />
              <div className={`w-full py-2.5 px-3 bg-slate-900 border ${logoUploadError ? 'border-red-500/50' : clientLogoUrl ? 'border-emerald-500/50' : 'border-slate-800'} rounded-xl text-sm flex items-center justify-center gap-2 transition-all group-hover:border-indigo-500/50`}>
                {isLogoUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    <span className="text-slate-400">Upload & Compression...</span>
                  </>
                ) : logoUploadError ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 font-medium">{logoUploadError}</span>
                  </>
                ) : clientLogoUrl ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-medium truncate max-w-[200px]">
                      Logo sélectionné
                    </span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    <span className="text-slate-400 group-hover:text-slate-300 transition-colors">Ajouter un logo (JPG, PNG)</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Site Name & Client Name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="flex flex-col space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            Nom du site
          </label>
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="Ex: TOWER_PARIS_01"
            className="w-full bg-slate-900/50 border border-slate-800/80 rounded-lg py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex flex-col space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            Client
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Ex: Orange"
            className="w-full bg-slate-900/50 border border-slate-800/80 rounded-lg py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Hauteur Bâtiment */}
        <div className="md:col-span-4 flex flex-col space-y-2 p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full -z-10 group-hover:bg-indigo-500/10 transition-colors"></div>

          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ArrowUpToLine className="w-3.5 h-3.5 text-indigo-400" />
              2. Hauteur du bâtiment (H)
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="150"
              step="0.5"
              value={selectedBuildingHeight}
              onChange={(e) => setSelectedBuildingHeight(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
            <span className="text-slate-400 text-sm font-medium">m</span>
          </div>
        </div>

        {/* Nombre de Secteurs */}
        <div className="md:col-span-8 flex flex-col space-y-2 p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full -z-10 group-hover:bg-indigo-500/10 transition-colors"></div>
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Nombre de Secteurs
          </label>
          <div className="flex gap-2 mt-1">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setNombreSecteurs(num)}
                className={`flex-1 py-2 rounded text-xs font-semibold transition-all border ${nombreSecteurs === num
                  ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 shadow-md'
                  : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
              >
                {num} {num === 1 ? 'Secteur' : 'Secteurs'}
              </button>
            ))}
          </div>

          {nombreSecteurs > 1 && (
            <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                <GitMerge className="w-3.5 h-3.5" />
                Configuration des secteurs
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  title="Copier le Secteur 1 sur les autres secteurs et les masquer"
                  onClick={() => setSimilarityMode('all_similar')}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-semibold transition-all border text-center ${similarityMode === 'all_similar'
                    ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 shadow-md'
                    : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                >
                  Identiques
                </button>

                <button
                  type="button"
                  title="Garder tous les secteurs indépendants et éditables"
                  onClick={() => setSimilarityMode('all_different')}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-semibold transition-all border text-center ${similarityMode === 'all_different'
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 shadow-md'
                    : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                >
                  Non-identiques
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Étancheité */}
      <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl mt-4 relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
        <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full -z-10 group-hover:bg-indigo-500/10 transition-colors"></div>
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          Étancheité
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="1"
            value={etancheite}
            onChange={(e) => setEtancheite?.(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder=""
            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 transition-colors"
          />
          <span className="text-slate-400 text-sm">cm</span>
        </div>
      </div>

      {/* Dalle & Plot (Visible except for Encastré) */}
      {foundationType !== 'encastre' && (
        <div className={`grid ${siteType === 'existant' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl mt-4`}>
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileStack className="w-3.5 h-3.5 text-indigo-400" />
              Épaisseur de la dalle
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1"
                value={dalleThickness}
                onChange={(e) => setDalleThickness(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder=""
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
              <span className="text-slate-400 text-sm">cm</span>
            </div>
          </div>
          {siteType === 'existant' && (
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Hauteur du plot
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={plotHeight}
                  onChange={(e) => setPlotHeight(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-2 focus:ring-amber-500 transition-colors"
                />
                <span className="text-slate-400 text-sm">m</span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
