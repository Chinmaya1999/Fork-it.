import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '@projectforge/shared';
import { api, ApiError } from '@/lib/api';
import { dt, label } from '@/lib/format';
import { useDebounced } from '@/hooks/useTheme';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Select, Skeleton, Textarea } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { Pager } from '@/components/Pager';

export function AdminTickets() {
  const [f, setF] = useState({ q: '', status: '', priority: '', category: '', assigned: '' }); const dq = useDebounced(f.q); const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries({ ...f, q: dq }).filter(([, v]) => v)), page: String(page) }).toString();
  const list = useQuery({ queryKey: ['staff', 'tickets', qs], queryFn: () => api.get<{ items: any[]; total: number; pages: number }>(`/staff/tickets?${qs}`), placeholderData: keepPreviousData });
  const load = useQuery({ queryKey: ['staff', 'workload'], queryFn: () => api.get<{ items: { assignee: string; open: number }[] }>('/staff/tickets/workload') });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  return (
    <div className="space-y-5"><div><p className="label">// support</p><h1 className="display text-3xl">Support tickets</h1></div>
      {load.data && load.data.items.length > 0 && <div className="flex flex-wrap gap-2">{load.data.items.map((w) => <Badge key={w.assignee} tone="brand">{w.assignee}: {w.open} open</Badge>)}</div>}
      <div className="grid gap-3 sm:grid-cols-5"><input aria-label="Search tickets" value={f.q} onChange={set('q')} placeholder="Number or subject…" className="mono h-10 rounded-md border border-line bg-surface px-3 text-sm sm:col-span-2" />
        <Select aria-label="Status" value={f.status} onChange={set('status')} className="h-10"><option value="">Any status</option>{TICKET_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        <Select aria-label="Priority" value={f.priority} onChange={set('priority')} className="h-10"><option value="">Any priority</option>{TICKET_PRIORITIES.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select aria-label="Assignee" value={f.assigned} onChange={set('assigned')} className="h-10"><option value="">Anyone</option><option value="me">Assigned to me</option><option value="none">Unassigned</option></Select></div>
      <Select aria-label="Category" value={f.category} onChange={set('category')} className="h-10 max-w-xs"><option value="">Any category</option>{TICKET_CATEGORIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
      {list.isLoading && <Skeleton className="h-48" />}{list.error && <ErrorState message="Could not load tickets." retry={() => list.refetch()} />}
      {list.data && (list.data.items.length === 0 ? <EmptyState title="No tickets" body="No tickets match these filters." /> : <>
        <p className="label">{list.data.total} tickets</p>
        <Card className="divide-y divide-line">{list.data.items.map((t) => <Link key={t._id} to={`/admin/tickets/${t._id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-surface-2"><div className="min-w-0"><p className="truncate font-medium">{t.subject}</p><p className="label">{t.number} · {t.user?.name} · {label(t.category)} · {t.assignedTo?.name ?? 'unassigned'} · {dt(t.lastActivityAt)}</p></div><div className="flex items-center gap-2"><Badge tone={t.priority === 'urgent' || t.priority === 'high' ? 'amber' : 'neutral'}>{t.priority}</Badge><StatusBadge status={t.status} /></div></Link>)}</Card>
        <Pager page={page} pages={list.data.pages} onPage={setPage} /></>)}
    </div>
  );
}

export function AdminTicketDetail() {
  const { id } = useParams(); const qc = useQueryClient(); const staff = useStaffUsers(); const [body, setBody] = useState(''); const [internal, setInternal] = useState(false); const [setStatus, setSetStatus] = useState(''); const [resolution, setResolution] = useState(''); const [err, setErr] = useState<string>();
  const q = useQuery({ queryKey: ['staff', 'ticket', id], queryFn: () => api.get<{ ticket: any; replies: any[] }>(`/staff/tickets/${id}`), retry: false });
  const done = () => { setErr(undefined); qc.invalidateQueries({ queryKey: ['staff'] }); };
  const reply = useMutation({ mutationFn: () => api.post(`/staff/tickets/${id}/replies`, { body, internal, ...(setStatus && !internal ? { setStatus } : {}) }), onSuccess: () => { setBody(''); setInternal(false); setSetStatus(''); done(); }, onError: (e) => setErr((e as ApiError).message) });
  const patch = useMutation({ mutationFn: (b: Record<string, unknown>) => api.patch(`/staff/tickets/${id}`, b), onSuccess: done, onError: (e) => setErr((e as ApiError).message) });
  if (q.isLoading) return <Skeleton className="h-64" />; if (q.error) return <ErrorState message="Ticket not found." />;
  const { ticket: t, replies } = q.data!;
  return (
    <div className="max-w-4xl space-y-5"><Link to="/admin/tickets" className="label inline-flex items-center gap-1 hover:text-brand"><ArrowLeft className="size-3" />tickets</Link>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="label">{t.number} · {label(t.category)} · opened {dt(t.createdAt)}</p><h1 className="display text-2xl">{t.subject}</h1><p className="text-sm text-muted">{t.user?.name} · {t.user?.email}{t.order ? ` · order ${t.order.ref}` : ''}{t.project ? ` · ${t.project.title}` : ''}</p></div><StatusBadge status={t.status} /></div>
      {err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}
      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <Field label="Status"><Select value={t.status} onChange={(e) => { if (e.target.value === 'resolved' && !resolution && !t.resolution) { setErr('Write a resolution summary below, then choose Resolved.'); return; } patch.mutate({ status: e.target.value, ...(resolution ? { resolution } : {}) }); }}>{TICKET_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></Field>
        <Field label="Priority"><Select value={t.priority} onChange={(e) => patch.mutate({ priority: e.target.value })}>{TICKET_PRIORITIES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Assigned to"><Select value={t.assignedTo?._id ?? ''} onChange={(e) => patch.mutate({ assignedTo: e.target.value || null })}><option value="">Unassigned</option>{staff.data?.items.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.role})</option>)}</Select></Field>
        <div className="sm:col-span-3"><Field label="Resolution summary (shown to the student when resolved)"><Textarea rows={2} value={resolution || t.resolution || ''} onChange={(e) => setResolution(e.target.value)} onBlur={() => resolution && resolution !== t.resolution && patch.mutate({ resolution })} /></Field></div></Card>
      <Card className="p-4"><p className="label mb-1">Student’s description</p><p className="whitespace-pre-wrap text-sm">{t.description}</p></Card>
      <div className="space-y-3">{replies.map((r) => r.kind === 'system' ? <p key={r._id} className="label text-center">— {r.body} · {dt(r.createdAt)} —</p> : (
        <div key={r._id} className={`rounded-lg border p-3 text-sm ${r.internal ? 'border-amber-500/50 bg-amber-500/5' : r.authorRole === 'staff' ? 'border-brand/30 bg-brand/5' : 'border-line bg-surface'}`}><p className="label mb-1">{r.internal ? '🔒 internal note · ' : ''}{r.author?.name ?? r.authorRole} · {dt(r.createdAt)}</p><p className="whitespace-pre-wrap">{r.body}</p></div>))}</div>
      <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) reply.mutate(); }} className="space-y-3"><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={internal ? 'Internal note — the student will NOT see this' : 'Reply to the student…'} aria-label="Reply" className={internal ? 'border-amber-500/60' : ''} />
        <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={internal} onChange={(e) => setInternal(e.target.checked)} />Internal note (staff only)</label>
          {!internal && <Select aria-label="Set status" value={setStatus} onChange={(e) => setSetStatus(e.target.value)} className="h-9 w-48"><option value="">Keep status</option><option value="waiting_student">Waiting for student</option><option value="in_progress">In progress</option></Select>}
          <Button disabled={reply.isPending || !body.trim()}>{internal ? 'Add note' : 'Send reply'}</Button></div></form>
    </div>
  );
}
