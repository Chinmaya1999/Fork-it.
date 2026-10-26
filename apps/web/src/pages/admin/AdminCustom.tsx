import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessagesSquare, Trash2, Upload } from 'lucide-react';
import { CUSTOM_STATUSES, formatINR, MILESTONE_STATUSES } from '@projectforge/shared';
import { api, ApiError } from '@/lib/api';
import { bytes, day, dt, label } from '@/lib/format';
import { useDebounced } from '@/hooks/useTheme';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Select, Skeleton, Textarea } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { Pager } from '@/components/Pager';

export function AdminCustomList() {
  const [text, setText] = useState(''); const dq = useDebounced(text); const [status, setStatus] = useState(''); const [assigned, setAssigned] = useState(''); const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ ...(dq && { q: dq }), ...(status && { status }), ...(assigned && { assigned }), page: String(page) }).toString();
  const q = useQuery({ queryKey: ['admin', 'custom', qs], queryFn: () => api.get<{ items: any[]; total: number; pages: number }>(`/admin/custom-requests?${qs}`), placeholderData: keepPreviousData });
  return (
    <div className="space-y-5"><div><p className="label">// custom projects</p><h1 className="display text-3xl">Custom requests</h1></div>
      <div className="flex flex-wrap gap-3"><input aria-label="Search requests" value={text} onChange={(e) => { setText(e.target.value); setPage(1); }} placeholder="Reference or title…" className="mono h-10 min-w-56 flex-1 rounded-md border border-line bg-surface px-3 text-sm" />
        <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 w-52"><option value="">All statuses</option>{CUSTOM_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        <Select aria-label="Assignee" value={assigned} onChange={(e) => { setAssigned(e.target.value); setPage(1); }} className="h-10 w-44"><option value="">Anyone</option><option value="me">Assigned to me</option><option value="none">Unassigned</option></Select></div>
      {q.isLoading && <Skeleton className="h-48" />}{q.error && <ErrorState message="Could not load requests." retry={() => q.refetch()} />}
      {q.data && (q.data.items.length === 0 ? <EmptyState title="No requests" body="New custom project requests will appear here." /> : <>
        <Card className="divide-y divide-line">{q.data.items.map((r) => <Link key={r._id} to={`/admin/custom/${r._id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-surface-2"><div className="min-w-0"><p className="truncate font-medium">{r.title}</p><p className="label">{r.ref} · {r.user?.name} · {r.assignedTo?.name ?? 'unassigned'}{r.agreed?.totalPaise ? ` · ${formatINR(r.agreed.totalPaise)}` : ''} · {dt(r.updatedAt)}</p></div><StatusBadge status={r.status} /></Link>)}</Card>
        <Pager page={page} pages={q.data.pages} onPage={setPage} /></>)}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = { start_review: 'Start review', ask_clarification: 'Ask for clarification', resume_review: 'Back to review', reject: 'Reject request', start_testing: 'Move to internal testing', send_to_review: 'Send to student review', back_to_dev: 'Back to development', request_final_payment: 'Request final payment', complete: 'Mark completed', cancel: 'Cancel request', resolve_dispute: 'Resolve dispute' };
const blankQuote = { totalRupees: '', advancePercent: '30', deliveryDays: '30', scope: '', deliverables: 'Complete source code\nDatabase file\nSetup documentation', milestones: 'Design | 5\nBackend | 15\nFrontend | 25\nTesting & delivery | 30', revisionLimit: '2', supportDays: '30', finalPaymentCondition: 'Due after you approve the delivery', cancellationTerms: '', refundTerms: '' };

export function AdminCustomDetail() {
  const { id } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const staff = useStaffUsers();
  const [err, setErr] = useState<string>(); const [ok, setOk] = useState<string>(); const [note, setNote] = useState(''); const [force, setForce] = useState(false); const [quote, setQuote] = useState(blankQuote);
  const q = useQuery({ queryKey: ['admin', 'custom-detail', id], queryFn: () => api.get<any>(`/admin/custom-requests/${id}`), retry: false, refetchInterval: 30000 });
  const done = (m?: string) => { setErr(undefined); if (m) setOk(m); qc.invalidateQueries({ queryKey: ['admin'] }); };
  const fail = (e: unknown) => { setOk(undefined); setErr((e as ApiError).message); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const action = useMutation({ mutationFn: (b: Record<string, unknown>) => api.post(`/admin/custom-requests/${id}/actions`, b), onSuccess: () => { setNote(''); setForce(false); done('Status updated.'); }, onError: fail });
  const assign = useMutation({ mutationFn: (assignedTo: string | null) => api.patch(`/admin/custom-requests/${id}/assign`, { assignedTo }), onSuccess: () => done('Assignment updated.'), onError: fail });
  const sendQuote = useMutation({ mutationFn: () => api.post(`/admin/custom-requests/${id}/quotations`, {
    totalPaise: Math.round(Number(quote.totalRupees) * 100), advancePercent: Number(quote.advancePercent), deliveryDays: Number(quote.deliveryDays), scope: quote.scope, deliverables: quote.deliverables.split('\n').map((x) => x.trim()).filter(Boolean),
    milestones: quote.milestones.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0]).map((p) => ({ title: p[0], dueInDays: Number(p[1]) || 0, ...(p[2] ? { description: p[2] } : {}) })),
    revisionLimit: Number(quote.revisionLimit), supportDays: Number(quote.supportDays), finalPaymentCondition: quote.finalPaymentCondition, cancellationTerms: quote.cancellationTerms || undefined, refundTerms: quote.refundTerms || undefined }), onSuccess: () => done('Quotation sent to the student.'), onError: fail });
  const chat = async () => { try { const r = await api.post<{ conversation: { _id: string } }>(`/staff/conversations/custom/${id}`); nav(`/admin/messages/${r.conversation._id}`); } catch (e) { fail(e); } };
  if (q.isLoading) return <Skeleton className="h-72" />; if (q.error) return <ErrorState message="Request not found." />;
  const d = q.data; const r = d.request; const canQuote = ['submitted', 'under_review', 'clarification', 'quoted'].includes(r.status);
  const total = Math.round(Number(quote.totalRupees || 0) * 100); const adv = Math.round((total * Number(quote.advancePercent || 0)) / 100);
  const uq = (k: keyof typeof blankQuote) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setQuote({ ...quote, [k]: e.target.value });

  return (
    <div className="max-w-5xl space-y-6"><Link to="/admin/custom" className="label inline-flex items-center gap-1 hover:text-brand"><ArrowLeft className="size-3" />requests</Link>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="label">{r.ref} · submitted {dt(r.createdAt)}</p><h1 className="display text-2xl sm:text-3xl">{r.title}</h1><p className="text-sm text-muted">{d.user?.name} · {d.user?.email}{d.user?.college ? ` · ${d.user.college}` : ''}</p></div><div className="flex items-center gap-2"><Button variant="secondary" size="sm" onClick={chat}><MessagesSquare className="size-4" />Message student</Button><StatusBadge status={r.status} /></div></div>
      {err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}{ok && <p role="status" className="rounded bg-brand/10 p-3 text-sm text-[color:var(--brand-text)]">{ok}</p>}

      <Card className="grid gap-3 p-4 sm:grid-cols-4">{[['Agreed total', r.agreed?.totalPaise ? formatINR(r.agreed.totalPaise) : '—'], ['Advance', r.agreed?.advancePaise ? `${formatINR(r.agreed.advancePaise)} ${d.advancePaid ? '✓ paid' : '· pending'}` : '—'], ['Final', r.agreed?.finalPaise ? `${formatINR(r.agreed.finalPaise)} ${d.finalPaid ? '✓ paid' : '· pending'}` : '—'], ['Outstanding balance', d.outstandingPaise == null ? '—' : formatINR(d.outstandingPaise)]].map(([k, v]) => <div key={k}><p className="label">{k}</p><p className="mono text-sm font-bold">{v}</p></div>)}
        <div className="sm:col-span-2"><Field label="Assigned developer"><Select value={r.assignedTo ?? ''} onChange={(e) => assign.mutate(e.target.value || null)}><option value="">Unassigned</option>{staff.data?.items.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.role})</option>)}</Select></Field></div>
        <div className="sm:col-span-2"><p className="label">Revisions used</p><p className="mono text-sm font-bold">{r.revisionsUsed} / {r.agreed?.revisionLimit ?? '—'} · student {r.studentApproved ? 'approved ✓' : 'has not approved'}</p></div></Card>

      <Card className="space-y-3 p-4"><p className="label">Workflow actions</p>
        {d.staffActions.length === 0 ? <p className="text-sm text-muted">No staff actions available in the “{label(r.status)}” state.</p> : <div className="flex flex-wrap gap-2">{d.staffActions.map((a: string) => <Button key={a} size="sm" variant={['reject', 'cancel'].includes(a) ? 'secondary' : 'primary'} disabled={action.isPending} onClick={() => { if (['reject', 'cancel'].includes(a) && !note.trim()) { setErr('Enter a reason in the note box first.'); return; } action.mutate({ action: a, note: note || undefined, force }); }}>{ACTION_LABEL[a] ?? label(a)}</Button>)}</div>}
        {r.status === 'disputed' && <div className="flex flex-wrap gap-2"><span className="label self-center">Resolve into:</span>{['in_development', 'student_review', 'completed', 'cancelled'].map((to) => <Button key={to} size="sm" variant="secondary" onClick={() => action.mutate({ action: 'resolve_dispute', to, note: note || 'Dispute resolved' })}>{label(to)}</Button>)}</div>}
        <Input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note / reason (required for reject & cancel; shown in history)" maxLength={500} />
        {d.staffActions.includes('request_final_payment') && !r.studentApproved && <label className="flex items-center gap-2 text-xs text-amber-500"><input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={force} onChange={(e) => setForce(e.target.checked)} />Student hasn’t approved — force (only if the agreed acceptance condition has been met; audited)</label>}</Card>

      {canQuote && <Card className="space-y-4 p-5"><h2 className="font-semibold">{d.quotations.length ? `Revise quotation (will become v${d.quotations[0].version + 1})` : 'Create quotation'}</h2>
        <div className="grid gap-4 sm:grid-cols-4"><Field label="Total ₹"><Input type="number" min="1" value={quote.totalRupees} onChange={uq('totalRupees')} /></Field><Field label="Advance %"><Input type="number" min="1" max="100" value={quote.advancePercent} onChange={uq('advancePercent')} /></Field><Field label="Delivery (days)"><Input type="number" min="1" value={quote.deliveryDays} onChange={uq('deliveryDays')} /></Field>
          <div className="self-end text-sm"><p className="label">Schedule</p><p className="mono font-bold">{formatINR(adv)} + {formatINR(Math.max(total - adv, 0))}</p></div></div>
        <Field label="Scope of work"><Textarea rows={4} value={quote.scope} onChange={uq('scope')} placeholder="What exactly is included (and what is not)…" /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Deliverables (one per line)"><Textarea rows={4} value={quote.deliverables} onChange={uq('deliverables')} /></Field><Field label="Milestones — “Title | due in days | description”"><Textarea rows={4} value={quote.milestones} onChange={uq('milestones')} /></Field></div>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Revisions included"><Input type="number" min="0" value={quote.revisionLimit} onChange={uq('revisionLimit')} /></Field><Field label="Support days after delivery"><Input type="number" min="0" value={quote.supportDays} onChange={uq('supportDays')} /></Field><Field label="Final payment condition"><Input value={quote.finalPaymentCondition} onChange={uq('finalPaymentCondition')} /></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Cancellation terms"><Textarea rows={2} value={quote.cancellationTerms} onChange={uq('cancellationTerms')} /></Field><Field label="Refund terms"><Textarea rows={2} value={quote.refundTerms} onChange={uq('refundTerms')} /></Field></div>
        <Button disabled={sendQuote.isPending || total < 100 || quote.scope.length < 20} onClick={() => sendQuote.mutate()}>{sendQuote.isPending ? 'Sending…' : 'Send quotation to student'}</Button></Card>}

      {d.quotations.length > 0 && <Card className="p-5"><h2 className="font-semibold">Quotation history</h2><ul className="mt-2 divide-y divide-line">{d.quotations.map((x: any) => <li key={x._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span className="mono">v{x.version} · {formatINR(x.totalPaise)} ({x.advancePercent}% advance) · {x.deliveryDays}d</span><span className="flex items-center gap-2"><span className="label">{dt(x.createdAt)}</span><Badge tone={x.status === 'accepted' ? 'green' : x.status === 'sent' ? 'brand' : 'neutral'}>{x.status}</Badge></span>{x.declineReason && <span className="w-full text-xs text-amber-500">Declined: {x.declineReason}</span>}</li>)}</ul></Card>}

      <MilestonesAdmin id={id!} milestones={d.milestones} staff={staff.data?.items ?? []} onChange={() => done()} onError={fail} />
      <FilesAdmin id={id!} files={d.files} finalPaid={d.finalPaid} onChange={() => done('Saved.')} onError={fail} />

      {d.orders.length > 0 && <Card className="p-5"><h2 className="font-semibold">Payments</h2><ul className="mt-2 divide-y divide-line">{d.orders.map((o: any) => <li key={o._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><Link to={`/admin/orders/${o._id}`} className="mono hover:text-brand">{o.ref} · {label(o.type.replace('custom_', ''))}</Link><span className="flex items-center gap-3"><span className="mono font-bold">{formatINR(o.amountPaise)}</span><StatusBadge status={o.status} /></span></li>)}</ul></Card>}

      <details><summary className="label cursor-pointer">request details &amp; history</summary><Card className="mt-3 space-y-3 p-5 text-sm"><p className="whitespace-pre-wrap">{r.idea}</p>{r.features?.length > 0 && <ul className="list-disc pl-5">{r.features.map((f: string) => <li key={f}>{f}</li>)}</ul>}
        <div className="grid gap-2 sm:grid-cols-3">{[['Degree', r.degree], ['Department', r.department], ['Type', r.appType], ['Deadline', day(r.deadline)], ['Budget', r.budgetRange], ['Tech', r.preferredTech?.join(', ')], ['Roles', r.roles?.join(', ')], ['Database', r.databaseReq], ['Docs', r.docsRequired], ['Deployment', r.deploymentReq]].map(([k, v]) => v ? <div key={k}><p className="label">{k}</p><p>{v}</p></div> : null)}</div>
        {r.references?.length > 0 && <div><p className="label">References</p>{r.references.map((u: string) => <a key={u} href={u} target="_blank" rel="noopener noreferrer nofollow" className="block break-all text-brand underline">{u}</a>)}</div>}
        <ol className="space-y-1 border-t border-line pt-3">{r.history.map((h: any, i: number) => <li key={i} className="mono text-xs text-muted">{dt(h.at)} — <span className="text-ink">{label(h.status)}</span> ({h.role}){h.note ? ` · ${h.note}` : ''}</li>)}</ol></Card></details>
    </div>
  );
}

function MilestonesAdmin({ id, milestones, staff, onChange, onError }: { id: string; milestones: any[]; staff: { _id: string; name: string }[]; onChange: () => void; onError: (e: unknown) => void }) {
  const [t, setT] = useState('');
  const add = useMutation({ mutationFn: () => api.post(`/admin/custom-requests/${id}/milestones`, { title: t }), onSuccess: () => { setT(''); onChange(); }, onError });
  const patch = useMutation({ mutationFn: ({ mid, b }: { mid: string; b: Record<string, unknown> }) => api.patch(`/admin/custom-requests/${id}/milestones/${mid}`, b), onSuccess: onChange, onError });
  const del = useMutation({ mutationFn: (mid: string) => api.delete(`/admin/custom-requests/${id}/milestones/${mid}`), onSuccess: onChange, onError });
  return (
    <Card className="space-y-3 p-5"><h2 className="font-semibold">Milestones</h2>
      {milestones.length === 0 && <p className="text-sm text-muted">Milestones from the accepted quotation appear here once the advance is paid. You can also add your own.</p>}
      {milestones.map((m) => <MilestoneRow key={m._id} m={m} staff={staff} onPatch={(b) => patch.mutate({ mid: m._id, b })} onDelete={() => { if (confirm('Delete this milestone?')) del.mutate(m._id); }} />)}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (t.trim()) add.mutate(); }}><Input value={t} onChange={(e) => setT(e.target.value)} placeholder="Add a milestone…" aria-label="New milestone" /><Button variant="secondary" disabled={!t.trim()}>Add</Button></form></Card>
  );
}
function MilestoneRow({ m, staff, onPatch, onDelete }: { m: any; staff: { _id: string; name: string }[]; onPatch: (b: Record<string, unknown>) => void; onDelete: () => void }) {
  const [notes, setNotes] = useState(m.progressNotes ?? '');
  return (
    <div className="space-y-2 rounded-md border border-line p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{m.title} {m.dueDate && <span className="label">due {day(m.dueDate)}</span>}</p>
      <div className="flex items-center gap-2"><Select aria-label={`Status of ${m.title}`} value={m.status} onChange={(e) => onPatch({ status: e.target.value })} className="h-9 w-36">{MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        <Select aria-label={`Assignee of ${m.title}`} value={m.assignee?._id ?? ''} onChange={(e) => onPatch({ assignee: e.target.value || null })} className="h-9 w-36"><option value="">Unassigned</option>{staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</Select>
        <Button size="sm" variant="ghost" aria-label={`Delete ${m.title}`} onClick={onDelete}><Trash2 className="size-4 text-red-500" /></Button></div></div>
      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (m.progressNotes ?? '') && onPatch({ progressNotes: notes })} placeholder="Progress notes (visible to the student)" aria-label={`Progress notes for ${m.title}`} />
      {m.comments?.length > 0 && <ul className="space-y-0.5">{m.comments.map((c: any, i: number) => <li key={i} className="text-xs"><span className="label">{c.author?.name ?? c.role} · {dt(c.at)}: </span>{c.body}</li>)}</ul>}</div>
  );
}

export function FilesAdmin({ id, files, finalPaid, onChange, onError, kind = 'custom' }: { id: string; files: any[]; finalPaid?: boolean; onChange: () => void; onError: (e: unknown) => void; kind?: 'custom' | 'project' }) {
  const [lbl, setLbl] = useState(''); const [k, setK] = useState('source'); const [ver, setVer] = useState('1.0.0'); const [file, setFile] = useState<File | null>(null);
  const up = useMutation({ mutationFn: () => { const f = new FormData(); f.append('label', lbl); f.append('kind', k); f.append('version', ver); f.append('file', file!); return api.upload(kind === 'custom' ? `/admin/custom-requests/${id}/files` : `/admin/projects/${id}/files`, f); }, onSuccess: () => { setLbl(''); setFile(null); onChange(); }, onError });
  const del = useMutation({ mutationFn: (fid: string) => api.delete(`/admin/files/${fid}`), onSuccess: onChange, onError });
  return (
    <Card className="space-y-3 p-5"><h2 className="font-semibold">{kind === 'custom' ? 'Final deliverables' : 'Downloadable files'}</h2>
      <p className="text-sm text-muted">{kind === 'custom' ? `Locked for the student until the final payment is verified${finalPaid ? ' — it has been, so they can download now.' : '.'}` : 'Only customers with a verified paid order can download these. Allowed: zip, sql, pdf, md, txt, docx, pptx, png, jpg.'}</p>
      {files.length > 0 && <ul className="divide-y divide-line">{files.map((f) => <li key={f._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><div className="min-w-0"><p className="font-medium">{f.label} <span className="label">({f.kind})</span></p><p className="mono truncate text-xs text-muted">{f.originalName} · {bytes(f.sizeBytes)} · sha256 {f.sha256.slice(0, 12)}…</p></div><Button size="sm" variant="ghost" aria-label={`Delete ${f.label}`} onClick={() => { if (confirm(`Delete “${f.label}”? Customers lose access.`)) del.mutate(f._id); }}><Trash2 className="size-4 text-red-500" /></Button></li>)}</ul>}
      <div className="grid gap-3 sm:grid-cols-[1fr_130px_90px]"><Input value={lbl} onChange={(e) => setLbl(e.target.value)} placeholder="Label, e.g. Source code (ZIP)" aria-label="File label" maxLength={120} /><Select aria-label="Kind" value={k} onChange={(e) => setK(e.target.value)}><option value="source">source</option><option value="database">database</option><option value="docs">docs</option><option value="other">other</option></Select>{kind === 'project' && <Input value={ver} onChange={(e) => setVer(e.target.value)} aria-label="Version" />}</div>
      <div className="flex flex-wrap items-center gap-3"><input type="file" aria-label="Choose file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mono text-xs" /><Button size="sm" disabled={!file || !lbl.trim() || up.isPending} onClick={() => up.mutate()}><Upload className="size-4" />{up.isPending ? 'Uploading…' : 'Upload'}</Button></div>
      <p className="label">Uploaded files are checked by type and signature. Antivirus scanning is not yet configured — only upload files you built or trust.</p></Card>
  );
}
