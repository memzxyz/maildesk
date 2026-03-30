import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTeam, assignEmail } from '../lib/api';
import { Avatar } from './Sidebar';

interface Props {
  email: any;
  currentUser: any;
}

export default function AssignPanel({ email, currentUser }: Props) {
  const queryClient = useQueryClient();
  const { data: team = [] } = useQuery({ queryKey: ['team'], queryFn: getTeam });

  const assignMutation = useMutation({
    mutationFn: (userId: string | null) => assignEmail(email.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', email.id] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });

  const currentAssignee = email.assigned_to;

  return (
    <div className="p-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Assigned to</p>

      {currentAssignee ? (
        <div className="flex items-center gap-2 mb-3">
          <Avatar user={currentAssignee} size={6} />
          <span className="text-sm text-gray-200">{currentAssignee.name}</span>
          <button
            onClick={() => assignMutation.mutate(null)}
            className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Remove
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-3">Unassigned</p>
      )}

      <div className="space-y-1">
        {(team as any[]).map((member: any) => {
          const isAssigned = currentAssignee?.id === member.id;
          return (
            <button
              key={member.id}
              onClick={() => assignMutation.mutate(isAssigned ? null : member.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                isAssigned
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`}
            >
              <Avatar user={member} size={5} />
              <span className="truncate">
                {member.id === currentUser?.id ? 'Me' : member.name}
              </span>
              {isAssigned && (
                <svg className="w-3.5 h-3.5 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
