import { X, ExternalLink, RefreshCw } from 'lucide-react';
import { PreviewDocState } from './types';

interface DocumentPreviewModalProps {
  previewDoc: PreviewDocState | null;
  setPreviewDoc: (val: PreviewDocState | null) => void;
}

export default function DocumentPreviewModal({
  previewDoc,
  setPreviewDoc
}: DocumentPreviewModalProps) {
  if (!previewDoc) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex flex-col">
      <div className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-white font-bold">{previewDoc.filename}</h3>
          {!previewDoc.isConverting && !previewDoc.conversionFailed && (
            <a 
              href={previewDoc.originalUrl || previewDoc.url} 
              target="_blank" 
              rel="noreferrer"
              className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20"
            >
              <ExternalLink className="w-3 h-3" /> Ouvrir dans un nouvel onglet
            </a>
          )}
        </div>
        <button 
          onClick={() => setPreviewDoc(null)}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <div className="flex-1 bg-slate-950 relative overflow-hidden">
        {previewDoc.isConverting ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="w-12 h-12 animate-spin mb-4 text-indigo-500" />
            <p className="text-lg font-medium text-white mb-2">Préparation du document...</p>
            <p className="text-sm">Conversion en cours pour un affichage optimal</p>
          </div>
        ) : previewDoc.conversionFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mb-4">
              <X className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium text-white mb-2">Impossible d'afficher l'aperçu</p>
            <p className="text-sm mb-6 max-w-md text-center">
              Le format de ce document ne permet pas un aperçu direct dans le navigateur.
            </p>
            <a 
              href={previewDoc.originalUrl || previewDoc.url} 
              target="_blank" 
              rel="noreferrer"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/20"
            >
              <ExternalLink className="w-5 h-5" /> Télécharger / Ouvrir le fichier original
            </a>
          </div>
        ) : (
          <iframe 
            src={previewDoc.url}
            className="w-full h-full border-0 bg-white"
            title="Aperçu Document"
          />
        )}
      </div>
    </div>
  );
}
