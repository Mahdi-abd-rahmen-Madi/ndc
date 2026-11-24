import React from 'react';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import type { WorkerStatus } from '../../hooks/useWorkerStatus';

interface WorkerStatusBannerProps {
  status: WorkerStatus | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  isStandardSite?: boolean;
  isWaitingInQueue?: boolean;
}

function WorkerStatusBanner({
  status,
  isLoading,
  isRefreshing,
  onRefresh,
  isStandardSite = false,
  isWaitingInQueue = false,
}: WorkerStatusBannerProps) {
  if (isLoading && !status) {
    return (
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/90 text-slate-600 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
          <span className="truncate font-medium">
            Vérification de la disponibilité du moteur de calcul...
          </span>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const refreshButton = (colorClasses: string) => (
    <button
      type="button"
      onClick={onRefresh}
      disabled={isRefreshing}
      title="Actualiser le statut du moteur"
      aria-label="Actualiser le statut du moteur"
      className={`p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer disabled:opacity-50 ${colorClasses}`}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
    </button>
  );

  if (status.state === 'available') {
    return (
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-emerald-200/90 bg-emerald-50/80 text-emerald-950 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-emerald-900 leading-tight">
              Moteur de calcul disponible
            </p>
            <p className="text-[11px] text-emerald-700 leading-snug mt-0.5">
              Aucun calcul en attente — démarrage immédiat
            </p>
          </div>
        </div>
        {refreshButton('text-emerald-700 hover:bg-emerald-100/80')}
      </div>
    );
  }

  if (status.state === 'busy') {
    const queueCount = Math.max(0, status.queue_size || 0);
    const queueLabel =
      queueCount === 0
        ? "Aucune attente en file"
        : queueCount === 1
          ? "1 calcul en file d'attente"
          : `${queueCount} calculs en file d'attente`;

    return (
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-amber-200/90 bg-amber-50/85 text-amber-950 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-900 leading-tight">
              {isWaitingInQueue ? 'Votre calcul est en file d\'attente' : 'Moteur de calcul occupé'}
            </p>
            <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
              {isWaitingInQueue
                ? `1 calcul en cours${queueCount > 0 ? ` • ${queueCount} en file d'attente` : ''} — démarrage automatique dès qu'un créneau se libère.`
                : `1 calcul en cours • ${queueLabel}`}
            </p>
            {!isWaitingInQueue && (
              <p className="text-[11px] text-amber-700/90 leading-snug">
                Votre calcul démarrera automatiquement à son tour.
              </p>
            )}
          </div>
        </div>
        {refreshButton('text-amber-700 hover:bg-amber-100/80')}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-rose-200/90 bg-rose-50/85 text-rose-950 shadow-2xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <WifiOff className="w-4 h-4 text-rose-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-rose-900 leading-tight">
            Moteur de calcul hors ligne
          </p>
          <p className="text-[11px] text-rose-700 leading-snug mt-0.5">
            Le serveur Robot est temporairement indisponible.
            {isStandardSite ? ' Les sites standards en cache restent accessibles.' : ''}
          </p>
        </div>
      </div>
      {refreshButton('text-rose-700 hover:bg-rose-100/80')}
    </div>
  );
}

export default React.memo(WorkerStatusBanner);
