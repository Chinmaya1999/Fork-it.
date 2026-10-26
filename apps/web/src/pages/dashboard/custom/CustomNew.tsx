import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { APP_TYPES, DEGREE_LEVELS } from '@projectforge/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui';

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
export default function CustomNew() {
  const { user } = useAuth(); const nav = useNavigate(); const qc = useQueryClient();
  const [f, setF] = useState({ title: '', idea: '', abstract: '', degree: user?.degree ?? '', department: '', appType: 'web', preferredTech: '', features: '', roles: '', databaseReq: '', references: '', deadline: '', budgetRange: '', docsRequired: '', deploymentReq: '', notes: '' });
  const [err, setErr] = useState<string>();
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const create = useMutation({
    mutationFn: () => api.post<{ request: { _id: string } }>('/custom-requests', { title: f.title, idea: f.idea, abstract: f.abstract, degree: f.degree || undefined, department: f.department || undefined, appType: f.appType, preferredTech: csv(f.preferredTech), features: lines(f.features), roles: csv(f.roles), databaseReq: f.databaseReq || undefined, references: lines(f.references), deadline: f.deadline || undefined, budgetRange: f.budgetRange || undefined, docsRequired: f.docsRequired || undefined, deploymentReq: f.deploymentReq || undefined, notes: f.notes || undefined }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['custom'] }); nav(`/dashboard/custom/${r.request._id}`); },
    onError: (e) => { const a = e as ApiError; setErr(a.details ? `${a.message}: ${Object.entries(a.details).map(([k, v]) => `${k} — ${v.join(', ')}`).join('; ')}` : a.message); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  });
  return (
    <div className="max-w-3xl space-y-6"><div><Link to="/dashboard/custom" className="label inline-flex items-center gap-1 hover:text-brand"><ArrowLeft className="size-3" />requests</Link><h1 className="display text-3xl">Request a custom project</h1><p className="mt-1 text-sm text-muted">The more detail you give, the more accurate the quotation. You’ll be able to discuss anything with the team before agreeing to a price.</p></div>
      {err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setErr(undefined); create.mutate(); }}>
        <Card className="space-y-4 p-5"><h2 className="font-semibold">The idea</h2>
          <Field label="Project title *"><Input required minLength={5} maxLength={140} value={f.title} onChange={up('title')} placeholder="Smart attendance system with face recognition" /></Field>
          <Field label="Describe your idea *"><Textarea required minLength={20} maxLength={5000} rows={5} value={f.idea} onChange={up('idea')} placeholder="What should it do? Who will use it? What problem does it solve?" /></Field>
          <Field label="Abstract / problem statement"><Textarea maxLength={5000} rows={3} value={f.abstract} onChange={up('abstract')} /></Field></Card>
        <Card className="space-y-4 p-5"><h2 className="font-semibold">Academic details</h2>
          <div className="grid gap-4 sm:grid-cols-3"><Field label="Degree"><Select value={f.degree} onChange={up('degree')}><option value="">Select…</option>{DEGREE_LEVELS.map((d) => <option key={d}>{d}</option>)}</Select></Field><Field label="Department / course"><Input maxLength={100} value={f.department} onChange={up('department')} placeholder="Computer Science" /></Field>
            <Field label="Application type"><Select value={f.appType} onChange={up('appType')}>{APP_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Deadline"><Input type="date" value={f.deadline} onChange={up('deadline')} /></Field><Field label="Budget range"><Input maxLength={60} value={f.budgetRange} onChange={up('budgetRange')} placeholder="₹8,000 – ₹12,000" /></Field></div></Card>
        <Card className="space-y-4 p-5"><h2 className="font-semibold">Requirements</h2>
          <Field label="Preferred technologies (comma separated)"><Input value={f.preferredTech} onChange={up('preferredTech')} placeholder="React, Node.js, MongoDB" /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Required features (one per line)"><Textarea rows={5} value={f.features} onChange={up('features')} /></Field><Field label="User roles (comma separated)"><Textarea rows={5} value={f.roles} onChange={up('roles')} placeholder="Admin, Teacher, Student" /></Field></div>
          <Field label="Database requirements"><Input maxLength={300} value={f.databaseReq} onChange={up('databaseReq')} placeholder="MySQL, ~5 tables" /></Field>
          <Field label="Reference websites / apps (one URL per line)"><Textarea rows={3} value={f.references} onChange={up('references')} placeholder="https://example.com" /></Field></Card>
        <Card className="space-y-4 p-5"><h2 className="font-semibold">Deliverables</h2>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Documentation required"><Input maxLength={500} value={f.docsRequired} onChange={up('docsRequired')} placeholder="Project report, PPT, synopsis" /></Field><Field label="Deployment requirements"><Input maxLength={500} value={f.deploymentReq} onChange={up('deploymentReq')} placeholder="Deploy on a free tier host" /></Field></div>
          <Field label="Anything else?"><Textarea maxLength={2000} rows={3} value={f.notes} onChange={up('notes')} /></Field></Card>
        <Button size="lg" disabled={create.isPending}>{create.isPending ? 'Submitting…' : 'Submit request'}</Button>
      </form>
    </div>
  );
}
