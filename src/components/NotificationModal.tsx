import React from 'react';
import { NotificationItem } from '../types';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onSelectNotification: (notif: NotificationItem) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-black/30 backdrop-blur-xs">
      <div 
        className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-2xl border border-surface-container-high mt-14 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 bg-surface-container-low flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">notifications_active</span>
            <h3 className="font-bold text-on-surface text-base">Prototype Notifications</h3>
            <span className="px-2 py-0.5 rounded-full bg-error text-on-error text-xs font-mono font-bold">
              {notifications.filter(n => n.unread).length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllRead}
              className="text-xs text-primary hover:underline font-semibold cursor-pointer"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-surface-container text-on-surface-variant cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-surface-container-low">
          {notifications.map((notif) => {
            const getIcon = () => {
              switch (notif.type) {
                case 'critical': return <span className="material-symbols-outlined text-error text-[20px]">e911_emergency</span>;
                case 'warning': return <span className="material-symbols-outlined text-amber-600 text-[20px]">warning</span>;
                case 'success': return <span className="material-symbols-outlined text-tertiary text-[20px]">verified</span>;
                default: return <span className="material-symbols-outlined text-primary text-[20px]">info</span>;
              }
            };

            return (
              <div 
                key={notif.id}
                className={`p-4 flex items-start gap-3 hover:bg-surface-container-low transition-colors ${
                  notif.unread ? 'bg-surface-container-low/50' : ''
                }`}
              >
                <div className="p-2 rounded-lg bg-surface-container shrink-0 mt-0.5">
                  {getIcon()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-on-surface truncate">{notif.title}</span>
                    <span className="text-[11px] font-mono text-on-surface-variant shrink-0">{notif.time}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-surface-container-low text-center border-t border-surface-container">
          <span className="text-[11px] font-mono text-on-surface-variant">
            Local demo notifications only; no broadcast or dispatch integration
          </span>
        </div>
      </div>
    </div>
  );
};
