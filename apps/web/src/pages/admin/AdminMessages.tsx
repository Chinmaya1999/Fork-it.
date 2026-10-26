import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessagesSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useDebounced } from '@/hooks/useTheme';
import { Skeleton } from '@/components/ui';
import { Chat } from '@/features/Chat';

export default function AdminMessages() {
  const { id } = useParams(); const [q, setQ] = useState(''); const dq = useDebounced(q); const [unread, setUnread] = useState(false);
  const list = useQuery({ queryKey: ['staff', 'conversations', dq, unread], queryFn: () => api.get<{ items: any[]; unreadTotal: number }>(`/staff/conversations?${new URLSearchParams({ ...(dq && { q: dq }), ...(unread && { unread: '1' }) })}`), refetchInterval: 60000 });
  return (
    <div className="space-y-5"><div><p className="label">// inbox</p><h1 className="display text-3xl">Messages</h1></div>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3"><input aria-label="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student or request…" className="mono h-10 w-full rounded-md border border-line bg-surface px-3 text-sm" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={unread} onChange={(e) => setUnread(e.target.checked)} />Unread only {list.data ? `(${list.data.unreadTotal})` : ''}</label>
          {list.isLoading && <Skeleton className="h-40" />}
          <nav className="sheet max-h-[65vh] divide-y divide-line overflow-y-auto" aria-label="Conversations">{list.data?.items.length === 0 && <p className="p-6 text-center text-sm text-muted">No conversations.</p>}
            {list.data?.items.map((c) => <Link key={c._id} to={`/admin/messages/${c._id}`} className={cn('block px-3 py-3 hover:bg-surface-2', c._id === id && 'bg-brand/10')}><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{c.user?.name ?? 'Student'}</p>{c.unreadForStaff > 0 && <span className="mono rounded-full bg-brand px-1.5 text-[10px] font-bold text-onbrand">{c.unreadForStaff}</span>}</div><p className="label truncate">{c.kind === 'custom' ? c.title : 'General'}</p><p className="truncate text-xs text-muted">{c.lastMessagePreview || '—'}</p><p className="label">{dt(c.lastMessageAt)}</p></Link>)}</nav></div>
        {id ? <Chat key={id} conversationId={id} selfRole="staff" /> : <div className="sheet grid min-h-64 place-items-center p-10 text-center text-sm text-muted"><div><MessagesSquare className="mx-auto mb-2 size-6" />Select a conversation</div></div>}
      </div>
    </div>
  );
}
