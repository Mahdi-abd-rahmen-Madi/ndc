import React from 'react';
import { Compass, Building2, Anchor, Edit3, User as UserIcon } from 'lucide-react';
import NotificationsDropdown from './NotificationsDropdown';

export interface PortailHeaderProps {
  siteType: string;
  foundationType: string;
  operator: string;
  onResetMontage?: () => void;
  userEmail?: string;
  clientLogoUrl: string | null;
  apiBaseUrl: string;
  onOpenProfile: () => void;
  onLogout?: () => void;
  notifications: any[];
  setNotifications: React.Dispatch<React.SetStateAction<any[]>>;
}

export function PortailHeader({
  siteType,
  foundationType,
  operator,
  onResetMontage,
  userEmail,
  clientLogoUrl,
  apiBaseUrl,
  onOpenProfile,
  onLogout,
  notifications,
  setNotifications
}: PortailHeaderProps) {
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/85 backdrop-blur-md px-5 md:px-8 flex items-center justify-between shrink-0 z-20 sticky top-0 shadow-xs">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/25 ring-1 ring-white/20">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none flex items-center gap-1.5">
              NDC Portail <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Client</span>
            </h1>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200/80 mx-1 hidden sm:block"></div>

        <div className="hidden sm:flex items-center gap-2 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg shadow-2xs text-slate-700 font-medium border border-slate-200/60">
            <Building2 className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-slate-400 font-normal">Site:</span>
            <span className="font-semibold text-slate-900">{siteType === 'nouveau' ? 'Neuf' : 'Existant'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg shadow-2xs text-slate-700 font-medium border border-slate-200/60">
            <Anchor className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-slate-400 font-normal">Ancrage:</span>
            <span className="font-semibold text-slate-900">
              {foundationType === 'metallique' ? 'Plot Métallique' :
                foundationType === 'beton' ? 'Plot Béton' :
                  foundationType === 'encastre' ? 'Encastré' : foundationType}
            </span>
          </div>
          {onResetMontage && (
            <button
              onClick={onResetMontage}
              className="flex items-center gap-1 px-2.5 py-1 text-violet-700 hover:text-violet-900 hover:bg-violet-50 rounded-lg transition-colors font-semibold"
              title="Modifier le type de site ou d'ancrage"
            >
              <Edit3 className="w-3 h-3" />
              <span>Modifier</span>
            </button>
          )}

          {operator ? (
            <>
              <div className="h-4 w-px bg-slate-300 mx-0.5"></div>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg shadow-2xs font-medium border transition-all ${operator === 'orange'
                    ? 'bg-orange-50/80 border-orange-200 text-orange-950'
                    : operator === 'free'
                      ? 'bg-red-50/80 border-red-200 text-red-950'
                      : 'bg-sky-50/80 border-sky-200 text-sky-950'
                  }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${operator === 'orange' ? 'bg-orange-400' : operator === 'free' ? 'bg-red-400' : 'bg-sky-400'
                    }`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${operator === 'orange' ? 'bg-orange-500' : operator === 'free' ? 'bg-red-500' : 'bg-sky-500'
                    }`}></span>
                </span>
                <span className="text-slate-400 font-normal">Opérateur:</span>
                <span className="font-bold capitalize">{operator}</span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">{userEmail}</span>
          <button
            onClick={onOpenProfile}
            className="text-xs px-2.5 py-1.5 bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 rounded-xl transition-all flex items-center gap-1.5 border border-slate-200 font-medium shadow-2xs"
          >
            {clientLogoUrl ? (
              <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-300 bg-white shrink-0">
                <img
                  src={clientLogoUrl.startsWith('http') || clientLogoUrl.startsWith('data:') ? clientLogoUrl : `${apiBaseUrl}${clientLogoUrl.startsWith('/') ? '' : '/'}${clientLogoUrl}`}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <UserIcon className="w-3.5 h-3.5 text-slate-500" />
            )}
            Profil
          </button>
          <button
            onClick={onLogout}
            className="text-xs px-2.5 py-1.5 bg-slate-100/80 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 rounded-xl border border-slate-200 transition-all font-medium shadow-2xs"
          >
            Déconnexion
          </button>
        </div>
        <div className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full font-semibold border border-emerald-200 shadow-2xs flex items-center gap-1.5 hidden sm:flex">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          En Ligne
        </div>
        <NotificationsDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={(id: any) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))}
          onMarkAllAsRead={() => setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))}
          onDelete={(id: any) => setNotifications(prev => prev.filter(n => n.id !== id))}
        />
      </div>
    </header>
  );
}
