import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LifeBuoy, Plus } from 'lucide-react';
import { TICKET_CATEGORIES, TICKET_STATUSES } from '@projectforge/shared';
import { api, ApiError } from '@/lib/api';
import { dt, label } from '@/lib/format';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LinkButton, Select, Skeleton, Textarea } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import type { OrderView } from './Orders';

export interface Ticket { _id: string; number: string; subject: string; description: string; category: string; priority: string; status: string; resolution?: string; createdAt: string; lastActivityAt: string }
export function TicketsList() {
  const [status, setStatus] = useState('');
  const q = useQuery({ queryKey: ['tickets', status], queryFn: () => api.get<{ items: Ticket[] }>(`/tickets${status ? `?status=${status}` : ''}`) });
  return (
    <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="label">// my work</p><h1 className="display text-3xl">Support tickets</h1></div><LinkButton to="/dashboard/support/new"><Plus className="size-4" />New ticket</LinkButton></div>
      <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-xs"><option value="">All statuses</option>{TICKET_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
      {q.isLoading && <Skeleton className="h-32" />}{q.error && <ErrorState message="Could not load tickets." retry={() => q.refetch()} />}
      {q.data && (q.data.items.length === 0 ? <EmptyState title="No tickets" body="Having trouble installing or running a project? Open a ticket and we’ll help." action={<LinkButton to="/dashboard/support/new"><LifeBuoy className="size-4" />Open a ticket</LinkButton>} />
        : <div className="space-y-3">{q.data.items.map((t) => <Link key={t._id} to={`/dashboard/support/${t._id}`}><Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-brand"><div className="min-w-0"><p className="truncate font-semibold">{t.subject}</p><p className="label">{t.number} · {label(t.category)} · updated {dt(t.lastActivityAt)}</p></div><StatusBadge status={t.status} /></Card></Link>)}</div>)}
    </div>
  );
}

export function NewTicket() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const qc = useQueryClient();
  const [f, setF] = useState({ subject: '', description: '', category: 'installation', orderId: sp.get('orderId') ?? '' }); const [err, setErr] = useState<string>();
  const orders = useQuery({ queryKey: ['orders'], queryFn: () => api.get<{ items: OrderView[] }>('/orders') });
  const create = useMutation({ mutationFn: () => api.post<{ ticket: Ticket }>('/tickets', { ...f, orderId: f.orderId || undefined }), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['tickets'] }); nav(`/dashboard/support/${r.ticket._id}`); }, onError: (e) => setErr((e as ApiError).message) });
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="max-w-2xl space-y-6"><div><Link to="/dashboard/support" className="label inline-flex items-center gap-1 hover:text-brand"><ArrowLeft className="size-3" />tickets</Link><h1 className="display text-3xl">New support ticket</h1></div>
      <Card className="p-6"><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setErr(undefined); create.mutate(); }}>
        {err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}
        <Field label="Subject"><Input required minLength={5} maxLength={160} value={f.subject} onChange={up('subject')} placeholder="npm install fails with ERESOLVE" /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Category"><Select value={f.category} onChange={up('category')}>{TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select></Field>
          <Field label="Related order (optional)"><Select value={f.orderId} onChange={up('orderId')}><option value="">None</option>{orders.data?.items.filter((o) => o.status === 'paid').map((o) => <option key={o.id} value={o.id}>{o.ref} — {o.title}</option>)}</Select></Field></div>
        <Field label="Describe the problem"><Textarea required minLength={10} maxLength={5000} rows={7} value={f.description} onChange={up('description')} placeholder="What did you try? Paste the exact error message and your OS / versions." /></Field>
        <Button disabled={create.isPending}>{create.isPending ? 'Submitting…' : 'Submit ticket'}</Button></form></Card>
    </div>
  );
}

export function TicketDetail() {
  const { id } = useParams(); const qc = useQueryClient(); const [body, setBody] = useState(''); const [err, setErr] = useState<string>();
  const q = useQuery({ queryKey: ['ticket', id], queryFn: () => api.get<{ ticket: Ticket; replies: { _id: string; authorRole: string; kind: string; body: string; createdAt: string; author?: { name: string } }[]; canReopen: boolean }>(`/tickets/${id}`), retry: false });
  useEffect(() => { const t = setInterval(() => q.refetch(), 20000); return () => clearInterval(t); }, [q]);
  const done = () => { setErr(undefined); qc.invalidateQueries({ queryKey: ['ticket', id] }); qc.invalidateQueries({ queryKey: ['tickets'] }); };
  const reply = useMutation({ mutationFn: () => api.post(`/tickets/${id}/replies`, { body }), onSuccess: () => { setBody(''); done(); }, onError: (e) => setErr((e as ApiError).message) });
  const act = useMutation({ mutationFn: (a: 'close' | 'reopen') => api.post(`/tickets/${id}/${a}`), onSuccess: done, onError: (e) => setErr((e as ApiError).message) });
  if (q.isLoading) return <Skeleton className="h-64" />; if (q.error) return <ErrorState message="Ticket not found." />;
  const { ticket: t, replies, canReopen } = q.data!;
  return (
    <div className="max-w-3xl space-y-5"><Link to="/dashboard/support" className="label inline-flex items-center gap-1 hover:text-brand"><ArrowLeft className="size-3" />tickets</Link>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="label">{t.number} · {label(t.category)}</p><h1 className="display text-2xl sm:text-3xl">{t.subject}</h1></div><div className="flex items-center gap-2"><Badge>{t.priority}</Badge><StatusBadge status={t.status} /></div></div>
      <Card className="p-4"><p className="label mb-1">Your description · {dt(t.createdAt)}</p><p className="whitespace-pre-wrap text-sm">{t.description}</p></Card>
      {t.resolution && <Card className="border-brand/40 p-4 text-sm"><p className="label mb-1">Resolution</p>{t.resolution}</Card>}
      <div className="space-y-3">{replies.map((r) => r.kind === 'system' ? <p key={r._id} className="label text-center">— {r.body} · {dt(r.createdAt)} —</p> : (
        <div key={r._id} className={`flex flex-col ${r.authorRole === 'student' ? 'items-end' : 'items-start'}`}><div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${r.authorRole === 'student' ? 'bg-brand text-onbrand' : 'bg-surface-2'}`}>{r.body}</div><span className="label mt-0.5">{r.authorRole === 'staff' ? `${r.author?.name ?? 'Support'} · ` : ''}{dt(r.createdAt)}</span></div>))}</div>
      {err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}
      {t.status !== 'closed' ? <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) reply.mutate(); }} className="space-y-3"><Textarea rows={4} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply…" aria-label="Reply" />
        <div className="flex flex-wrap gap-2"><Button disabled={reply.isPending || !body.trim()}>Send reply</Button><Button type="button" variant="secondary" onClick={() => act.mutate('close')}>Close ticket</Button></div></form>
        : <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span>This ticket is closed.</span>{canReopen ? <Button size="sm" onClick={() => act.mutate('reopen')}>Reopen</Button> : <span className="text-muted">It can no longer be reopened — please open a new ticket.</span>}</Card>}
      {t.status === 'resolved' && <Button variant="secondary" size="sm" onClick={() => act.mutate('close')}>Mark as closed</Button>}
    </div>
  );
}
