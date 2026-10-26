import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, FileUp } from 'lucide-react';
import { APP_TYPES, DEGREE_LEVELS, DIFFICULTIES, SOURCE_TYPES } from '@projectforge/shared';
import { api, ApiError } from '@/lib/api';
import type { Category } from '@/lib/types';
import { Markdown } from '@/components/Markdown';
import { Button, Card, Field, Input, Skeleton, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { FilesAdmin } from './AdminCustom';

interface F {
  title: string; summary: string; description: string; abstract: string; features: string; prerequisites: string; technologies: string; category: string;
  appType: string; degreeLevels: string[]; difficulty: string; language: string; framework: string; database: string; hw: string; sw: string;
  rupees: string; screenshots: string; thumbnail: string; demoUrl: string; videoUrl: string;
  srcType: string; repoUrl: string; author: string; license: string; redistributionAllowed: boolean; licenseReviewed: boolean; attribution: string;
  version: string; supportPolicy: string; verification: string; lastTestedAt: string; status: string; featured: boolean; readme: string; setupGuide: string;
}
const empty: F = { title: '', summary: '', description: '', abstract: '', features: '', prerequisites: '', technologies: '', category: '', appType: 'web', degreeLevels: [], difficulty: 'intermediate', language: '', framework: '', database: '', hw: '', sw: '', rupees: '0', screenshots: '', thumbnail: '', demoUrl: '', videoUrl: '', srcType: 'original', repoUrl: '', author: '', license: '', redistributionAllowed: false, licenseReviewed: false, attribution: '', version: '1.0.0', supportPolicy: '', verification: 'unverified', lastTestedAt: '', status: 'draft', featured: false, readme: '', setupGuide: '' };
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const sel = 'mono h-11 w-full rounded-md border border-line bg-surface px-3 text-sm';
const area = 'mono w-full rounded-md border border-line bg-surface p-3 text-sm';

function toForm(p: any): F {
  return { title: p.title, summary: p.summary, description: p.description ?? '', abstract: p.abstract ?? '', features: (p.features ?? []).join('\n'), prerequisites: (p.prerequisites ?? []).join('\n'), technologies: (p.technologies ?? []).join(', '), category: String(p.category), appType: p.appType, degreeLevels: p.degreeLevels ?? [], difficulty: p.difficulty, language: p.language ?? '', framework: p.framework ?? '', database: p.database ?? '', hw: (p.requirements?.hardware ?? []).join('\n'), sw: (p.requirements?.software ?? []).join('\n'), rupees: String(p.pricePaise / 100), screenshots: (p.screenshots ?? []).join('\n'), thumbnail: p.thumbnail ?? '', demoUrl: p.demoUrl ?? '', videoUrl: p.videoUrl ?? '', srcType: p.source?.type ?? 'original', repoUrl: p.source?.repoUrl ?? '', author: p.source?.author ?? '', license: p.source?.license ?? '', redistributionAllowed: !!p.source?.redistributionAllowed, licenseReviewed: !!p.source?.licenseReviewed, attribution: p.source?.attribution ?? '', version: p.version ?? '1.0.0', supportPolicy: p.supportPolicy ?? '', verification: p.verification, lastTestedAt: p.lastTestedAt ? String(p.lastTestedAt).slice(0, 10) : '', status: p.status, featured: !!p.featured, readme: p.readme?.content ?? '', setupGuide: p.setupGuide ?? '' };
}
const toBody = (f: F) => ({
  title: f.title, summary: f.summary, description: f.description, abstract: f.abstract, features: lines(f.features), prerequisites: lines(f.prerequisites), technologies: csv(f.technologies), category: f.category,
  appType: f.appType, degreeLevels: f.degreeLevels, difficulty: f.difficulty, language: f.language, framework: f.framework, database: f.database, requirements: { hardware: lines(f.hw), software: lines(f.sw) },
  pricePaise: Math.round((Number(f.rupees) || 0) * 100), screenshots: lines(f.screenshots), thumbnail: f.thumbnail, demoUrl: f.demoUrl, videoUrl: f.videoUrl,
  source: { type: f.srcType, repoUrl: f.repoUrl, author: f.author, license: f.license, redistributionAllowed: f.redistributionAllowed, licenseReviewed: f.licenseReviewed, attribution: f.attribution },
  version: f.version, supportPolicy: f.supportPolicy, verification: f.verification, lastTestedAt: f.lastTestedAt, status: f.status, featured: f.featured, readme: f.readme, setupGuide: f.setupGuide,
});

export default function AdminProjectEditor() {
  const { id } = useParams(); const isNew = !id || id === 'new'; const nav = useNavigate(); const qc = useQueryClient();
  const [f, setF] = useState<F>(empty); const [tab, setTab] = useState<'write' | 'preview'>('write'); const [err, setErr] = useState<string>(); const [ok, setOk] = useState<string>(); const file = useRef<HTMLInputElement>(null);
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api.get<{ items: Category[] }>('/categories') });
  const existing = useQuery({ queryKey: ['admin', 'project', id], enabled: !isNew, queryFn: () => api.get<{ project: any }>(`/admin/projects/${id}`) });
  useEffect(() => { if (existing.data) setF(toForm(existing.data.project)); }, [existing.data]);
  useEffect(() => { if (isNew && cats.data && !f.category) setF((s) => ({ ...s, category: cats.data!.items[0]?._id ?? '' })); }, [isNew, cats.data, f.category]);
  const up = <K extends keyof F>(k: K, v: F[K]) => setF((s) => ({ ...s, [k]: v }));
  const text = (k: keyof F) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => up(k, e.target.value as never) });

  const save = useMutation({
    mutationFn: () => isNew ? api.post<{ project: { _id: string } }>('/admin/projects', toBody(f)) : api.patch<{ project: { _id: string } }>(`/admin/projects/${id}`, toBody(f)),
    onSuccess: (r) => { setErr(undefined); qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['projects'] }); qc.invalidateQueries({ queryKey: ['readme'] }); if (isNew) nav(`/admin/projects/${r.project._id}`, { replace: true }); else setOk('Saved.'); },
    onError: (e) => { setOk(undefined); const a = e as ApiError; const d = a.details ? Object.entries(a.details).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' · ') : ''; setErr(`${a.message}${d ? ` — ${d}` : ''}`); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  });
  const fetchReadme = useMutation({ mutationFn: () => api.post<{ readme: string }>(`/admin/projects/${id}/fetch-readme`), onSuccess: (r) => { up('readme', r.readme); setOk('README fetched from GitHub.'); setErr(undefined); }, onError: (e) => setErr((e as ApiError).message) });
  const loadFile = async (file?: File) => { if (!file) return; if (file.size > 200_000) return setErr('README file is larger than 200 KB'); up('readme', await file.text()); setTab('preview'); };

  if (!isNew && existing.isLoading) return <Skeleton className="h-96" />;
  return (
    <form onSubmit={(e) => { e.preventDefault(); setOk(undefined); save.mutate(); }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><Link to="/admin/projects" className="label inline-flex items-center gap-1 hover:text-brand"><ArrowLeft className="size-3" />projects</Link><h1 className="display text-3xl">{isNew ? 'Add project' : 'Edit project'}</h1></div>
        <Button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save project'}</Button></div>
      {err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}
      {ok && <p role="status" className="rounded bg-brand/10 p-3 text-sm text-[color:var(--brand-text)]">{ok}</p>}

      <Card className="space-y-4 p-5"><h2 className="font-semibold">Basics</h2>
        <Field label="Title *"><Input required minLength={3} maxLength={140} {...text('title')} /></Field>
        <Field label="Short summary * (max 300)"><Input required maxLength={300} {...text('summary')} /></Field>
        <Field label="Description"><textarea rows={4} className={area} {...text('description')} /></Field>
        <Field label="Abstract"><textarea rows={3} className={area} {...text('abstract')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Features (one per line)"><textarea rows={4} className={area} {...text('features')} /></Field><Field label="Prerequisites (one per line)"><textarea rows={4} className={area} {...text('prerequisites')} /></Field></div></Card>

      <Card className="space-y-4 p-5"><h2 className="font-semibold">Classification &amp; technology</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category *"><select required className={sel} value={f.category} onChange={(e) => up('category', e.target.value)}>{cats.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></Field>
          <Field label="Application type"><select className={sel} value={f.appType} onChange={(e) => up('appType', e.target.value)}>{APP_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Difficulty"><select className={sel} value={f.difficulty} onChange={(e) => up('difficulty', e.target.value)}>{DIFFICULTIES.map((t) => <option key={t}>{t}</option>)}</select></Field></div>
        <fieldset><legend className="mb-1.5 text-sm font-medium">Suitable degrees</legend><div className="flex flex-wrap gap-2">{DEGREE_LEVELS.map((d) => { const on = f.degreeLevels.includes(d); return <button type="button" key={d} aria-pressed={on} onClick={() => up('degreeLevels', on ? f.degreeLevels.filter((x) => x !== d) : [...f.degreeLevels, d])} className={cn('mono rounded border px-2.5 py-1 text-xs', on ? 'border-brand bg-brand text-onbrand' : 'border-line text-muted hover:border-brand')}>{d}</button>; })}</div></fieldset>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Language"><Input {...text('language')} placeholder="Java" /></Field><Field label="Framework"><Input {...text('framework')} placeholder="Spring Boot" /></Field><Field label="Database"><Input {...text('database')} placeholder="MySQL" /></Field></div>
        <Field label="Technologies (comma separated)"><Input {...text('technologies')} placeholder="React, Node.js, MongoDB" /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Software requirements (one per line)"><textarea rows={3} className={area} {...text('sw')} /></Field><Field label="Hardware requirements (one per line)"><textarea rows={3} className={area} {...text('hw')} /></Field></div></Card>

      <Card className="space-y-4 p-5"><h2 className="font-semibold">Pricing &amp; publishing</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Price (₹, 0 = free)"><Input type="number" min={0} step="1" {...text('rupees')} /></Field>
          <Field label="Status"><select className={sel} value={f.status} onChange={(e) => up('status', e.target.value)}><option>draft</option><option>published</option><option>unpublished</option></select></Field>
          <Field label="Verification"><select className={sel} value={f.verification} onChange={(e) => up('verification', e.target.value)}><option>unverified</option><option>verified</option></select></Field>
          <Field label="Last tested"><Input type="date" {...text('lastTestedAt')} /></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Version"><Input {...text('version')} /></Field><Field label="Support policy"><Input {...text('supportPolicy')} /></Field></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={f.featured} onChange={(e) => up('featured', e.target.checked)} />Featured</label>
        <p className="label">Only mark “verified” if your team has actually run this project.</p></Card>

      <Card className="space-y-4 p-5"><h2 className="font-semibold">Source &amp; license</h2>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Origin"><select className={sel} value={f.srcType} onChange={(e) => up('srcType', e.target.value)}>{SOURCE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field><Field label="Author / owner"><Input {...text('author')} /></Field><Field label="License (SPDX)"><Input {...text('license')} placeholder="MIT" /></Field></div>
        <Field label="Original repository URL"><Input type="url" {...text('repoUrl')} placeholder="https://github.com/owner/repo" /></Field>
        <Field label="Attribution notice"><Input {...text('attribution')} /></Field>
        <div className="flex flex-wrap gap-6 text-sm"><label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={f.redistributionAllowed} onChange={(e) => up('redistributionAllowed', e.target.checked)} />License permits redistribution</label><label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={f.licenseReviewed} onChange={(e) => up('licenseReviewed', e.target.checked)} />I reviewed this license</label></div>
        <p className="label">“authorized-redistribution” is rejected unless the license is reviewed and permits redistribution.</p></Card>

      <Card className="space-y-4 p-5"><h2 className="font-semibold">Media</h2>
        <Field label="Thumbnail URL"><Input type="url" {...text('thumbnail')} /></Field>
        <Field label="Screenshot URLs (one per line)"><textarea rows={3} className={area} {...text('screenshots')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Live demo URL"><Input type="url" {...text('demoUrl')} /></Field><Field label="Demo video (YouTube/Vimeo embed URL)"><Input type="url" {...text('videoUrl')} placeholder="https://www.youtube.com/embed/…" /></Field></div></Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">README.md <span className="label">(shown to users on the project page)</span></h2>
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept=".md,.markdown,text/markdown,text/plain" hidden onChange={(e) => loadFile(e.target.files?.[0])} />
            <Button type="button" size="sm" variant="secondary" onClick={() => file.current?.click()}><FileUp className="size-4" />Upload .md</Button>
            {!isNew && f.repoUrl && <Button type="button" size="sm" variant="secondary" disabled={fetchReadme.isPending} onClick={() => fetchReadme.mutate()}><Download className="size-4" />{fetchReadme.isPending ? 'Fetching…' : 'Fetch from GitHub'}</Button>}</div></div>
        <div role="tablist" className="flex gap-1">{(['write', 'preview'] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('mono rounded px-3 py-1 text-xs', tab === t ? 'bg-brand text-onbrand' : 'text-muted hover:text-ink')}>{t}</button>)}</div>
        {tab === 'write' ? <textarea rows={16} className={area} value={f.readme} onChange={(e) => up('readme', e.target.value)} placeholder={'# Project name\n\n## Prerequisites\n…\n\n## Installation\n```bash\nnpm install\n```'} aria-label="README markdown" />
          : <div className="max-h-[28rem] overflow-y-auto rounded-md border border-line p-4">{f.readme.trim() ? <Markdown source={f.readme} repoUrl={f.repoUrl} /> : <p className="text-sm text-muted">Nothing to preview. Leave empty to show an auto-generated, clearly-labelled generic guide (or the GitHub README for imported projects).</p>}</div>}
      </Card>
      <Card className="space-y-3 p-5"><h2 className="font-semibold">Private setup guide <span className="label">(shown only to customers who bought this project)</span></h2>
        <Textarea rows={8} value={f.setupGuide} onChange={(e) => up('setupGuide', e.target.value)} aria-label="Setup guide markdown" placeholder={'# Setup guide\n\nStep-by-step instructions you have actually tested…'} />
        <p className="label">A paid project can only be purchased once it has a setup guide or at least one downloadable file.</p></Card>
      {!isNew && <FilesAdminSection id={id!} />}
      <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => nav('/admin/projects')}>Cancel</Button><Button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save project'}</Button></div>
    </form>
  );
}

function FilesAdminSection({ id }: { id: string }) {
  const qc = useQueryClient(); const [err, setErr] = useState<string>();
  const q = useQuery({ queryKey: ['admin', 'project-files', id], queryFn: () => api.get<{ items: any[] }>(`/admin/projects/${id}/files`) });
  return <>{err && <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-500">{err}</p>}<FilesAdmin kind="project" id={id} files={q.data?.items ?? []} onChange={() => { setErr(undefined); qc.invalidateQueries({ queryKey: ['admin', 'project-files', id] }); }} onError={(e) => setErr((e as ApiError).message)} /></>;
}
