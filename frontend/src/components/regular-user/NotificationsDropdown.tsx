import { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, CheckCircle2 } from 'lucide-react';
import { styles } from './styles/NotificationsDropdown.styles';

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
    <div className={styles.container} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={styles.bellButton}
      >
        <Bell className={styles.bellIcon} />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdownMenu}>
          <div className={styles.dropdownHeader}>
            <h3 className={styles.dropdownTitle}>
              <Bell className={styles.dropdownTitleIcon} />
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button 
                onClick={onMarkAllAsRead}
                className={styles.markAllReadBtn}
              >
                <CheckCircle2 className={styles.markAllReadIcon} /> Tout marquer comme lu
              </button>
            )}
          </div>

          <div className={styles.notificationsList}>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <Bell className={styles.emptyIcon} />
                <p className={styles.emptyText}>Aucune notification pour le moment.</p>
              </div>
            ) : (
              <div className={styles.listContainer}>
                {notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    className={`${styles.notificationItemBase} ${notif.is_read ? styles.notificationItemRead : styles.notificationItemUnread}`}
                  >
                    {!notif.is_read && (
                      <span className={styles.unreadIndicator}></span>
                    )}
                    <div className={styles.notificationContent}>
                      <div className={styles.notificationHeader}>
                        <h4 className={`${styles.notificationTitleBase} ${notif.is_read ? styles.notificationTitleRead : styles.notificationTitleUnread}`}>
                          {notif.title}
                        </h4>
                        <span className={styles.notificationTime}>
                          {new Date(notif.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit'
                          })}
                        </span>
                      </div>
                      <p className={styles.notificationMessage}>
                        {notif.message}
                      </p>
                      
                      <div className={styles.actionsContainer}>
                        {!notif.is_read && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onMarkAsRead(notif.id); }}
                            className={styles.actionBtnRead}
                            title="Marquer comme lu"
                          >
                            <Check className={styles.actionIcon} /> Lu
                          </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
                          className={styles.actionBtnDelete}
                          title="Supprimer"
                        >
                          <Trash2 className={styles.actionIcon} /> Supprimer
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
