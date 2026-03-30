import { formatDistanceToNow } from 'date-fns';
import { Avatar } from './Sidebar';

interface EmailListProps {
  emails: any[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function EmailList({ emails, isLoading, selectedId, onSelect }: EmailListProps) {
  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse space-y-2">
            <div className="h-3 bg-gray-800 rounded w-3/4" />
            <div className="h-2 bg-gray-800 rounded w-full" />
            <div className="h-2 bg-gray-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!emails.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-6">
        <div>
          <p className="text-sm text-gray-500">No emails here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {emails.map(email => (
        <EmailRow
          key={email.id}
          email={email}
          isSelected={email.id === selectedId}
          onClick={() => onSelect(email.id)}
        />
      ))}
    </div>
  );
}

function EmailRow({ email, isSelected, onClick }: { email: any; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-800 transition-colors ${
        isSelected ? 'bg-gray-800' : 'hover:bg-gray-800/50'
      }`}
    >
      <div className="flex items-start gap-2 mb-1">
        {/* Unread dot */}
        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${!email.is_read ? 'bg-brand-500' : 'bg-transparent'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className={`text-xs truncate ${!email.is_read ? 'text-white font-semibold' : 'text-gray-300'}`}>
              {email.from_name || email.from_address}
            </span>
            <span className="text-xs text-gray-500 shrink-0">
              {formatDistanceToNow(new Date(email.received_at), { addSuffix: false })}
            </span>
          </div>
          <p className={`text-xs truncate mb-1 ${!email.is_read ? 'text-gray-200' : 'text-gray-400'}`}>
            {email.subject || '(no subject)'}
          </p>
          <p className="text-xs text-gray-500 truncate">{email.snippet}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 pl-3.5">
        {email.assigned_to && (
          <div className="flex items-center gap-1">
            <Avatar user={email.assigned_to} size={4} />
            <span className="text-xs text-gray-500 truncate max-w-[80px]">{email.assigned_to.name}</span>
          </div>
        )}
        {email.comment_count > 0 && (
          <div className="ml-auto flex items-center gap-1 text-gray-500">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-xs">{email.comment_count}</span>
          </div>
        )}
      </div>
    </button>
  );
}
