import { useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, ExternalLink, ShieldAlert, Info } from 'lucide-react';
import { formatINR } from '@projectforge/shared';
import { api, ApiError } from '@/lib/api';
import type { ProjectCardData, ProjectDetail } from '@/lib/types';
import { Badge, Button, Card, ErrorState, Skeleton } from '@/components/ui';
import { ProjectCard } from '@/components/ProjectCard';
import { Markdown } from '@/components/Markdown';
import { BookmarkButton } from '@/components/BookmarkButton';
import { PayButton } from '@/features/Checkout';
import { ReportKit } from '@/features/ReportKit';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useProjectsBase } from '@/hooks/useBookmarks';

function Readme({ slug }: { slug: string }) {
  const q = useQuery({ queryKey: ['readme', slug], queryFn: () => api.get<{ markdown: string; source: 'admin' | 'github' | 'generated'; repoUrl: string | null }>(`/projects/${slug}/readme`), staleTime: 600_000 });
  const label = { admin: 'Written by the ProjectForge team', github: 'README from the original repository', generated: 'General guidance — the author published no README' } as const;
  return (
    <section id="readme"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">README — how to set up &amp; run</h2>{q.data && <Badge tone={q.data.source === 'generated' ? 'amber' : 'green'}>{label[q.data.source]}</Badge>}</div>
      <div className="sheet mt-3 overflow-hidden"><div className="term-bar"><i /><i /><i /><span className="label ml-2">README.md</span></div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {q.isLoading && <div className="space-y-3"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-32" /></div>}
          {q.error && <p role="alert" className="text-sm text-red-500">Could not load the README. Try again later.</p>}
          {q.data && <Markdown source={q.data.markdown} repoUrl={q.data.repoUrl} />}
        </div></div></section>
  );
}

const List = ({ items }: { items?: string[] }) => items?.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{items.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="text-sm text-muted">Not specified.</p>;

export default function ProjectDetailPage() {
  const { slug } = useParams(); const base = useProjectsBase(); const { user } = useAuth(); const nav = useNavigate();
  const q = useQuery({ queryKey: ['project', slug], queryFn: () => api.get<{ project: ProjectDetail; related: ProjectCardData[] }>(`/projects/${slug}`), retry: false });
  const { hash } = useLocation();
  useEffect(() => { if (hash && q.data) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }, [hash, q.data]); // the page renders after its data loads, so the browser's own #anchor jump misses
  if (q.isLoading) return <div className="mx-auto max-w-7xl space-y-4 px-4 py-10 sm:px-6"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64" /></div>;
  if (q.error) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState message={(q.error as ApiError).status === 404 ? 'This project does not exist or is not published.' : 'Could not load this project.'} /></div>;
  const { project: p, related } = q.data!;
  document.title = `${p.title} — ProjectForge`;
  const external = p.source.type === 'external-link';

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav className="text-sm text-muted" aria-label="Breadcrumb"><Link to={base} className="hover:text-ink">Projects</Link> / {p.category && <Link to={`${base}?category=${p.category.slug}`} className="hover:text-ink">{p.category.name}</Link>}</nav>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <div>
            <div className="flex flex-wrap gap-2"><Badge tone={p.isFree ? 'green' : 'brand'}>{p.isFree ? 'Free' : 'Paid'}</Badge><Badge className="capitalize">{p.difficulty}</Badge>
              {p.verification === 'verified' ? <Badge tone="green"><BadgeCheck className="size-3" />Verified{p.lastTestedAt ? ` · ${new Date(p.lastTestedAt).toLocaleDateString()}` : ''}</Badge> : <Badge tone="amber"><ShieldAlert className="size-3" />Not yet tested by our team</Badge>}</div>
            <div className="mt-3 flex items-start justify-between gap-3"><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{p.title}</h1><BookmarkButton id={p._id} label className="mt-1 shrink-0 !px-3 !py-2" /></div>
            <p className="mt-3 text-lg text-muted">{p.summary}</p>
          </div>
          {p.isSample && <Card className="flex gap-3 border-amber-500/40 p-4 text-sm"><Info className="size-5 shrink-0 text-amber-500" /><p>This is a <strong>sample development listing</strong>. It has no downloadable files and has not been tested.</p></Card>}
          <section><h2 className="mb-2 text-lg font-semibold">Overview</h2><p className="whitespace-pre-line text-sm leading-relaxed text-muted">{p.description || p.summary}</p></section>
          <Readme slug={p.slug} />
          <ReportKit slug={p.slug} title={p.title} isFree={p.isFree} />
          <section><h2 className="mb-2 text-lg font-semibold">Features</h2><List items={p.features} /></section>
          <div className="grid gap-8 sm:grid-cols-2">
            <section><h2 className="mb-2 text-lg font-semibold">Prerequisites</h2><List items={p.prerequisites} /></section>
            <section><h2 className="mb-2 text-lg font-semibold">System requirements</h2><List items={[...(p.requirements?.software ?? []), ...(p.requirements?.hardware ?? [])]} /></section>
          </div>
          <section><h2 className="mb-2 text-lg font-semibold">Technology</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[['Language', p.language], ['Framework', p.framework], ['Database', p.database], ['Type', p.appType]].map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="font-medium capitalize">{v || '—'}</dd></div>)}</dl>
            <div className="mt-3 flex flex-wrap gap-1.5">{p.technologies.map((t) => <Badge key={t}>{t}</Badge>)}</div>
            <p className="mt-3 text-sm text-muted">Suitable for: {p.degreeLevels.join(', ') || '—'}</p></section>
          {!!p.screenshots?.length && <section><h2 className="mb-2 text-lg font-semibold">Preview</h2><div className="grid gap-3 sm:grid-cols-2">{p.screenshots.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer noopener"><img src={u} alt={`${p.title} preview`} loading="lazy" referrerPolicy="no-referrer" className="w-full rounded-lg border border-line object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></a>)}</div></section>}
          <section><h2 className="mb-2 text-lg font-semibold">Source &amp; license</h2>
            <Card className="space-y-1 p-4 text-sm"><p><span className="text-muted">Origin: </span>{p.source.type.replace(/-/g, ' ')}</p><p><span className="text-muted">Author: </span>{p.source.author ?? 'Unknown'}</p><p><span className="text-muted">License: </span>{p.source.license ?? 'Not stated'}</p>
              {p.source.attribution && <p><span className="text-muted">Attribution: </span>{p.source.attribution}</p>}
              </Card></section>
          {p.videoUrl && /^https:\/\/(www\.)?(youtube\.com\/embed|player\.vimeo\.com\/video)\//.test(p.videoUrl) && <section><h2 className="mb-2 text-lg font-semibold">Demo video</h2><div className="aspect-video overflow-hidden rounded-xl border border-line"><iframe src={p.videoUrl} title="Demo video" className="size-full" loading="lazy" allowFullScreen /></div></section>}
          <section><h2 className="mb-2 text-lg font-semibold">Support</h2><p className="text-sm text-muted">{p.supportPolicy ?? 'See the support policy on purchase.'}</p></section>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start"><div className="holo-border rounded-[var(--radius-card)]"><Card className="space-y-4 p-6">
          <div><p className="text-xs uppercase tracking-wide text-muted">{external && !p.isFree ? 'Setup & support package' : p.isFree ? 'Price' : 'One-time price'}</p>
            <p className="font-mono text-3xl font-semibold">{formatINR(p.pricePaise)}</p><p className="text-xs text-muted">Version {p.version}</p></div>
          {!p.isFree && (!user ? <Link to={`/login?next=${encodeURIComponent(`/projects/${p.slug}`)}`}><Button className="w-full" size="lg">Log in to buy</Button></Link>
            : !p.purchasable ? <Button className="w-full" size="lg" disabled>No deliverable published yet</Button>
            : <PayButton className="w-full" onPaid={() => nav('/dashboard/orders')} create={() => api.post('/orders', { projectId: p._id })}>{external ? 'Buy setup & support' : 'Buy now'} — {formatINR(p.pricePaise)}</PayButton>)}
          <p className="text-xs leading-relaxed text-muted">{p.isFree
            ? 'Free to access at the original source, under its license. We do not claim ownership of this project.'
            : external
            ? 'The source code belongs to its original author and is free at the link above under its license. The paid package covers our setup guide and technical help, not the code itself.'
            : 'Paid downloads are released only after the backend verifies your payment.'}</p>
        </Card></div></aside>
      </div>
      {related.length > 0 && <section className="mt-14"><h2 className="mb-4 text-xl font-bold">Related projects</h2><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{related.map((r) => <ProjectCard key={r._id} p={r} />)}</div></section>}
    </div>
  );
}
