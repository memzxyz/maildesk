import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMe, getEmails } from '../lib/api';
import { connectSocket, getSocket } from '../lib/socket';
import Sidebar from '../components/Sidebar';
import EmailList from '../components/EmailList';
import EmailDetail from '../components/EmailDetail';
import NotificationBell from '../components/NotificationBell';

export default function InboxPage() {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe });

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['emails', statusFilter, assigneeFilter],
    queryFn: () => getEmails({
      status: statusFilter,
      ...(assigneeFilter ? { assignee: assigneeFilter } : {}),
    }),
  });

  // Real-time socket updates
  useEffect(() => {
    const socket = connectSocket();

    socket.on('email:new', (email: any) => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    });

    socket.on('email:assigned', ({ email_id, assigned_to }: any) => {
      queryClient.setQueryData(['emails', statusFilter, assigneeFilter], (old: any[]) =>
        old?.map(e => e.id === email_id ? { ...e, assigned_to } : e) || []
      );
      queryClient.invalidateQueries({ queryKey: ['email', email_id] });
    });

    return () => {
      socket.off('email:new');
      socket.off('email:assigned');
    };
  }, [statusFilter, assigneeFilter]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Left sidebar */}
      <Sidebar
        me={me}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        assigneeFilter={assigneeFilter}
        onAssigneeChange={setAssigneeFilter}
      />

      {/* Email list */}
      <div className="w-80 shrink-0 flex flex-col border-r border-gray-800 bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-100 capitalize">{statusFilter}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{emails.length} emails</span>
            <NotificationBell userId={me?.id} />
          </div>
        </div>

        <EmailList
          emails={emails}
          isLoading={isLoading}
          selectedId={selectedEmailId}
          onSelect={setSelectedEmailId}
        />
      </div>

      {/* Email detail */}
      <div className="flex-1 overflow-hidden">
        {selectedEmailId ? (
          <EmailDetail
            emailId={selectedEmailId}
            currentUser={me}
            onClose={() => setSelectedEmailId(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Select an email to read</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
