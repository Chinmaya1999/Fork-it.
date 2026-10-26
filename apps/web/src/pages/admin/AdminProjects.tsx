import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { formatINR } from '@projectforge/shared';
import { api, ApiError } from '@/lib/api';
import { useDebounced } from '@/hooks/useTheme';
import { Badge, Button, Card, EmptyState, ErrorState, LinkButton, Skeleton } from '@/components/ui';

interface Row { _id: string; title: string; slug: string; status: 'draft' | 'published' | 'unpublished'; pricePaise: number; isFree: boolean; verification: string; source?: { type: string; license?: string }; updatedAt: string }
const tone = { published: 'green', draft: 'amber', unpublished: 'neutral' } as const;

export default function AdminProjects() {
  const [sp, setSp] = useSearchParams(); const qc = useQueryClient();
  const [text, setText] = useState(''); const dq = useDebounced(text); const [err, setErr] = useState<string>();
  const status = sp.get('status') ?? ''; const page = Number(sp.get('page') ?? 1);
  const qs = new URLSearchParams({ ...(status && { status }), ...(dq && { q: dq }), page: String(page), limit: '20' }).toString();
  const list = useQuery({ queryKey: ['admin', 'projects', qs], queryFn: () => api.get<{ items: Row[]; total: number; pages: number }>(`/admin/projects?${qs}`), placeholderData: keepPreviousData });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/admin/projects/${id}/status`, { status }), onSuccess: refresh, onError: (e) => setErr((e as ApiError).message) });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/admin/projects/${id}`), onSuccess: refresh, onError: (e) => setErr((e as ApiError).message) });
  const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); return n; });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="label">// manage</p><h1 className="display text-3xl">Projects</h1></div><LinkButton to="/admin/projects/new">+ Add project</LinkButton></div>
      <div className="flex flex-wrap gap-3">
        <input aria-label="Search projects" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search title…" className="mono h-10 min-w-56 flex-1 rounded-md border border-line bg-surface px-3 text-sm" />
        <select aria-label="Status" value={status} onChange={(e) => set('status', e.target.value)} className="mono h-10 rounded-md border border-line bg-surface px-3 text-sm"><option value="">All statuses</option><option value="published">published</option><option value="draft">draft</option><option value="unpublished">unpublished</option></select>
      </div>
      {err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}
      {list.isLoading && <Skeleton className="h-64" />}
      {list.error && <ErrorState message="Could not load projects." retry={() => list.refetch()} />}
      {list.data && (list.data.items.length === 0 ? <EmptyState title="No projects" body="Nothing matches these filters." /> : <>
        <p className="label">{list.data.total.toLocaleString('en-IN')} projects</p>
        <Card className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="label border-b border-line"><tr><th className="p-3">Title</th><th className="p-3">Status</th><th className="p-3">Price</th><th className="p-3">License</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-line">{list.data.items.map((r) => (
            <tr key={r._id}><td className="max-w-xs p-3"><Link to={`/admin/projects/${r._id}`} className="line-clamp-1 font-medium capitalize hover:text-brand">{r.title}</Link><span className="label">{r.source?.type}{r.verification === 'verified' ? ' · verified' : ''}</span></td>
              <td className="p-3"><Badge tone={tone[r.status]}>{r.status}</Badge></td>
              <td className="mono p-3">{r.isFree ? '$0' : formatINR(r.pricePaise)}</td><td className="mono p-3 text-xs">{r.source?.license ?? '—'}</td>
              <td className="p-3"><div className="flex justify-end gap-1">
                {r.status === 'published' ? <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: r._id, status: 'unpublished' })}>Unpublish</Button> : <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: r._id, status: 'published' })}>Publish</Button>}
                {r.status === 'published' && <a href={`/projects/${r.slug}`} target="_blank" rel="noreferrer" aria-label="View on site" className="grid size-9 place-items-center rounded text-muted hover:text-brand"><ExternalLink className="size-4" /></a>}
                <LinkButton to={`/admin/projects/${r._id}`} size="sm" variant="ghost" aria-label="Edit"><Pencil className="size-4" /></LinkButton>
                <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => { if (confirm(`Delete “${r.title}” permanently?`)) del.mutate(r._id); }}><Trash2 className="size-4 text-red-500" /></Button>
              </div></td></tr>))}</tbody></table></Card>
        {list.data.pages > 1 && <div className="flex items-center justify-center gap-3"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => set('page', String(page - 1))}>Prev</Button><span className="label">Page {page} / {list.data.pages}</span><Button variant="secondary" size="sm" disabled={page >= list.data.pages} onClick={() => set('page', String(page + 1))}>Next</Button></div>}
      </>)}
    </div>
  );
}
