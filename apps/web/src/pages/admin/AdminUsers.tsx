import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLES } from '@projectforge/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useDebounced } from '@/hooks/useTheme';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';

interface U { _id: string; name: string; email: string; role: string; status: 'active' | 'suspended'; emailVerified: boolean; createdAt: string }
export default function AdminUsers() {
  const { user: me } = useAuth(); const qc = useQueryClient(); const [text, setText] = useState(''); const dq = useDebounced(text); const [page, setPage] = useState(1); const [err, setErr] = useState<string>();
  const qs = new URLSearchParams({ ...(dq && { q: dq }), page: String(page) }).toString();
  const q = useQuery({ queryKey: ['admin', 'users', qs], queryFn: () => api.get<{ items: U[]; total: number; pages: number }>(`/admin/users?${qs}`), placeholderData: keepPreviousData });
  const upd = useMutation({ mutationFn: ({ id, ...b }: { id: string; role?: string; status?: string; emailVerified?: true }) => api.patch(`/admin/users/${id}`, b), onSuccess: () => { setErr(undefined); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); }, onError: (e) => setErr((e as ApiError).message) });
  return (
    <div className="space-y-5"><div><p className="label">// manage</p><h1 className="display text-3xl">Users</h1></div>
      <input aria-label="Search users" value={text} onChange={(e) => { setText(e.target.value); setPage(1); }} placeholder="Search name or email…" className="mono h-10 w-full max-w-sm rounded-md border border-line bg-surface px-3 text-sm" />
      {err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}
      {q.isLoading && <Skeleton className="h-48" />}{q.error && <ErrorState message="Could not load users." retry={() => q.refetch()} />}
      {q.data && (q.data.items.length === 0 ? <EmptyState title="No users" body="No accounts match." /> : <>
        <Card className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="label border-b border-line"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Joined</th></tr></thead>
          <tbody className="divide-y divide-line">{q.data.items.map((u) => { const self = u._id === me?.id; return (
            <tr key={u._id}><td className="p-3"><p className="font-medium">{u.name}{self && <span className="label"> (you)</span>}</p><p className="mono flex flex-wrap items-center gap-2 text-xs text-muted">{u.email}{!u.emailVerified && <><span>· unverified</span><button type="button" className="text-brand underline" onClick={() => upd.mutate({ id: u._id, emailVerified: true })}>verify manually</button></>}</p></td>
              <td className="p-3"><select aria-label={`Role for ${u.email}`} disabled={self} value={u.role} onChange={(e) => upd.mutate({ id: u._id, role: e.target.value })} className="mono h-9 rounded border border-line bg-surface px-2 text-xs disabled:opacity-50">{ROLES.map((r) => <option key={r}>{r}</option>)}</select></td>
              <td className="p-3"><div className="flex items-center gap-2"><Badge tone={u.status === 'active' ? 'green' : 'amber'}>{u.status}</Badge>{!self && <Button size="sm" variant="ghost" onClick={() => upd.mutate({ id: u._id, status: u.status === 'active' ? 'suspended' : 'active' })}>{u.status === 'active' ? 'Suspend' : 'Reactivate'}</Button>}</div></td>
              <td className="mono p-3 text-xs text-muted">{new Date(u.createdAt).toLocaleDateString()}</td></tr>); })}</tbody></table></Card>
        {q.data.pages > 1 && <div className="flex items-center justify-center gap-3"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button><span className="label">Page {page} / {q.data.pages}</span><Button variant="secondary" size="sm" disabled={page >= q.data.pages} onClick={() => setPage(page + 1)}>Next</Button></div>}</>)}
    </div>
  );
}
