import { useState, useRef } from 'react';
import { Camera, UploadCloud, X, FileText, Image as ImageIcon } from 'lucide-react';
import { createPortal } from 'react-dom';

interface PhotoPromptModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: (photoFile: File, siteName: string, clientName: string) => void;
  isSubmitting: boolean;
}

export default function PhotoPromptModal({ show, onClose, onConfirm, isSubmitting }: PhotoPromptModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [siteName, setSiteName] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!show) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = () => {
    if (selectedFile) {
      onConfirm(selectedFile, siteName, clientName);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Photo du site</h3>
          </div>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-slate-400 text-sm mb-6">
            Avant de lancer le calcul, veuillez joindre une photo du site. Elle sera incluse sur la première page de la Note de Calcul.
          </p>

          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">Nom du site</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Ex: TOWER_PARIS_01"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">Client</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Orange"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
              ${previewUrl ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'}
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange}
            />
            
            {previewUrl ? (
              <div className="space-y-4 flex flex-col items-center">
                <div className="relative w-full max-w-[200px] h-32 rounded-lg overflow-hidden border border-slate-700">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-2 text-indigo-400 font-medium text-sm">
                  <ImageIcon className="w-4 h-4" />
                  Changer l'image
                </div>
              </div>
            ) : (
              <div className="space-y-3 flex flex-col items-center text-slate-400">
                <div className="p-3 bg-slate-800 rounded-full">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-medium text-white mb-1">Cliquez pour sélectionner une photo</p>
                  <p className="text-xs">PNG, JPG, JPEG jusqu'à 10MB</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors border border-slate-700"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedFile || isSubmitting}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Lancement...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Lancer le calcul
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
