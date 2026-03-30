import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmail, updateEmailStatus } from '../lib/api';
import { connectSocket } from '../lib/socket';
import { format } from 'date-fns';
import AssignPanel from './AssignPanel';
import CommentThread from './CommentThread';
import ReplyComposer from './ReplyComposer';
import { Avatar } from './Sidebar';

interface Props {
  emailId: string;
  currentUser: any;
  onClose: () => void;
}

export default function EmailDetail({ emailId, currentUser, onClose }: Props) {
  const [showReply, setShowReply] = useState(false);
  const queryClient = useQueryClient();

  const { data: email, isLoading } = useQuery({
    queryKey: ['email', emailId],
    queryFn: () => getEmail(emailId),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateEmailStatus(emailId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['email', emailId] });
    },
  });

  // Join email-specific socket room
  useEffect(() => {
    const socket = connectSocket();
    socket.emit('email:join', emailId);
    return () => { socket.emit('email:leave', emailId); };
  }, [emailId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!email) return null;

  const isResolved = email.status === 'resolved';

  return (
    <div className="flex h-full">
      {/* Main email content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-800 shrink-0">
          <button onClick={onClose} className="btn-ghost p-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1" />

          {/* Status toggle */}
          <button
            onClick={() => statusMutation.mutate(isResolved ? 'open' : 'resolved')}
            className={isResolved ? 'btn bg-gray-800 text-gray-300 hover:bg-gray-700' : 'btn-primary'}
          >
            {isResolved ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Reopen
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Resolve
              </>
            )}
          </button>

          <button onClick={() => setShowReply(r => !r)} className="btn-ghost">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Reply
          </button>
        </div>

        {/* Email content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-6">
            {/* Subject */}
            <h1 className="text-xl font-semibold text-white mb-4">
              {email.subject || '(no subject)'}
            </h1>

            {/* Sender row */}
            <div className="flex items-start gap-3 mb-6 pb-6 border-b border-gray-800">
              <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-white shrink-0">
                {(email.from_name || email.from_address)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-100">{email.from_name || email.from_address}</span>
                  <span className="text-xs text-gray-500">&lt;{email.from_address}&gt;</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">To: {email.to_addresses?.join(', ')}</span>
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-500">
                    {format(new Date(email.received_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            {email.body_html ? (
              <div
                className="prose prose-sm prose-invert max-w-none text-gray-300"
                dangerouslySetInnerHTML={{ __html: email.body_html }}
              />
            ) : (
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">{email.body_text}</pre>
            )}
          </div>
        </div>

        {/* Reply composer */}
        {showReply && (
          <ReplyComposer
            email={email}
            onSent={() => setShowReply(false)}
            onCancel={() => setShowReply(false)}
          />
        )}
      </div>

      {/* Right panel: assign + comments */}
      <div className="w-72 shrink-0 flex flex-col border-l border-gray-800 bg-gray-900 overflow-y-auto">
        <AssignPanel email={email} currentUser={currentUser} />
        <div className="border-t border-gray-800" />
        <CommentThread emailId={emailId} currentUser={currentUser} />
      </div>
    </div>
  );
}
