import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { formatINR, ORDER_STATUSES, ORDER_TYPES } from '@projectforge/shared';
import { api } from '@/lib/api';
import { dt, label } from '@/lib/format';
import { useDebounced } from '@/hooks/useTheme';
import { Card, EmptyState, ErrorState, Select, Skeleton } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { Pager } from '@/components/Pager';

export default function AdminOrders() {
  const [text, setText] = useState(''); const dq = useDebounced(text); const [status, setStatus] = useState(''); const [type, setType] = useState(''); const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ ...(dq && { q: dq }), ...(status && { status }), ...(type && { type }), page: String(page) }).toString();
  const q = useQuery({ queryKey: ['admin', 'orders', qs], queryFn: () => api.get<{ items: any[]; total: number; pages: number }>(`/admin/orders?${qs}`), placeholderData: keepPreviousData });
  return (
    <div className="space-y-5"><div><p className="label">// money</p><h1 className="display text-3xl">Orders &amp; payments</h1></div>
      <div className="flex flex-wrap gap-3"><input aria-label="Search orders" value={text} onChange={(e) => { setText(e.target.value); setPage(1); }} placeholder="Order ref, title or receipt…" className="mono h-10 min-w-56 flex-1 rounded-md border border-line bg-surface px-3 text-sm" />
        <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 w-40"><option value="">All statuses</option>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select aria-label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="h-10 w-44"><option value="">All types</option>{ORDER_TYPES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></div>
      {q.isLoading && <Skeleton className="h-48" />}{q.error && <ErrorState message="Could not load orders." retry={() => q.refetch()} />}
      {q.data && (q.data.items.length === 0 ? <EmptyState title="No orders" body="Nothing matches these filters yet." /> : <>
        <p className="label">{q.data.total} orders</p>
        <Card className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="label border-b border-line"><tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Date</th></tr></thead>
          <tbody className="divide-y divide-line">{q.data.items.map((o) => <tr key={o._id}><td className="p-3"><Link to={`/admin/orders/${o._id}`} className="mono font-bold hover:text-brand">{o.ref}</Link><p className="line-clamp-1 text-xs text-muted">{o.title}</p></td><td className="p-3 text-xs">{o.user?.name}<br /><span className="text-muted">{o.user?.email}</span></td><td className="mono p-3">{formatINR(o.amountPaise)}</td><td className="p-3"><StatusBadge status={o.status} /></td><td className="mono p-3 text-xs text-muted">{dt(o.createdAt)}</td></tr>)}</tbody></table></Card>
        <Pager page={page} pages={q.data.pages} onPage={setPage} /></>)}
    </div>
  );
}
