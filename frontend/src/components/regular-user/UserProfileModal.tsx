import React, { useState } from 'react';
import { User as UserIcon, Upload, X, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface UserProfileModalProps {
  onClose: () => void;
  clientLogoUrl: string | null;
  onClientLogoUploaded: (url: string | null) => void;
  apiBaseUrl: string;
}

export default function UserProfileModal({
  onClose,
  clientLogoUrl,
  onClientLogoUploaded,
  apiBaseUrl,
}: UserProfileModalProps) {
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-indigo-400" />
            Profil Utilisateur
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-200 block">
              Photo de profil
            </label>
            <p className="text-xs text-slate-400 mb-4">
              Cette image sera utilisée comme logo du client sur tous les documents NDC générés.
            </p>

            {clientLogoUrl && (
              <div className="relative group w-32 h-32 mx-auto rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-800 mb-6">
                <button
                  type="button"
                  onClick={() => onClientLogoUploaded(null)}
                  className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-md z-10 transition-colors"
                  title="Supprimer l'image"
                >
                  <X className="w-3 h-3" />
                </button>
                <img 
                  src={clientLogoUrl.startsWith('http') || clientLogoUrl.startsWith('data:') ? clientLogoUrl : `${apiBaseUrl}${clientLogoUrl.startsWith('/') ? '' : '/'}${clientLogoUrl}`} 
                  alt="Client Logo" 
                  className="w-full h-full object-contain p-2"
                />
              </div>
            )}

            <div className="relative">
              <input
                type="file"
                accept="image/jpeg, image/png"
                id="profile-logo-upload"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                onChange={handleLogoUpload}
                disabled={isLogoUploading}
              />
              <div className={`w-full py-4 px-4 bg-slate-800/50 border-2 border-dashed ${logoUploadError ? 'border-red-500/50' : clientLogoUrl ? 'border-emerald-500/50' : 'border-slate-700'} rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:border-indigo-500 hover:bg-slate-800 group`}>
                {isLogoUploading ? (
                  <>
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    <span className="text-sm text-slate-300">Envoi en cours...</span>
                  </>
                ) : (
                  <>
                    <Upload className={`w-6 h-6 ${logoUploadError ? 'text-red-400' : 'text-slate-400 group-hover:text-indigo-400'}`} />
                    <span className="text-sm font-medium text-slate-300">
                      {clientLogoUrl ? 'Changer l\'image' : 'Sélectionner une image'}
                    </span>
                    <span className="text-xs text-slate-500 text-center">
                      JPG ou PNG (Max 10MB)
                    </span>
                  </>
                )}
              </div>
            </div>

            {logoUploadError && (
              <p className="text-xs text-red-400 mt-2 text-center bg-red-400/10 py-2 rounded-lg border border-red-400/20">
                {logoUploadError}
              </p>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-900/20"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
