import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markAllRead } from '../lib/api';
import { getSocket } from '../lib/socket';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationBell({ userId }: { userId?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    enabled: !!userId,
  });

  const unreadCount = (notifications as any[]).filter((n: any) => !n.is_read).length;

  const markReadMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Real-time notifications
  useEffect(() => {
    if (!userId) return;
    const socket = getSocket();
    socket.on('notification:new', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => { socket.off('notification:new'); };
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); if (unreadCount > 0) markReadMutation.mutate(); }}
        className="btn-ghost p-1.5 relative"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-100">Notifications</p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {(notifications as any[]).length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">No notifications</p>
            ) : (
              (notifications as any[]).map((n: any) => (
                <div key={n.id} className={`px-4 py-3 border-b border-gray-800 ${!n.is_read ? 'bg-gray-800/50' : ''}`}>
                  <p className="text-xs text-gray-300">
                    <span className="text-gray-100 font-medium">{n.actor_name || 'Someone'}</span>
                    {' '}
                    {n.type === 'assignment' && 'assigned you an email'}
                    {n.type === 'mention' && 'mentioned you in a comment'}
                    {n.type === 'reply' && 'replied to an email'}
                  </p>
                  {n.email_subject && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{n.email_subject}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
