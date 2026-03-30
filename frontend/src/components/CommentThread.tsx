import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComments, postComment, updateComment, deleteComment, getTeam } from '../lib/api';
import { getSocket } from '../lib/socket';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from './Sidebar';

interface Props {
  emailId: string;
  currentUser: any;
}

export default function CommentThread({ emailId, currentUser }: Props) {
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const queryClient = useQueryClient();
  const endRef = useRef<HTMLDivElement>(null);

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', emailId],
    queryFn: () => getComments(emailId),
  });

  const { data: team = [] } = useQuery({ queryKey: ['team'], queryFn: getTeam });

  // Live comment updates
  useEffect(() => {
    const socket = getSocket();

    socket.on('comment:new', ({ email_id, comment }: any) => {
      if (email_id !== emailId) return;
      queryClient.setQueryData(['comments', emailId], (old: any[]) => [...(old || []), comment]);
    });

    socket.on('comment:updated', ({ email_id, comment }: any) => {
      if (email_id !== emailId) return;
      queryClient.setQueryData(['comments', emailId], (old: any[]) =>
        old?.map(c => c.id === comment.id ? comment : c) || []
      );
    });

    socket.on('comment:deleted', ({ email_id, comment_id }: any) => {
      if (email_id !== emailId) return;
      queryClient.setQueryData(['comments', emailId], (old: any[]) =>
        old?.filter(c => c.id !== comment_id) || []
      );
    });

    return () => {
      socket.off('comment:new');
      socket.off('comment:updated');
      socket.off('comment:deleted');
    };
  }, [emailId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const postMutation = useMutation({
    mutationFn: () => postComment({ email_id: emailId, body: body.trim(), mentions }),
    onSuccess: () => {
      setBody('');
      setMentions([]);
    },
  });

  const editMutation = useMutation({
    mutationFn: (id: string) => updateComment(id, editBody.trim()),
    onSuccess: () => { setEditingId(null); setEditBody(''); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteComment,
  });

  function handleBodyChange(value: string) {
    setBody(value);
    const match = value.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  }

  function insertMention(member: any) {
    const newBody = body.replace(/@\w*$/, `@${member.name} `);
    setBody(newBody);
    setMentions(m => [...m, member.id]);
    setShowMentions(false);
  }

  const filteredTeam = (team as any[]).filter((m: any) =>
    m.id !== currentUser?.id &&
    m.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 py-3 border-b border-gray-800">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
          Comments {(comments as any[]).length > 0 && `· ${(comments as any[]).length}`}
        </p>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(comments as any[]).length === 0 && (
          <p className="text-xs text-gray-600 text-center py-4">No comments yet. Leave an internal note.</p>
        )}

        {(comments as any[]).map((comment: any) => (
          <div key={comment.id} className="group">
            <div className="flex items-start gap-2">
              <Avatar user={comment.user} size={6} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-xs font-medium text-gray-300">{comment.user?.name}</span>
                  <span className="text-xs text-gray-600">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                  {comment.edited_at && <span className="text-xs text-gray-600">(edited)</span>}
                </div>

                {editingId === comment.id ? (
                  <div>
                    <textarea
                      className="input text-xs resize-none mb-1.5"
                      rows={2}
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                    />
                    <div className="flex gap-1.5">
                      <button onClick={() => editMutation.mutate(comment.id)} className="btn-primary text-xs py-1">Save</button>
                      <button onClick={() => setEditingId(null)} className="btn-ghost text-xs py-1">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 whitespace-pre-wrap">{comment.body}</p>
                )}
              </div>

              {comment.user?.id === currentUser?.id && !editingId && (
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={() => { setEditingId(comment.id); setEditBody(comment.body); }}
                    className="text-gray-600 hover:text-gray-400 p-0.5"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(comment.id)}
                    className="text-gray-600 hover:text-red-400 p-0.5"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Comment input */}
      <div className="p-3 border-t border-gray-800 relative">
        {showMentions && filteredTeam.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden mb-1">
            {filteredTeam.map((m: any) => (
              <button
                key={m.id}
                onMouseDown={() => insertMention(m)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-left"
              >
                <Avatar user={m} size={5} />
                <span className="text-sm text-gray-200">{m.name}</span>
              </button>
            ))}
          </div>
        )}
        <textarea
          className="input text-xs resize-none mb-2"
          rows={2}
          placeholder="Leave a note... use @name to mention"
          value={body}
          onChange={e => handleBodyChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) {
              e.preventDefault();
              postMutation.mutate();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">⌘+Enter to submit</span>
          <button
            onClick={() => postMutation.mutate()}
            disabled={!body.trim() || postMutation.isPending}
            className="btn-primary text-xs py-1 disabled:opacity-50"
          >
            Comment
          </button>
        </div>
      </div>
    </div>
  );
}
