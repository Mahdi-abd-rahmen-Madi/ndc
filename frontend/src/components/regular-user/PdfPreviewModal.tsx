import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';

interface PdfPreviewModalProps {
  previewPdfUrl: string | null;
  conversionError: boolean;
  onClose: () => void;
}

export default function PdfPreviewModal({ previewPdfUrl, conversionError, onClose }: PdfPreviewModalProps) {
  if (!previewPdfUrl || conversionError) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg text-white font-bold tracking-wide">Aperçu du document</h3>
              <p className="text-xs text-slate-400">Visionneuse PDF intégrée</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-400 transition-all"
            title="Fermer l'aperçu"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 w-full bg-slate-200">
          <iframe
            src={`${previewPdfUrl}#view=FitH`}
            className="w-full h-full border-0"
            title="Document Preview"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
