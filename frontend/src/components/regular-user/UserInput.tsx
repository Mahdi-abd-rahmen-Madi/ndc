import { useState } from 'react';
import { ArrowUpToLine, Layers, FileStack, GitMerge, Camera, Loader2, CheckCircle2, AlertCircle, MapPin, Settings2, AlignJustify } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { SimilarityMode, ProjectData } from './types';
import { CustomSelect } from '../ui/CustomSelect';

interface UserInputProps {
  project: ProjectData;
  onChange: (updates: Partial<ProjectData>) => void;
  nombreSecteurs: number;
  setNombreSecteurs: (val: number) => void;
  similarityMode: SimilarityMode;
  setSimilarityMode: (mode: SimilarityMode) => void;
  siteType?: string | null;
  foundationType?: string | null;
  apiBaseUrl?: string;
}

export default function UserInput({
  project,
  onChange,
  nombreSecteurs,
  setNombreSecteurs,
  similarityMode,
  setSimilarityMode,
  siteType,
  foundationType,
  apiBaseUrl = ''
}: UserInputProps) {
  const {
    siteName,
    clientName,
    codeSite,
    operator,
    siteImageUrl,
    buildingHeight,
    dalleThickness,
    etancheite,
    hasChauffageAuSol,
    fausseDalleThickness,
    selectedEchelle
  } = project;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;


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
        onChange({ siteImageUrl: data.photo_url });
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
      <div className={`p-5 bg-white border rounded-2xl relative overflow-hidden group shadow-sm transition-all duration-300 ${
        operator === 'orange'
          ? 'border-orange-200/90 hover:border-orange-300 ring-1 ring-orange-500/5'
          : operator === 'free'
            ? 'border-red-200/90 hover:border-red-300 ring-1 ring-red-500/5'
            : operator === 'bouygues'
              ? 'border-sky-200/90 hover:border-sky-300 ring-1 ring-sky-500/5'
              : 'border-slate-200 hover:border-violet-300'
      }`}>
        <div className={`absolute right-0 top-0 w-36 h-36 rounded-bl-full -z-10 transition-colors pointer-events-none ${
          operator === 'orange'
            ? 'bg-gradient-to-bl from-orange-500/10 via-amber-500/5 to-transparent'
            : operator === 'free'
              ? 'bg-gradient-to-bl from-red-500/10 via-rose-500/5 to-transparent'
              : operator === 'bouygues'
                ? 'bg-gradient-to-bl from-sky-500/10 via-blue-500/5 to-transparent'
                : 'bg-violet-500/5 group-hover:bg-violet-500/10'
        }`}></div>
        <h3 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
          <MapPin className={`w-4 h-4 transition-colors ${
            operator === 'orange' ? 'text-orange-500' : operator === 'free' ? 'text-red-500' : operator === 'bouygues' ? 'text-sky-600' : 'text-violet-600'
          }`} />
          Informations du Projet
        </h3>

        <div className="flex flex-col gap-6">
          {/* Photo Upload */}
          <div className="w-full flex flex-col">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-2 h-6">
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-violet-600" />
                Photo du site <span className="text-red-500 ml-1">*</span>
              </span>
              {siteImageUrl && (
                <button
                  onClick={() => {
                    onChange({ siteImageUrl: null });
                    setUploadSuccess(false);
                    setUploadError(null);
                  }}
                  className="text-[10px] uppercase font-bold text-red-600 hover:text-red-700 transition-colors bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded"
                >
                  Retirer
                </button>
              )}
            </label>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {siteImageUrl && (
                  <div className="w-11 h-11 shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shadow-sm">
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
                  <div className={`w-full py-2.5 px-3 bg-slate-50 border ${uploadError ? 'border-red-400 bg-red-50/50' : (uploadSuccess || siteImageUrl) ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300 border-dashed'} rounded-xl text-sm flex items-center justify-center gap-2 group-hover/upload:border-violet-400 group-hover/upload:bg-violet-50/30 transition-all`}>
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 text-violet-600 animate-spin" />
                        <span className="text-slate-600 text-xs font-medium">Upload en cours...</span>
                      </>
                    ) : uploadError ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-red-600 font-medium text-xs truncate">{uploadError}</span>
                      </>
                    ) : (uploadSuccess || siteImageUrl) ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-medium text-xs">Image chargée</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-slate-400 group-hover/upload:text-violet-600 transition-colors" />
                        <span className="text-slate-600 text-xs font-medium group-hover/upload:text-violet-700 transition-colors">Ajouter une image</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2 h-6">
                <span>Nom du site <span className="text-red-500 font-bold">*</span></span>
              </label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => onChange({ siteName: e.target.value })}
                placeholder="Ex: TOWER_PARIS_01"
                className="w-full bg-white border border-slate-300 rounded-lg py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-sm transition-all"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2 h-6">
                Réf. du site
              </label>
              <input
                type="text"
                value={codeSite}
                onChange={(e) => onChange({ codeSite: e.target.value })}
                placeholder="Ex: 75001"
                className="w-full bg-white border border-slate-300 rounded-lg py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-sm transition-all"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2 h-6">
                <span>Client <span className="text-red-500 font-bold">*</span></span>
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => onChange({ clientName: e.target.value })}
                placeholder="Ex: Mairie de Paris"
                className="w-full bg-white border border-slate-300 rounded-lg py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-sm transition-all"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-2 h-6">
                <span className="flex items-center gap-1.5">Opérateur</span>
                {operator && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded transition-colors ${
                    operator === 'orange' ? 'bg-orange-100 text-orange-800' :
                    operator === 'free' ? 'bg-red-100 text-red-800' :
                    'bg-sky-100 text-sky-800'
                  }`}>
                    {operator}
                  </span>
                )}
              </label>
              <select
                className={`w-full bg-white border rounded-lg py-2.5 px-3 text-sm font-medium shadow-sm transition-all cursor-pointer ${
                  !operator 
                    ? 'text-slate-400 border-slate-300 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500'
                    : operator === 'orange'
                      ? 'text-slate-900 border-orange-300 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500'
                      : operator === 'free'
                        ? 'text-slate-900 border-red-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
                        : 'text-slate-900 border-sky-300 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500'
                }`}
                value={operator || ''}
                onChange={(e) => onChange({ operator: e.target.value })}
              >
                <option value="" disabled>Sélectionner un opérateur</option>
                <option value="orange">Orange</option>
                <option value="free">Free</option>
                <option value="bouygues">Bouygues</option>
                {siteType !== 'nouveau' && (
                  <option value="sfr">SFR</option>
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Paramètres & Configuration */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl relative overflow-hidden group hover:border-violet-300 shadow-sm transition-all duration-300">
        <div className="absolute right-0 top-0 w-32 h-32 bg-violet-500/5 rounded-bl-full -z-10 group-hover:bg-violet-500/10 transition-colors"></div>

        <div className="flex flex-col gap-6">
          {/* Paramètres Techniques */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-violet-600" />
              Paramètres Techniques
            </h3>

            {dalleThickness !== '' && Number(dalleThickness) < 12 && foundationType !== 'encastre' && (
              <div className="mb-6 text-sm font-medium text-red-900 leading-snug flex items-start gap-3 bg-red-50 border border-red-200 p-4 rounded-xl shadow-sm transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <strong className="text-red-700 text-xs uppercase tracking-wider">⚠️ Action requise : Épaisseur dalle trop faible</strong>
                  <span>
                    L'épaisseur saisie semble <b>trop faible</b> pour une dalle de structure portante. Veillez à indiquer uniquement l'épaisseur du béton armé de structure. 
                    <span className="block mt-1 text-red-700">Une valeur insuffisante entraînera un résultat défavorable sur la note de calcul.</span>
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8 items-start">
              {/* Hauteur Bâtiment */}
              <div className="flex flex-col space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5 tracking-wider">
                  <ArrowUpToLine className="w-3.5 h-3.5 text-violet-600" />
                  <span>Hauteur bâtiment <span className="text-red-500 font-bold">*</span></span>
                </label>
                <div className="flex bg-white border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500 shadow-sm">
                  <input
                    type="number"
                    min="0"
                    max="150"
                    step="0.5"
                    value={buildingHeight}
                    onChange={(e) => onChange({ buildingHeight: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-transparent border-none py-2 px-3 text-sm text-slate-900 focus:ring-0"
                  />
                  <div className="px-3 flex items-center bg-slate-100 border-l border-slate-300 text-slate-600 text-xs font-semibold">m</div>
                </div>
              </div>

              {/* Dalle */}
              {foundationType !== 'encastre' && (
                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5 tracking-wider">
                    <FileStack className="w-3.5 h-3.5 text-violet-600" />
                    <span>Épaisseur dalle <span className="text-red-500 font-bold">*</span></span>
                  </label>
                  <div className={`flex bg-white border ${dalleThickness !== '' && Number(dalleThickness) < 12 ? 'border-red-400 focus-within:border-red-500' : 'border-slate-300 focus-within:border-violet-500'} rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-violet-500/20 shadow-sm`}>
                    <input
                      type="number"
                      min="0"
                      max="35"
                      step="1"
                      value={dalleThickness}
                      onChange={(e) => onChange({ dalleThickness: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full bg-transparent border-none py-2 px-3 text-sm text-slate-900 focus:ring-0"
                    />
                    <div className="px-3 flex items-center bg-slate-100 border-l border-slate-300 text-slate-600 text-xs font-semibold">cm</div>
                  </div>
                </div>
              )}

              {/* Etancheite */}
              {foundationType !== 'encastre' && (
                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5 tracking-wider">
                    <Layers className="w-3.5 h-3.5 text-violet-600" />
                    <span>Etanchéité <span className="text-red-500 font-bold">*</span></span>
                  </label>
                  <div className="flex bg-white border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500 shadow-sm">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={etancheite}
                      onChange={(e) => onChange({ etancheite: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full bg-transparent border-none py-2 px-3 text-sm text-slate-900 focus:ring-0"
                    />
                    <div className="px-3 flex items-center bg-slate-100 border-l border-slate-300 text-slate-600 text-xs font-semibold">cm</div>
                  </div>
                </div>
              )}

              {/* Chauffage au sol Toggle */}
              {foundationType !== 'encastre' && (
                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5 tracking-wider">
                    <Settings2 className="w-3.5 h-3.5 text-violet-600" />
                    Chauffage au sol
                  </label>
                  <div className="flex items-center h-[38px]">
                    <button
                      type="button"
                      onClick={() => onChange({ hasChauffageAuSol: !hasChauffageAuSol })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${hasChauffageAuSol ? 'bg-violet-600' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${hasChauffageAuSol ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              )}

              {/* Epaisseur Fausse Dalle */}
              {foundationType !== 'encastre' && hasChauffageAuSol && (
                <div className="flex flex-col space-y-2 animate-fadeIn">
                  <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5 tracking-wider">
                    <Layers className="w-3.5 h-3.5 text-violet-600" />
                    Epaisseur fausse dalle
                  </label>
                  <div className="flex bg-white border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500 shadow-sm">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={fausseDalleThickness}
                      onChange={(e) => onChange({ fausseDalleThickness: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full bg-transparent border-none py-2 px-3 text-sm text-slate-900 focus:ring-0"
                    />
                    <div className="px-3 flex items-center bg-slate-100 border-l border-slate-300 text-slate-600 text-xs font-semibold">cm</div>
                  </div>
                </div>
              )}

              {/* Échelle au sol */}
              <div className="flex flex-col space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5 tracking-wider">
                  <AlignJustify className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                  <span>Présence echelle + Palier de repos rabattable + PA <span className="text-red-500 font-bold">*</span></span>
                </label>
                <CustomSelect
                  value={selectedEchelle}
                  onChange={(val) => onChange({ selectedEchelle: val })}
                  options={[
                    { value: 'Echelle Söll', label: 'Echelle Söll' },
                    { value: 'Echelle Perroquet', label: 'Echelle Perroquet' },
                    { value: 'Echelle Pivotloc', label: 'Echelle Pivotloc' }
                  ]}
                  placeholder="Sélectionner une échelle"
                  className="w-full"
                />
              </div>

            </div>
          </div>

          {/* Configuration des Secteurs */}
          <div className="pt-6 border-t border-slate-200 mt-2">
            <h3 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-violet-600" />
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
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${nombreSecteurs === num
                        ? 'bg-violet-100 text-violet-800 border-violet-300 shadow-sm'
                        : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
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
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border text-center transition-all ${similarityMode === 'all_similar'
                        ? 'bg-violet-100 text-violet-800 border-violet-300 shadow-sm'
                        : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                        }`}
                    >
                      Identiques
                    </button>

                    <button
                      type="button"
                      disabled
                      title="Fonctionnalité bientôt disponible"
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-bold border text-center transition-all bg-slate-100/60 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
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
