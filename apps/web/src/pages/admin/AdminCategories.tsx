import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button, Card, ErrorState, Input, Skeleton } from '@/components/ui';

interface Cat { _id: string; name: string; slug: string; description: string; icon: string; order: number; projectCount: number }
export default function AdminCategories() {
  const qc = useQueryClient(); const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [err, setErr] = useState<string>();
  const q = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api.get<{ items: Cat[] }>('/admin/categories') });
  const done = () => { setErr(undefined); qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['categories'] }); };
  const fail = (e: unknown) => setErr((e as ApiError).message);
  const add = useMutation({ mutationFn: () => api.post('/admin/categories', { name, description: desc, order: (q.data?.items.length ?? 0) }), onSuccess: () => { setName(''); setDesc(''); done(); }, onError: fail });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/admin/categories/${id}`), onSuccess: done, onError: fail });
  return (
    <div className="space-y-6"><div><p className="label">// manage</p><h1 className="display text-3xl">Categories</h1></div>
      {err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}
      <Card className="p-4"><form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <Input required minLength={2} placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" aria-label="Category name" />
        <Input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} className="min-w-56 flex-1" aria-label="Description" /><Button disabled={add.isPending}>Add category</Button></form></Card>
      {q.isLoading && <Skeleton className="h-48" />}{q.error && <ErrorState message="Could not load categories." retry={() => q.refetch()} />}
      {q.data && <Card className="divide-y divide-line">{q.data.items.map((c) => <div key={c._id} className="flex items-center justify-between gap-3 p-3"><div><p className="mono font-medium">{c.name} <span className="text-muted">/{c.slug}</span></p><p className="label">{c.projectCount} projects</p></div>
        <Button variant="ghost" size="sm" aria-label={`Delete ${c.name}`} disabled={c.projectCount > 0} title={c.projectCount > 0 ? 'Move or delete its projects first' : 'Delete'} onClick={() => { if (confirm(`Delete category “${c.name}”?`)) del.mutate(c._id); }}><Trash2 className="size-4 text-red-500" /></Button></div>)}</Card>}
    </div>
  );
}
