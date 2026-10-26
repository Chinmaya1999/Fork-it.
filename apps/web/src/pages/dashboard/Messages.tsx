import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessagesSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';
import { cn } from '@/lib/cn';
import { EmptyState, Skeleton } from '@/components/ui';
import { Chat } from '@/features/Chat';
import { useEffect } from 'react';

export interface ConvItem { _id: string; kind: 'general' | 'custom'; title?: string; lastMessagePreview?: string; lastMessageAt: string; unreadForUser: number }
export default function Messages() {
  const { id } = useParams(); const nav = useNavigate();
  const q = useQuery({ queryKey: ['conversations'], queryFn: () => api.get<{ items: ConvItem[] }>('/conversations') });
  useEffect(() => { if (!id && q.data?.items[0]) nav(`/dashboard/messages/${q.data.items[0]._id}`, { replace: true }); }, [id, q.data, nav]);
  return (
    <div className="space-y-6"><div><p className="label">// my work</p><h1 className="display text-3xl">Messages</h1><p className="mt-1 text-sm text-muted">Chat directly with the ProjectForge team. Custom projects get their own thread.</p></div>
      {q.isLoading && <Skeleton className="h-72" />}
      {q.data && q.data.items.length === 0 && <EmptyState title="No conversations" body="Your conversation with the team will appear here." />}
      {q.data && q.data.items.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <nav className="sheet divide-y divide-line overflow-hidden self-start" aria-label="Conversations">{q.data.items.map((c) => (
            <Link key={c._id} to={`/dashboard/messages/${c._id}`} className={cn('block px-3 py-3 hover:bg-surface-2', c._id === id && 'bg-brand/10')}>
              <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{c.title ?? 'Conversation'}</p>{c.unreadForUser > 0 && <span className="mono rounded-full bg-brand px-1.5 text-[10px] font-bold text-onbrand">{c.unreadForUser}</span>}</div>
              <p className="truncate text-xs text-muted">{c.lastMessagePreview || 'No messages yet'}</p><p className="label">{dt(c.lastMessageAt)}</p></Link>))}</nav>
          {id ? <Chat key={id} conversationId={id} selfRole="student" /> : <div className="sheet grid place-items-center p-10 text-sm text-muted"><MessagesSquare className="mb-2 size-6" />Select a conversation</div>}
        </div>)}
    </div>
  );
}
