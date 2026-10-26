import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { formatINR } from '@projectforge/shared';
import { api, ApiError } from '@/lib/api';
import { dt, label } from '@/lib/format';
import { Button, Card, ErrorState, Field, Input, Skeleton } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';

export default function AdminOrderDetail() {
  const { id } = useParams(); const qc = useQueryClient(); const [err, setErr] = useState<string>(); const [ok, setOk] = useState<string>();
  const [reason, setReason] = useState(''); const [amount, setAmount] = useState(''); const [pid, setPid] = useState('');
  const q = useQuery({ queryKey: ['admin', 'order', id], queryFn: () => api.get<any>(`/admin/orders/${id}`), retry: false });
  const done = (m: string) => { setErr(undefined); setOk(m); qc.invalidateQueries({ queryKey: ['admin'] }); };
  const fail = (e: unknown) => { setOk(undefined); setErr((e as ApiError).message); };
  const refund = useMutation({ mutationFn: () => api.post(`/admin/orders/${id}/refund`, { reason, ...(amount ? { amountPaise: Math.round(Number(amount) * 100) } : {}) }), onSuccess: () => { setReason(''); setAmount(''); done('Refund processed.'); }, onError: fail });
  const reconcile = useMutation({ mutationFn: () => api.post(`/admin/orders/${id}/reconcile`, { paymentId: pid }), onSuccess: () => { setPid(''); done('Reconciled: the gateway confirmed this payment.'); }, onError: fail });
  if (q.isLoading) return <Skeleton className="h-64" />; if (q.error) return <ErrorState message="Order not found." />;
  const { order: o, payments, refunds, downloads } = q.data; const remaining = o.amountPaise - o.refundedPaise;
  return (
    <div className="max-w-3xl space-y-5"><Link to="/admin/orders" className="label inline-flex items-center gap-1 hover:text-brand"><ArrowLeft className="size-3" />orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="label">{label(o.type)}</p><h1 className="display text-2xl">{o.ref}</h1></div><StatusBadge status={o.status} /></div>
      {err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}{ok && <p role="status" className="rounded bg-brand/10 p-3 text-sm text-[color:var(--brand-text)]">{ok}</p>}
      <Card className="grid gap-4 p-5 sm:grid-cols-3">{[['Item', o.title], ['Customer', `${o.user?.name} (${o.user?.email})`], ['Amount', formatINR(o.amountPaise)], ['Refunded', formatINR(o.refundedPaise)], ['Gateway', `${o.gateway} · ${o.gatewayOrderId ?? ''}`], ['Receipt', o.receiptNo ?? '—'], ['Created', dt(o.createdAt)], ['Paid', dt(o.paidAt)], ['Downloads', String(downloads)]].map(([k, v]) => <div key={k} className="min-w-0"><p className="label">{k}</p><p className="mono break-words text-sm font-medium">{v}</p></div>)}</Card>
      <Card className="p-5"><h2 className="font-semibold">Payment attempts</h2>{payments.length === 0 ? <p className="mt-2 text-sm text-muted">No attempts recorded.</p> : <ul className="mt-2 divide-y divide-line">{payments.map((p: any) => <li key={p._id} className="mono flex flex-wrap items-center justify-between gap-2 py-2 text-xs"><span>{p.gatewayPaymentId}</span><span className="flex items-center gap-2 text-muted">{p.source} · {p.signatureVerified ? 'signature ✓' : 'no client signature'} · {dt(p.createdAt)}<StatusBadge status={p.status} /></span>{p.failureReason && <span className="w-full text-amber-500">{p.failureReason}</span>}</li>)}</ul>}</Card>
      {refunds.length > 0 && <Card className="p-5"><h2 className="font-semibold">Refunds</h2><ul className="mt-2 divide-y divide-line">{refunds.map((r: any) => <li key={r._id} className="mono flex flex-wrap justify-between gap-2 py-2 text-xs"><span>{formatINR(r.amountPaise)} — {r.reason}</span><span className="text-muted">{r.gatewayRefundId} · {dt(r.createdAt)}</span></li>)}</ul></Card>}
      {o.status === 'paid' && remaining > 0 && <Card className="space-y-3 p-5"><h2 className="font-semibold">Refund</h2><p className="text-sm text-muted">Refunds go through the payment gateway. A full refund revokes the customer’s access to downloads immediately.</p>
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]"><Field label={`Amount ₹ (blank = full ${formatINR(remaining)})`}><Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="Reason (required)"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field></div>
        <Button variant="secondary" disabled={reason.trim().length < 3 || refund.isPending} onClick={() => { if (confirm('Process this refund? This cannot be undone.')) refund.mutate(); }}>{refund.isPending ? 'Processing…' : 'Process refund'}</Button></Card>}
      {['created', 'failed'].includes(o.status) && <Card className="space-y-3 p-5"><h2 className="font-semibold">Reconcile</h2><p className="text-sm text-muted">If the customer says they paid but the order is not marked paid, paste the gateway payment id. It is accepted <strong>only</strong> if the gateway confirms the capture and the amount matches — you cannot mark an order paid by hand.</p>
        <div className="flex gap-2"><Input value={pid} onChange={(e) => setPid(e.target.value)} placeholder="pay_XXXXXXXX" aria-label="Gateway payment id" /><Button variant="secondary" disabled={pid.trim().length < 5 || reconcile.isPending} onClick={() => reconcile.mutate()}>Verify with gateway</Button></div></Card>}
    </div>
  );
}
