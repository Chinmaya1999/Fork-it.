import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { formatINR } from '@projectforge/shared';
import { api } from '@/lib/api';
import { day, label } from '@/lib/format';
import { Card, EmptyState, ErrorState, LinkButton, Skeleton } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';

export interface OrderView { id: string; ref: string; type: string; title: string; amountPaise: number; status: string; createdAt: string; paidAt?: string; receiptNo?: string; refundedPaise: number; project?: { slug: string; title: string }; customRequest?: string }
export default function Orders() {
  const q = useQuery({ queryKey: ['orders'], queryFn: () => api.get<{ items: OrderView[] }>('/orders') });
  return (
    <div className="space-y-6"><div><p className="label">// my work</p><h1 className="display text-3xl">My orders</h1><p className="mt-1 text-sm text-muted">Everything you’ve paid for, with receipts, downloads and setup guides.</p></div>
      {q.isLoading && <Skeleton className="h-40" />}{q.error && <ErrorState message="Could not load your orders." retry={() => q.refetch()} />}
      {q.data && (q.data.items.length === 0 ? <EmptyState title="No orders yet" body="When you buy a project or pay for a custom build, it will show up here." action={<LinkButton to="/dashboard/projects"><Package className="size-4" />Browse projects</LinkButton>} />
        : <div className="space-y-3">{q.data.items.map((o) => (
          <Link key={o.id} to={`/dashboard/orders/${o.id}`}><Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-brand">
            <div className="min-w-0"><p className="truncate font-semibold">{o.title}</p><p className="label">{o.ref} · {label(o.type)} · {day(o.createdAt)}</p></div>
            <div className="flex items-center gap-3"><span className="mono font-bold">{formatINR(o.amountPaise)}</span><StatusBadge status={o.status} /></div></Card></Link>))}</div>)}
    </div>
  );
}
