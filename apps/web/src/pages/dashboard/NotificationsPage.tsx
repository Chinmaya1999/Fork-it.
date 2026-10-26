import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';
import { Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';

interface N { _id: string; title: string; body?: string; link?: string; readAt?: string; createdAt: string }
export default function NotificationsPage() {
  const [page, setPage] = useState(1); const [unread, setUnread] = useState(false); const nav = useNavigate(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications', 'list', page, unread], queryFn: () => api.get<{ items: N[]; unreadCount: number; pages: number }>(`/notifications?page=${page}${unread ? '&unread=1' : ''}`), placeholderData: keepPreviousData });
  const inval = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const read = useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/read`), onSuccess: inval });
  const readAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: inval });
  return (
    <div className="max-w-3xl space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="label">// account</p><h1 className="display text-3xl">Notifications</h1></div>
      <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => { setUnread((u) => !u); setPage(1); }}>{unread ? 'Show all' : 'Unread only'}</Button><Button size="sm" disabled={!q.data?.unreadCount} onClick={() => readAll.mutate()}>Mark all read</Button></div></div>
      {q.isLoading && <Skeleton className="h-40" />}{q.error && <ErrorState message="Could not load notifications." retry={() => q.refetch()} />}
      {q.data && (q.data.items.length === 0 ? <EmptyState title={unread ? 'No unread notifications' : 'Nothing here yet'} body="Payment receipts, delivery updates, ticket replies and messages will show up here." />
        : <Card className="divide-y divide-line">{q.data.items.map((n) => (
          <button key={n._id} type="button" onClick={() => { if (!n.readAt) read.mutate(n._id); if (n.link) nav(n.link); }} className="flex w-full gap-3 p-4 text-left hover:bg-surface-2">
            <i className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-brand'}`} /><span className="min-w-0 flex-1"><span className="block font-medium">{n.title}</span>{n.body && <span className="block text-sm text-muted">{n.body}</span>}<span className="label">{dt(n.createdAt)}</span></span></button>))}</Card>)}
      {q.data && q.data.pages > 1 && <div className="flex items-center justify-center gap-3"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button><span className="label">Page {page} / {q.data.pages}</span><Button variant="secondary" size="sm" disabled={page >= q.data.pages} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </div>
  );
}
