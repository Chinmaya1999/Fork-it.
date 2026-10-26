import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Download, Lock, MessagesSquare } from 'lucide-react';
import { formatINR } from '@projectforge/shared';
import { api, ApiError, downloadFile } from '@/lib/api';
import { bytes, day, dt, label } from '@/lib/format';
import { Badge, Button, Card, ErrorState, Input, Skeleton, Textarea } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { PayButton } from '@/features/Checkout';
import { cn } from '@/lib/cn';

const PATH = ['submitted', 'under_review', 'quoted', 'awaiting_advance', 'in_development', 'student_review', 'awaiting_final_payment', 'delivered', 'completed'];
const ACTION_LABEL: Record<string, string> = { approve_delivery: 'Approve delivery', request_revision: 'Request revision', cancel: 'Cancel request', dispute: 'Open a dispute', complete: 'Confirm completion', resume_review: 'I have answered — resume review' };

export default function CustomDetail() {
  const { id } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const [err, setErr] = useState<string>(); const [note, setNote] = useState(''); const [noteFor, setNoteFor] = useState<string>();
  const q = useQuery({ queryKey: ['custom', id], queryFn: () => api.get<any>(`/custom-requests/${id}`), retry: false, refetchInterval: 30000 });
  const refresh = () => { setErr(undefined); qc.invalidateQueries({ queryKey: ['custom'] }); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); };
  const fail = (e: unknown) => setErr((e as ApiError).message);
  const accept = useMutation({ mutationFn: (qid: string) => api.post(`/custom-requests/${id}/quotations/${qid}/accept`), onSuccess: refresh, onError: fail });
  const decline = useMutation({ mutationFn: (qid: string) => api.post(`/custom-requests/${id}/quotations/${qid}/decline`, { reason: note }), onSuccess: () => { setNote(''); setNoteFor(undefined); refresh(); }, onError: fail });
  const act = useMutation({ mutationFn: (a: string) => api.post(`/custom-requests/${id}/actions`, { action: a, note: note || undefined }), onSuccess: () => { setNote(''); setNoteFor(undefined); refresh(); }, onError: fail });
  const comment = useMutation({ mutationFn: ({ mid, body }: { mid: string; body: string }) => api.post(`/custom-requests/${id}/milestones/${mid}/comments`, { body }), onSuccess: refresh, onError: fail });
  const openChat = async () => { try { const r = await api.post<{ conversation: { _id: string } }>(`/conversations/custom/${id}`); nav(`/dashboard/messages/${r.conversation._id}`); } catch (e) { fail(e); } };
  const download = async (fid: string) => { try { const r = await api.post<{ url: string }>(`/files/${fid}/link`); await downloadFile(r.url); } catch (e) { fail(e); } };
  if (q.isLoading) return <Skeleton className="h-72" />; if (q.error) return <ErrorState message="Request not found." />;
  const { request: r, quotations, milestones, orders, files, lockedCount, actions } = q.data; const quote = quotations.find((x: any) => x.status === 'sent' || x.status === 'accepted') ?? quotations[0];
  const stepIdx = PATH.indexOf(r.status === 'clarification' ? 'under_review' : r.status === 'revision_requested' ? 'student_review' : r.status);
  const needsNote = (a: string) => ['request_revision', 'dispute', 'cancel'].includes(a);

  return (
    <div className="max-w-4xl space-y-6">
      <div><Link to="/dashboard/custom" className="label inline-flex items-center gap-1 hover:text-brand"><ArrowLeft className="size-3" />requests</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3"><div><p className="label">{r.ref}</p><h1 className="display text-2xl sm:text-3xl">{r.title}</h1></div><div className="flex items-center gap-2"><Button variant="secondary" size="sm" onClick={openChat}><MessagesSquare className="size-4" />Message the team</Button><StatusBadge status={r.status} /></div></div></div>

      <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Progress">{PATH.map((s, i) => <li key={s} className={cn('mono shrink-0 rounded px-2 py-1 text-[11px]', i < stepIdx ? 'bg-brand/20 text-brand' : i === stepIdx ? 'bg-brand text-onbrand' : 'bg-surface-2 text-muted')}>{label(s)}</li>)}</ol>
      {err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}
      {['rejected', 'cancelled'].includes(r.status) && <Card className="border-amber-500/40 p-4 text-sm">This request is {r.status}. {r.history.at(-1)?.note}</Card>}
      {r.status === 'clarification' && <Card className="border-brand/40 p-4 text-sm">The team asked for more details. Reply in <button className="text-brand underline" onClick={openChat}>Messages</button>, then confirm below.</Card>}

      {quote && (r.status === 'quoted' || ['awaiting_advance', 'in_development'].includes(r.status) || quote.status === 'accepted') && (
        <Card className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Quotation v{quote.version}</h2><Badge tone={quote.status === 'accepted' ? 'green' : 'brand'}>{quote.status}</Badge></div>
          <div className="grid gap-3 sm:grid-cols-4">{[['Total', formatINR(quote.totalPaise)], [`Advance (${quote.advancePercent}%)`, formatINR(quote.advancePaise)], ['Final payment', formatINR(quote.finalPaise)], ['Delivery', `${quote.deliveryDays} days`]].map(([k, v]) => <div key={k}><p className="label">{k}</p><p className="mono font-bold">{v}</p></div>)}</div>
          <div><p className="label">Scope</p><p className="whitespace-pre-wrap text-sm">{quote.scope}</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><p className="label">Deliverables</p><ul className="list-disc pl-5 text-sm">{quote.deliverables.map((d: string) => <li key={d}>{d}</li>)}</ul></div><div><p className="label">Planned milestones</p><ol className="list-decimal pl-5 text-sm">{quote.milestones.map((m: any) => <li key={m.title}>{m.title}{m.dueInDays ? ` — day ${m.dueInDays}` : ''}</li>)}</ol></div></div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="label">Revisions included</dt><dd>{quote.revisionLimit}</dd></div><div><dt className="label">Support after delivery</dt><dd>{quote.supportDays} days</dd></div><div className="sm:col-span-2"><dt className="label">Final payment condition</dt><dd>{quote.finalPaymentCondition}</dd></div>{quote.cancellationTerms && <div className="sm:col-span-2"><dt className="label">Cancellation</dt><dd>{quote.cancellationTerms}</dd></div>}{quote.refundTerms && <div className="sm:col-span-2"><dt className="label">Refunds</dt><dd>{quote.refundTerms}</dd></div>}</dl>
          {r.status === 'quoted' && quote.status === 'sent' && <div className="space-y-3 border-t border-line pt-4"><div className="flex flex-wrap gap-2"><Button onClick={() => accept.mutate(quote._id)} disabled={accept.isPending}><Check className="size-4" />Accept quotation</Button><Button variant="secondary" onClick={() => setNoteFor('decline')}>Decline</Button></div>
            {noteFor === 'decline' && <div className="space-y-2"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What would you like changed? (optional)" /><Button size="sm" variant="secondary" onClick={() => decline.mutate(quote._id)}>Confirm decline</Button></div>}
            <p className="label">Accepting freezes these terms. You can still discuss details with the team before paying the advance.</p></div>}
        </Card>)}

      {r.status === 'awaiting_advance' && <Card className="flex flex-wrap items-center justify-between gap-3 border-brand/40 p-5"><div><p className="font-semibold">Pay the advance to start development</p><p className="mono text-2xl font-bold text-brand">{formatINR(r.agreed.advancePaise)}</p></div><PayButton onPaid={refresh} create={() => api.post(`/custom-requests/${id}/pay`, { stage: 'advance' })}>Pay advance</PayButton></Card>}
      {r.status === 'awaiting_final_payment' && <Card className="flex flex-wrap items-center justify-between gap-3 border-brand/40 p-5"><div><p className="font-semibold">Final payment — releases your deliverables</p><p className="mono text-2xl font-bold text-brand">{formatINR(r.agreed.finalPaise)}</p><p className="label mt-1">Files unlock only after our server verifies the payment.</p></div><PayButton onPaid={refresh} create={() => api.post(`/custom-requests/${id}/pay`, { stage: 'final' })}>Pay final amount</PayButton></Card>}
      {r.status === 'student_review' && <Card className="p-4 text-sm">{r.studentApproved ? <span className="flex items-center gap-2"><Check className="size-4 text-brand" />You approved this delivery. The team will request the final payment.</span> : <>Your project is ready for review. Approve it, or request a revision ({r.agreed?.revisionLimit - r.revisionsUsed} of {r.agreed?.revisionLimit} left).</>}</Card>}

      {actions.length > 0 && <Card className="space-y-3 p-4"><p className="label">Actions</p><div className="flex flex-wrap gap-2">{actions.map((a: string) => <Button key={a} size="sm" variant={a === 'approve_delivery' || a === 'complete' ? 'primary' : 'secondary'} onClick={() => (needsNote(a) ? setNoteFor(a) : act.mutate(a))} disabled={act.isPending}>{ACTION_LABEL[a] ?? label(a)}</Button>)}</div>
        {noteFor && noteFor !== 'decline' && <div className="space-y-2"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={noteFor === 'request_revision' ? 'Describe the changes you need…' : 'Tell us why…'} /><div className="flex gap-2"><Button size="sm" onClick={() => act.mutate(noteFor)} disabled={!note.trim() && noteFor !== 'cancel'}>Confirm: {ACTION_LABEL[noteFor]}</Button><Button size="sm" variant="ghost" onClick={() => setNoteFor(undefined)}>Never mind</Button></div></div>}</Card>}

      {milestones.length > 0 && <section><h2 className="mb-3 font-semibold">Progress</h2><div className="space-y-3">{milestones.map((m: any) => <MilestoneCard key={m._id} m={m} onComment={(body: string) => comment.mutate({ mid: m._id, body })} />)}</div></section>}

      {(files.length > 0 || lockedCount > 0) && <Card className="p-5"><h2 className="flex items-center gap-2 font-semibold">{files.length ? <Download className="size-4 text-brand" /> : <Lock className="size-4 text-muted" />}Final deliverables</h2>
        {files.length ? <ul className="mt-3 divide-y divide-line">{files.map((f: any) => <li key={f._id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="text-sm font-medium">{f.label}</p><p className="mono truncate text-xs text-muted">{f.originalName} · {bytes(f.sizeBytes)}</p></div><Button size="sm" onClick={() => download(f._id)}><Download className="size-4" />Download</Button></li>)}</ul>
          : <p className="mt-2 text-sm text-muted">{lockedCount} file(s) are ready and will unlock as soon as your final payment is verified.</p>}</Card>}

      {orders.length > 0 && <Card className="p-5"><h2 className="font-semibold">Payments</h2><ul className="mt-2 divide-y divide-line">{orders.map((o: any) => <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span className="mono">{o.ref} · {label(o.type.replace('custom_', ''))}</span><span className="flex items-center gap-3"><span className="mono font-bold">{formatINR(o.amountPaise)}</span><StatusBadge status={o.status} />{o.status === 'paid' && <Link to={`/dashboard/orders/${o.id}`} className="text-xs text-brand underline">receipt</Link>}</span></li>)}</ul></Card>}

      <details><summary className="label cursor-pointer">request details &amp; history</summary>
        <Card className="mt-3 space-y-4 p-5 text-sm"><div><p className="label">Idea</p><p className="whitespace-pre-wrap">{r.idea}</p></div>
          {r.features?.length > 0 && <div><p className="label">Features</p><ul className="list-disc pl-5">{r.features.map((f: string) => <li key={f}>{f}</li>)}</ul></div>}
          <div className="grid gap-2 sm:grid-cols-3">{[['Degree', r.degree], ['Type', r.appType], ['Deadline', day(r.deadline)], ['Budget', r.budgetRange], ['Tech', r.preferredTech?.join(', ')], ['Database', r.databaseReq]].map(([k, v]) => v ? <div key={k}><p className="label">{k}</p><p>{v}</p></div> : null)}</div>
          <ol className="space-y-1 border-t border-line pt-3">{r.history.map((h: any, i: number) => <li key={i} className="mono text-xs text-muted">{dt(h.at)} — <span className="text-ink">{label(h.status)}</span>{h.note ? ` · ${h.note}` : ''}</li>)}</ol></Card></details>
    </div>
  );
}

function MilestoneCard({ m, onComment }: { m: any; onComment: (b: string) => void }) {
  const [t, setT] = useState('');
  return (
    <Card className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className={cn('grid size-5 place-items-center rounded-full border text-[10px]', m.status === 'completed' ? 'border-brand bg-brand text-onbrand' : m.status === 'in_progress' ? 'border-brand text-brand' : 'border-line')}>{m.status === 'completed' ? <Check className="size-3" /> : ''}</span><p className="font-semibold">{m.title}</p></div><div className="flex items-center gap-2"><span className="label">{m.dueDate ? `due ${day(m.dueDate)}` : ''}</span><StatusBadge status={m.status} /></div></div>
      {m.description && <p className="mt-2 text-sm text-muted">{m.description}</p>}{m.progressNotes && <p className="mt-2 rounded bg-surface-2 p-2 text-sm"><span className="label">Update: </span>{m.progressNotes}</p>}
      {m.completedAt && <p className="label mt-1">completed {dt(m.completedAt)}</p>}
      {m.comments?.length > 0 && <ul className="mt-3 space-y-1">{m.comments.map((c: any, i: number) => <li key={i} className="text-sm"><span className="label">{c.role === 'staff' ? 'Team' : 'You'} · {dt(c.at)}: </span>{c.body}</li>)}</ul>}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onComment(t.trim()); setT(''); } }}><Input value={t} onChange={(e) => setT(e.target.value)} placeholder="Add a comment…" maxLength={1000} aria-label={`Comment on ${m.title}`} className="h-9" /><Button size="sm" variant="secondary" disabled={!t.trim()}>Post</Button></form></Card>
  );
}
