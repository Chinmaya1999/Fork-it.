import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, LifeBuoy, Receipt } from 'lucide-react';
import { formatINR } from '@projectforge/shared';
import { api, ApiError, downloadFile } from '@/lib/api';
import { bytes, dt, label } from '@/lib/format';
import { Button, Card, ErrorState, LinkButton, Skeleton } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { Markdown } from '@/components/Markdown';
import type { OrderView } from './Orders';

interface F { _id: string; label: string; kind: string; version: string; originalName: string; sizeBytes: number; sha256: string }
export default function OrderDetail() {
  const { id } = useParams(); const [err, setErr] = useState<string>();
  const q = useQuery({ queryKey: ['order', id], queryFn: () => api.get<{ order: OrderView; files: F[]; guide: string; attempts: { status: string; createdAt: string; failureReason?: string }[] }>(`/orders/${id}`), retry: false });
  const download = async (f: F) => { setErr(undefined); try { const r = await api.post<{ url: string }>(`/files/${f._id}/link`); await downloadFile(r.url); } catch (e) { setErr((e as ApiError).message); } };
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.error) return <ErrorState message="This order was not found." />;
  const { order: o, files, guide, attempts } = q.data!; const paid = o.status === 'paid';
  return (
    <div className="max-w-3xl space-y-6">
      <div><Link to="/dashboard/orders" className="label inline-flex items-center gap-1 hover:text-brand"><ArrowLeft className="size-3" />orders</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3"><h1 className="display text-3xl">{o.title}</h1><StatusBadge status={o.status} /></div></div>
      <Card className="grid gap-4 p-5 sm:grid-cols-4">{[['Order', o.ref], ['Amount', formatINR(o.amountPaise)], ['Placed', dt(o.createdAt)], ['Paid', dt(o.paidAt)]].map(([k, v]) => <div key={k}><p className="label">{k}</p><p className="mono text-sm font-bold">{v}</p></div>)}</Card>
      {paid && <Card className="p-5"><h2 className="flex items-center gap-2 font-semibold"><Receipt className="size-4 text-brand" />Receipt</h2>
        <dl className="mono mt-3 grid gap-1 text-sm sm:grid-cols-2"><div><dt className="label">Receipt no.</dt><dd className="font-bold">{o.receiptNo}</dd></div><div><dt className="label">Type</dt><dd>{label(o.type)}</dd></div><div><dt className="label">Amount paid</dt><dd>{formatINR(o.amountPaise)}</dd></div><div><dt className="label">Date</dt><dd>{dt(o.paidAt)}</dd></div>{o.refundedPaise > 0 && <div><dt className="label">Refunded</dt><dd>{formatINR(o.refundedPaise)}</dd></div>}</dl>
        <Button variant="secondary" size="sm" className="mt-4 print:hidden" onClick={() => window.print()}>Print / save as PDF</Button></Card>}
      {o.status === 'refunded' && <Card className="border-amber-500/40 p-4 text-sm">This order was refunded, so downloads are no longer available.</Card>}
      {!paid && o.status !== 'refunded' && <Card className="p-5 text-sm"><p className="font-medium">Payment not completed.</p><p className="mt-1 text-muted">Nothing is unlocked until the payment is verified by our server.</p>{o.project && <LinkButton to={`/dashboard/projects/${o.project.slug}`} size="sm" className="mt-3">Go to the project to pay</LinkButton>}{o.customRequest && <LinkButton to={`/dashboard/custom/${o.customRequest}`} size="sm" className="mt-3">Go to your request to pay</LinkButton>}</Card>}
      {err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}
      {paid && files.length > 0 && <Card className="p-5"><h2 className="font-semibold">Downloads</h2><ul className="mt-3 divide-y divide-line">{files.map((f) => (
        <li key={f._id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{f.label}</p><p className="mono truncate text-xs text-muted">{f.originalName} · {bytes(f.sizeBytes)} · v{f.version}</p><p className="mono truncate text-[10px] text-muted">sha256 {f.sha256.slice(0, 16)}…</p></div><Button size="sm" onClick={() => download(f)}><Download className="size-4" />Download</Button></li>))}</ul>
        <p className="label mt-3">Links expire in 5 minutes and are tied to your account. Always verify the checksum if you re-share files within your team.</p></Card>}
      {paid && guide && <section><h2 className="mb-2 font-semibold">Setup guide</h2><Card className="p-5"><Markdown source={guide} /></Card></section>}
      {paid && o.project && <Card className="flex flex-wrap items-center justify-between gap-3 p-4"><span className="text-sm">Need the college report? Generate your 50+ page project report kit.</span><LinkButton to={`/dashboard/projects/${o.project.slug}#report`} variant="secondary" size="sm">Open report kit</LinkButton></Card>}
      {paid && <Card className="flex flex-wrap items-center justify-between gap-3 p-4"><span className="text-sm">Stuck with setup? Raise a ticket and we’ll help.</span><LinkButton to={`/dashboard/support/new?orderId=${o.id}`} variant="secondary" size="sm"><LifeBuoy className="size-4" />Get support</LinkButton></Card>}
      {attempts.length > 0 && <details className="text-sm"><summary className="label cursor-pointer">payment attempts ({attempts.length})</summary><ul className="mono mt-2 space-y-1 text-xs">{attempts.map((a, i) => <li key={i} className="text-muted">{dt(a.createdAt)} — {a.status}{a.failureReason ? ` (${a.failureReason})` : ''}</li>)}</ul></details>}
    </div>
  );
}
