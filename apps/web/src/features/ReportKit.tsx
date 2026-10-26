import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Lock, ShieldCheck } from 'lucide-react';
import { DEGREE_LEVELS } from '@projectforge/shared';
import { api, apiUrl, authHeaders } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import type { OrderView } from '@/pages/dashboard/Orders';

const INCLUDED = ['Title page, certificate, declaration & attribution, acknowledgement, abstract', 'Table of contents, list of figures and tables, abbreviations', '10 chapters in the standard college format (introduction → conclusion)', 'Background on the technologies this project uses, plus software-engineering theory', 'Test-case tables, defect log, screenshot and diagram pages', 'Viva question bank, report-writing checklist, glossary and references'];

/** Generates the editable report scaffold. Access is enforced by the server; this component only decides what to show. */
export function ReportKit({ slug, title, isFree }: { slug: string; title: string; isFree: boolean }) {
  const { user } = useAuth();
  const orders = useQuery({ queryKey: ['orders'], enabled: !!user && !isFree, queryFn: () => api.get<{ items: OrderView[] }>('/orders') });
  const [f, setF] = useState({ studentName: user?.name ?? '', rollNo: '', degree: user?.degree ?? '', department: '', college: user?.college ?? '', university: '', guide: '', year: `${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(2)}` });
  const [busy, setBusy] = useState<'pdf' | 'docx' | null>(null); const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const staff = user?.role === 'admin' || user?.role === 'support';
  const owned = isFree || staff || !!orders.data?.items.some((o) => o.status === 'paid' && o.project?.slug === slug);
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const download = async (format: 'pdf' | 'docx') => {
    setBusy(format); setMsg(undefined);
    try {
      const res = await fetch(apiUrl(`/api/v1/projects/${slug}/report`), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'projectforge', ...authHeaders() }, body: JSON.stringify({ format, details: Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim())) }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error?.message ?? 'Could not generate the report'); }
      const pages = res.headers.get('X-Report-Pages'); const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${slug}-project-report.${format}`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      setMsg({ ok: true, text: `Downloaded (${pages ?? '50+'} pages). Open it, replace every [bracketed] placeholder with your own content, and add your screenshots and results.` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(null); }
  };

  return (
    <section id="report">
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><FileText className="size-5 text-brand" />Project report kit <span className="label">(50+ pages)</span></h2>
      <Card className="space-y-4 p-5">
        <p className="text-sm text-muted">A college-format report scaffold for <strong className="text-ink">{title}</strong>, built from this project’s real details. It is an editable starting point you complete with your own screenshots, diagrams, test results and explanations.</p>
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">{INCLUDED.map((i) => <li key={i} className="flex gap-2"><span className="text-brand">+</span><span className="text-muted">{i}</span></li>)}</ul>
        <div className="flex gap-2 rounded bg-surface-2 p-3 text-xs text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" /><span>Be ready to explain and demonstrate your project in the viva. The declaration page credits the original source and licence and asks you to state what <em>you</em> personally did. Follow your institution’s originality rules.</span></div>
        {!user ? <div className="flex flex-wrap items-center gap-3"><Link to={`/login?next=${encodeURIComponent(`/projects/${slug}`)}`}><Button>Log in to generate</Button></Link><span className="text-sm text-muted">Free for logged-in students on free projects.</span></div>
          : !owned ? <div className="flex items-center gap-2 text-sm text-muted"><Lock className="size-4" />Included when you buy this project.</div>
          : <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Your name"><Input value={f.studentName} onChange={up('studentName')} maxLength={120} /></Field><Field label="Roll / enrolment no."><Input value={f.rollNo} onChange={up('rollNo')} maxLength={60} /></Field>
              <Field label="Degree"><Select value={f.degree} onChange={up('degree')}><option value="">Select…</option>{DEGREE_LEVELS.map((d) => <option key={d}>{d}</option>)}</Select></Field><Field label="Department"><Input value={f.department} onChange={up('department')} maxLength={120} placeholder="Computer Science" /></Field>
              <Field label="College"><Input value={f.college} onChange={up('college')} maxLength={120} /></Field><Field label="University"><Input value={f.university} onChange={up('university')} maxLength={120} /></Field>
              <Field label="Project guide"><Input value={f.guide} onChange={up('guide')} maxLength={120} /></Field><Field label="Academic year"><Input value={f.year} onChange={up('year')} maxLength={20} /></Field></div>
            <div className="flex flex-wrap gap-3"><Button onClick={() => download('docx')} disabled={!!busy}>{busy === 'docx' ? 'Generating…' : 'Download editable DOCX'}</Button><Button variant="secondary" onClick={() => download('pdf')} disabled={!!busy}>{busy === 'pdf' ? 'Generating…' : 'Download PDF'}</Button></div>
            {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded p-3 text-sm ${msg.ok ? 'bg-brand/10 text-[color:var(--brand-text)]' : 'bg-red-500/10 text-red-500'}`}>{msg.text}</p>}
            <p className="label">Leave a field blank to keep a visible [placeholder] you can fill in Word. In the DOCX, right-click the table of contents → Update Field.</p></>}
      </Card>
    </section>
  );
}
