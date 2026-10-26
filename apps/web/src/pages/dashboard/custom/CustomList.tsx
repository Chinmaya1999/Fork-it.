import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Wrench } from 'lucide-react';
import { formatINR } from '@projectforge/shared';
import { api } from '@/lib/api';
import { day } from '@/lib/format';
import { Card, EmptyState, ErrorState, LinkButton, Skeleton } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';

export interface CustomItem { _id: string; ref: string; title: string; status: string; appType: string; deadline?: string; agreed?: { totalPaise?: number }; updatedAt: string }
export default function CustomList() {
  const q = useQuery({ queryKey: ['custom'], queryFn: () => api.get<{ items: CustomItem[] }>('/custom-requests') });
  return (
    <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="label">// my work</p><h1 className="display text-3xl">Custom requests</h1><p className="mt-1 text-sm text-muted">Describe your idea, get a quote, and follow the build.</p></div><LinkButton to="/dashboard/custom/new"><Plus className="size-4" />New request</LinkButton></div>
      {q.isLoading && <Skeleton className="h-32" />}{q.error && <ErrorState message="Could not load your requests." retry={() => q.refetch()} />}
      {q.data && (q.data.items.length === 0 ? <EmptyState title="No custom requests" body="Can’t find a project that fits? Tell us what you need and we’ll send a quotation." action={<LinkButton to="/dashboard/custom/new"><Wrench className="size-4" />Request a custom project</LinkButton>} />
        : <div className="space-y-3">{q.data.items.map((r) => <Link key={r._id} to={`/dashboard/custom/${r._id}`}><Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-brand"><div className="min-w-0"><p className="truncate font-semibold">{r.title}</p><p className="label">{r.ref} · {r.appType}{r.deadline ? ` · deadline ${day(r.deadline)}` : ''}{r.agreed?.totalPaise ? ` · agreed ${formatINR(r.agreed.totalPaise)}` : ''}</p></div><StatusBadge status={r.status} /></Card></Link>)}</div>)}
    </div>
  );
}
