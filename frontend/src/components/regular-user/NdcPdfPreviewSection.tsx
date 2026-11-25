import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  LayoutList,
  Loader2,
  Maximize2,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';

export interface NdcPdfPreviewSectionProps {
  ndcPdfUrl: string;
  siteName?: string;
  onShowSummary: () => void;
  onEditParameters: () => void;
  onNewCalculation: () => void;
}

function buildFittedPdfUrl(url: string): string {
  if (!url) return url;
  if (url.includes('#')) return url;
  return `${url}#view=FitH&navpanes=0`;
}

function extractPdfFilename(url: string, siteName?: string): string {
  try {
    const cleanPath = url.split('#')[0].split('?')[0];
    const lastSegment = cleanPath.substring(cleanPath.lastIndexOf('/') + 1);
    if (lastSegment) {
      return decodeURIComponent(lastSegment);
    }
  } catch {
    // Fallback below
  }
  const safeSite = siteName?.trim().replace(/\s+/g, '_');
  return safeSite ? `Note_de_Calcul_${safeSite}.pdf` : 'Note_de_Calcul.pdf';
}

function NdcPdfPreviewSection({
  ndcPdfUrl,
  siteName,
  onShowSummary,
  onEditParameters,
  onNewCalculation,
}: NdcPdfPreviewSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const fittedPdfUrl = useMemo(() => buildFittedPdfUrl(ndcPdfUrl), [ndcPdfUrl]);
  const filename = useMemo(() => extractPdfFilename(ndcPdfUrl, siteName), [ndcPdfUrl, siteName]);

  useEffect(() => {
    setIsLoading(true);
  }, [fittedPdfUrl]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isFullscreen && !dialog.open) {
      dialog.showModal();
    } else if (!isFullscreen && dialog.open) {
      dialog.close();
    }
  }, [isFullscreen]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-3 relative z-10 animate-fadeIn">
      {/* Compact Header & Action Toolbar */}
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3 shadow-sm shrink-0 flex flex-col gap-2.5">
        {/* Top Row: Status + View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-900 tracking-tight truncate">
                  Note de Calcul prête
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
                  PDF
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate" title={filename}>
                {siteName?.trim() ? `${siteName.trim()} • ${filename}` : filename}
              </p>
            </div>
          </div>

          {/* Segmented View Toggle */}
          <div
            role="tablist"
            aria-label="Mode d'affichage du panneau"
            className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={true}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white text-violet-700 shadow-xs flex items-center gap-1.5 cursor-default"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Note de Calcul</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={false}
              onClick={onShowSummary}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Récapitulatif</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Document Utilities & Workflow Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={ndcPdfUrl}
              download={filename}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs shadow-emerald-600/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger</span>
            </a>
            <a
              href={ndcPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Ouvrir le PDF dans un nouvel onglet"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden xl:inline">Nouvel onglet</span>
            </a>
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Afficher en plein écran"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden xl:inline">Plein écran</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onEditParameters}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              title="Modifier les paramètres du projet"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Modifier</span>
            </button>
            <button
              type="button"
              onClick={onNewCalculation}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Nouveau Calcul</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fitted Full-Height PDF Viewport */}
      <div className="flex-1 min-h-0 relative rounded-2xl border border-slate-200/90 bg-slate-100 shadow-sm overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-xs gap-2.5">
            <Loader2 className="w-7 h-7 text-violet-600 animate-spin" />
            <span className="text-xs font-semibold text-slate-600">
              Chargement de la Note de Calcul...
            </span>
          </div>
        )}
        <iframe
          key={fittedPdfUrl}
          src={fittedPdfUrl}
          onLoad={() => setIsLoading(false)}
          className="w-full h-full border-0 block bg-white"
          title="Aperçu de la Note de Calcul"
        />
      </div>

      {/* Native Fullscreen Dialog */}
      <dialog
        ref={dialogRef}
        onClose={() => setIsFullscreen(false)}
        onCancel={() => setIsFullscreen(false)}
        className="w-[96vw] h-[94vh] max-w-none max-h-none m-auto p-0 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden backdrop:bg-slate-950/75 backdrop:backdrop-blur-xs"
      >
        {isFullscreen && (
          <div className="w-full h-full flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 text-white shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm font-bold truncate" title={filename}>
                  {filename}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={ndcPdfUrl}
                  download={filename}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger</span>
                </a>
                <a
                  href={ndcPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Nouvel onglet</span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  aria-label="Fermer le plein écran"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-slate-800">
              <iframe
                src={fittedPdfUrl}
                className="w-full h-full border-0 block bg-white"
                title="Note de Calcul — Plein écran"
              />
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

export default React.memo(NdcPdfPreviewSection);
