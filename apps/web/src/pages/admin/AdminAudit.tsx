import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';

interface A { _id: string; action: string; actorEmail: string; targetType?: string; targetId?: string; meta?: unknown; ip?: string; createdAt: string }
export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['admin', 'audit', page], queryFn: () => api.get<{ items: A[]; pages: number }>(`/admin/audit?page=${page}`), placeholderData: keepPreviousData });
  return (
    <div className="space-y-5"><div><p className="label">// security</p><h1 className="display text-3xl">Audit log</h1></div>
      {q.isLoading && <Skeleton className="h-48" />}{q.error && <ErrorState message="Could not load audit log." retry={() => q.refetch()} />}
      {q.data && (q.data.items.length === 0 ? <EmptyState title="No activity yet" body="Admin actions are recorded here." /> : <>
        <Card className="divide-y divide-line">{q.data.items.map((a) => <div key={a._id} className="mono p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-bold text-brand">{a.action}</span><span className="text-muted">{new Date(a.createdAt).toLocaleString()}</span></div>
          <p className="mt-1 text-muted">{a.actorEmail} → {a.targetType} {a.targetId}{a.ip ? ` · ${a.ip}` : ''}</p>{a.meta != null && <pre className="mt-1 overflow-x-auto text-[11px] text-muted">{JSON.stringify(a.meta)}</pre>}</div>)}</Card>
        {q.data.pages > 1 && <div className="flex items-center justify-center gap-3"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button><span className="label">Page {page} / {q.data.pages}</span><Button variant="secondary" size="sm" disabled={page >= q.data.pages} onClick={() => setPage(page + 1)}>Next</Button></div>}</>)}
    </div>
  );
}
