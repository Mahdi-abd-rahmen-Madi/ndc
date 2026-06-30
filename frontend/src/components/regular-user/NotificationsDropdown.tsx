import { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, CheckCircle2 } from 'lucide-react';

interface Notification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationsDropdownProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: number) => void;
}

export default function NotificationsDropdown({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete
}: NotificationsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-300 hover:text-white transition-colors rounded-full hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-slate-900 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[500px] animate-fadeIn">
          <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center sticky top-0 z-10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-400" />
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button 
                onClick={onMarkAllAsRead}
                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded-md transition-colors"
              >
                <CheckCircle2 className="w-3 h-3" /> Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                <Bell className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">Aucune notification pour le moment.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    className={`p-4 hover:bg-slate-800/50 transition-colors group relative ${notif.is_read ? 'opacity-70' : 'bg-slate-800/20'}`}
                  >
                    {!notif.is_read && (
                      <span className="absolute top-4 left-2 w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    )}
                    <div className="pl-3">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={`text-xs font-bold ${notif.is_read ? 'text-slate-300' : 'text-white'}`}>
                          {notif.title}
                        </h4>
                        <span className="text-[9px] text-slate-500 shrink-0 mt-0.5">
                          {new Date(notif.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {notif.message}
                      </p>
                      
                      <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notif.is_read && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onMarkAsRead(notif.id); }}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                            title="Marquer comme lu"
                          >
                            <Check className="w-3 h-3" /> Lu
                          </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
                          className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3 h-3" /> Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
