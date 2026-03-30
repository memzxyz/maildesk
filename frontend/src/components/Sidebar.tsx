import { useQuery } from '@tanstack/react-query';
import { getTeam } from '../lib/api';

interface SidebarProps {
  me: any;
  statusFilter: string;
  onStatusChange: (s: string) => void;
  assigneeFilter: string;
  onAssigneeChange: (s: string) => void;
}

const statuses = [
  { key: 'open', label: 'Open', icon: '📥' },
  { key: 'resolved', label: 'Resolved', icon: '✅' },
  { key: 'all', label: 'All', icon: '📂' },
];

export default function Sidebar({ me, statusFilter, onStatusChange, assigneeFilter, onAssigneeChange }: SidebarProps) {
  const { data: team = [] } = useQuery({ queryKey: ['team'], queryFn: getTeam });

  function handleSignOut() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  return (
    <div className="w-56 shrink-0 flex flex-col bg-gray-950 border-r border-gray-800">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-semibold text-white text-sm">MailDesk</span>
        </div>
      </div>

      {/* Views */}
      <div className="px-2 py-3 border-b border-gray-800">
        <p className="text-xs text-gray-500 px-2 mb-1 uppercase tracking-wider font-medium">Views</p>
        {statuses.map(s => (
          <button
            key={s.key}
            onClick={() => onStatusChange(s.key)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
              statusFilter === s.key
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-900'
            }`}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Team filter */}
      <div className="px-2 py-3 flex-1">
        <p className="text-xs text-gray-500 px-2 mb-1 uppercase tracking-wider font-medium">Assigned to</p>
        <button
          onClick={() => onAssigneeChange('')}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
            !assigneeFilter ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-900'
          }`}
        >
          Everyone
        </button>
        {(team as any[]).map((member: any) => (
          <button
            key={member.id}
            onClick={() => onAssigneeChange(member.id === assigneeFilter ? '' : member.id)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
              assigneeFilter === member.id
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-900'
            }`}
          >
            <Avatar user={member} size={5} />
            <span className="truncate">{member.id === me?.id ? 'Me' : member.name}</span>
          </button>
        ))}
      </div>

      {/* User */}
      {me && (
        <div className="px-3 py-3 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <Avatar user={me} size={6} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 truncate font-medium">{me.name}</p>
              <p className="text-xs text-gray-500 truncate">{me.email}</p>
            </div>
            <button onClick={handleSignOut} className="text-gray-600 hover:text-gray-400 transition-colors" title="Sign out">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Avatar({ user, size = 8 }: { user: any; size?: number }) {
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name}
        className={`w-${size} h-${size} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-medium shrink-0`}>
      {user?.name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}
