import { useState } from 'react';
import { ArrowUpToLine, Layers, FileStack, GitMerge, Camera, Loader2, CheckCircle2, AlertCircle, MapPin, Settings2 } from 'lucide-react';
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
}

export default function UserInput({
  foundationType,
  selectedBuildingHeight,
  setSelectedBuildingHeight,
  nombreSecteurs,
  setNombreSecteurs,
  dalleThickness,
  setDalleThickness,
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
  setClientName
}: UserInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Informations du Projet */}
      <div className="p-5 bg-slate-900/50 border border-slate-800/80 rounded-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
        <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full -z-10 group-hover:bg-indigo-500/10 transition-colors"></div>
        <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-400" />
          Informations du Projet
        </h3>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Photo Upload */}
          {onSiteImageUploaded && (
            <div className="w-full lg:w-[40%] flex flex-col">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-2 h-6">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  Photo du site <span className="text-red-400 ml-1">*</span>
                </span>
                {siteImageUrl && (
                  <button
                    onClick={() => {
                      onSiteImageUploaded(null);
                      setUploadSuccess(false);
                      setUploadError(null);
                    }}
                    className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300 transition-colors bg-red-400/10 px-2 py-1 rounded"
                  >
                    Retirer
                  </button>
                )}
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {siteImageUrl && (
                  <div className="w-11 h-11 shrink-0 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center shadow-inner">
                    <img
                      src={siteImageUrl.startsWith('http') || siteImageUrl.startsWith('data:') ? siteImageUrl : `${apiBaseUrl}${siteImageUrl.startsWith('/') ? '' : '/'}${siteImageUrl}`}
                      alt="Site"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="relative group/upload w-full">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                  />
                  <div className={`w-full py-2.5 px-3 bg-slate-800/50 border ${uploadError ? 'border-red-500/50' : (uploadSuccess || siteImageUrl) ? 'border-emerald-500/50' : 'border-slate-700 border-dashed'} rounded-xl text-sm flex items-center justify-center gap-2 transition-all group-hover/upload:border-indigo-500/50 group-hover/upload:bg-slate-800`}>
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                        <span className="text-slate-400 text-xs">Upload...</span>
                      </>
                    ) : uploadError ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 font-medium text-xs truncate">{uploadError}</span>
                      </>
                    ) : (uploadSuccess || siteImageUrl) ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-medium text-xs">Image OK</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-slate-500 group-hover/upload:text-indigo-400 transition-colors" />
                        <span className="text-slate-400 text-xs group-hover/upload:text-slate-300 transition-colors">Ajouter image</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex flex-col">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2 h-6">
                Nom du site
              </label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Ex: TOWER_PARIS_01"
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg py-2.5 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex-1 flex flex-col">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2 h-6">
                Client
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Orange"
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg py-2.5 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Paramètres & Configuration */}
      <div className="p-5 bg-slate-900/50 border border-slate-800/80 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
        <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -z-10 group-hover:bg-emerald-500/10 transition-colors"></div>

        <div className="flex flex-col gap-6">
          {/* Paramètres Techniques */}
          <div>
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-emerald-400" />
              Paramètres Techniques
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Hauteur Bâtiment */}
              <div className="flex flex-col space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 tracking-wider">
                  <ArrowUpToLine className="w-3.5 h-3.5 text-emerald-400" />
                  Hauteur bâtiment
                </label>
                <div className="flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                  <input
                    type="number"
                    min="0"
                    max="150"
                    step="0.5"
                    value={selectedBuildingHeight}
                    onChange={(e) => setSelectedBuildingHeight(Number(e.target.value))}
                    className="w-full bg-transparent border-none py-2 px-3 text-sm text-white focus:ring-0"
                  />
                  <div className="px-3 flex items-center bg-slate-800/50 border-l border-slate-700 text-slate-400 text-xs font-semibold">m</div>
                </div>
              </div>

              {/* Dalle */}
              {foundationType !== 'encastre' && (
                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 tracking-wider">
                    <FileStack className="w-3.5 h-3.5 text-emerald-400" />
                    Épaisseur dalle
                  </label>
                  <div className="flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={dalleThickness}
                      onChange={(e) => setDalleThickness(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-transparent border-none py-2 px-3 text-sm text-white focus:ring-0"
                    />
                    <div className="px-3 flex items-center bg-slate-800/50 border-l border-slate-700 text-slate-400 text-xs font-semibold">cm</div>
                  </div>
                </div>
              )}

              {/* Etancheite */}
              {foundationType !== 'encastre' && (
                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 tracking-wider">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    Etanchéité
                  </label>
                  <div className="flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={etancheite}
                      onChange={(e) => setEtancheite?.(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-transparent border-none py-2 px-3 text-sm text-white focus:ring-0"
                    />
                    <div className="px-3 flex items-center bg-slate-800/50 border-l border-slate-700 text-slate-400 text-xs font-semibold">cm</div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Configuration des Secteurs */}
          <div className="pt-6 border-t border-slate-800/50 mt-2">
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-indigo-400" />
              Configuration des Secteurs
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-3">Nombre de Secteurs</span>
                <div className="flex gap-2">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNombreSecteurs(num)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${nombreSecteurs === num
                        ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {nombreSecteurs > 1 && (
                <div className="flex flex-col animate-fadeIn">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-3">Similarité</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      title="Copier le Secteur 1 sur les autres secteurs et les masquer"
                      onClick={() => setSimilarityMode('all_similar')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border text-center ${similarityMode === 'all_similar'
                        ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                      Identiques
                    </button>

                    <button
                      type="button"
                      title="Garder tous les secteurs indépendants et éditables"
                      onClick={() => setSimilarityMode('all_different')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border text-center ${similarityMode === 'all_different'
                        ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                      Non-identiques
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
