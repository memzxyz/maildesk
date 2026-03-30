import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { sendReply } from '../lib/api';

interface Props {
  email: any;
  onSent: () => void;
  onCancel: () => void;
}

export default function ReplyComposer({ email, onSent, onCancel }: Props) {
  const [body, setBody] = useState('');

  const replyMutation = useMutation({
    mutationFn: () => sendReply(email.id, `<div>${body.replace(/\n/g, '<br/>')}</div>`),
    onSuccess: onSent,
  });

  return (
    <div className="border-t border-gray-800 bg-gray-900 p-4 shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        <span className="text-xs text-gray-400">
          Replying to <span className="text-gray-200">{email.from_name || email.from_address}</span>
        </span>
      </div>

      <textarea
        className="input text-sm resize-none mb-3"
        rows={4}
        placeholder="Write your reply..."
        value={body}
        onChange={e => setBody(e.target.value)}
        autoFocus
      />

      <div className="flex items-center gap-2 justify-end">
        <button onClick={onCancel} className="btn-ghost text-sm">Cancel</button>
        <button
          onClick={() => replyMutation.mutate()}
          disabled={!body.trim() || replyMutation.isPending}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
        </button>
      </div>

      {replyMutation.isError && (
        <p className="text-xs text-red-400 mt-2">Failed to send reply. Please try again.</p>
      )}
    </div>
  );
}
