import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Globe, Smartphone, Monitor, Brain, BarChart3, ShieldCheck, Cloud, Cpu, Link as LinkIcon, FlaskConical, Folder } from 'lucide-react';
import { api } from '@/lib/api';
import type { Category, Facets, Paged, ProjectCardData } from '@/lib/types';
import { LinkButton, Button, EmptyState, ErrorState } from '@/components/ui';
import { ProjectCard, ProjectCardSkeleton } from '@/components/ProjectCard';
import MatrixRain from '@/components/MatrixRain';
import { cn } from '@/lib/cn';

const Hologram = lazy(() => import('@/components/Hologram'));
const icons: Record<string, typeof Globe> = { Globe, Smartphone, Monitor, Brain, BarChart3, ShieldCheck, Cloud, Cpu, Link: LinkIcon, FlaskConical, Folder };

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null); const inView = useInView(ref, { once: true }); const [n, setN] = useState(0);
  useEffect(() => { if (!inView) return; const t0 = performance.now(); let raf = 0; const f = (t: number) => { const k = Math.min((t - t0) / 1200, 1); setN(Math.round(to * (1 - (1 - k) ** 3))); if (k < 1) raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, [inView, to]);
  return <span ref={ref}>{n.toLocaleString('en-IN')}</span>;
}
/** Types text once (instantly when reduced motion is on). */
function Typed({ text, speed = 38 }: { text: string; speed?: number }) {
  const [n, setN] = useState(matchMedia('(prefers-reduced-motion: reduce)').matches ? text.length : 0);
  useEffect(() => { if (n >= text.length) return; const t = setTimeout(() => setN(n + 1), speed); return () => clearTimeout(t); }, [n, text, speed]);
  return <span className={n < text.length ? 'cursor' : ''}>{text.slice(0, n)}</span>;
}

const DEGREES = ['BCA', 'MCA', 'B.Tech', 'M.Tech', 'Diploma'];
const STACKS = ['Python', 'Java', 'JavaScript', 'PHP', 'C#', 'Android', 'Dart'];
const BUDGETS = [['free', 'free'], ['u200', '<₹200']] as const;

/** CLI-style finder: toggles build a real command + query; match count comes live from the API. */
function Finder() {
  const nav = useNavigate();
  const [degree, setDegree] = useState(''); const [stack, setStack] = useState(''); const [budget, setBudget] = useState('');
  const qs = useMemo(() => { const p = new URLSearchParams(); if (degree) p.set('degree', degree); if (stack) p.set('tech', stack); if (budget === 'free') p.set('pricing', 'free'); if (budget === 'u200') { p.set('pricing', 'paid'); p.set('maxPrice', '200'); } return p.toString(); }, [degree, stack, budget]);
  const count = useQuery({ queryKey: ['finder', qs], queryFn: () => api.get<Paged<ProjectCardData>>(`/projects?limit=1&${qs}`), placeholderData: keepPreviousData });
  const cmd = `forge find${degree ? ` --degree ${degree}` : ''}${stack ? ` --stack ${stack}` : ''}${budget ? ` --budget ${budget === 'free' ? 'free' : '<200'}` : ''}`;
  const Row = ({ flag, items, value, set }: { flag: string; items: readonly (string | readonly [string, string])[]; value: string; set: (v: string) => void }) => (
    <div className="grid gap-1.5 sm:grid-cols-[96px_1fr] sm:items-center">
      <p className="mono text-xs text-brand">--{flag}</p>
      <div className="flex flex-wrap gap-1.5">{items.map((it) => { const [v, l] = typeof it === 'string' ? [it, it] : it; return (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => set(value === v ? '' : v)} className={cn('mono rounded border px-2.5 py-1 text-xs transition', value === v ? 'border-brand bg-brand text-onbrand' : 'border-line text-muted hover:border-brand hover:text-ink')}>{l}</button>); })}</div>
    </div>);
  return (
    <div className="sheet relative z-10 overflow-hidden" style={{ background: 'color-mix(in oklab, var(--surface) 90%, transparent)' }}>
      <div className="term-bar"><i /><i /><i /><span className="label ml-2">forge@student:~</span></div>
      <div className="space-y-3 p-5">
        <Row flag="degree" items={DEGREES} value={degree} set={setDegree} />
        <Row flag="stack" items={STACKS} value={stack} set={setStack} />
        <Row flag="budget" items={BUDGETS} value={budget} set={setBudget} />
        <div className="mono rounded bg-surface-2 px-3 py-2 text-sm"><span className="text-brand">$ </span>{cmd}<br /><span aria-live="polite" className="text-muted">&gt; <span className="font-bold text-ink">{count.data ? count.data.total.toLocaleString('en-IN') : '…'}</span> matches</span></div>
        <Button className="w-full" onClick={() => nav(`/projects${qs ? `?${qs}` : ''}`)}>run <ArrowRight className="size-4" /></Button>
      </div>
    </div>
  );
}

const bento = ['sm:col-span-2 sm:row-span-2', '', '', 'sm:col-span-2', '', '', 'sm:col-span-2', 'sm:col-span-2', '', ''];

export default function Home() {
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api.get<{ items: Category[] }>('/categories') });
  const facets = useQuery({ queryKey: ['facets'], queryFn: () => api.get<Facets>('/projects/facets') });
  const all = useQuery({ queryKey: ['projects', 'count'], queryFn: () => api.get<Paged<ProjectCardData>>('/projects?limit=1') });
  const freeN = useQuery({ queryKey: ['projects', 'count-free'], queryFn: () => api.get<Paged<ProjectCardData>>('/projects?pricing=free&limit=1') });
  const popular = useQuery({ queryKey: ['projects', 'popular'], queryFn: () => api.get<Paged<ProjectCardData>>('/projects?limit=6&sort=popular') });
  const free = useQuery({ queryKey: ['projects', 'free'], queryFn: () => api.get<Paged<ProjectCardData>>('/projects?pricing=free&limit=4') });
  const techs = facets.data?.technologies.slice(0, 22) ?? [];

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <MatrixRain className="fade-b absolute inset-0 -z-10 h-full w-full opacity-[0.32]" />
        <div className="aurora -left-24 top-0 -z-10 size-[26rem] bg-emerald-400" />
        <div className="absolute inset-y-0 right-[-10%] -z-10 hidden w-[50%] lg:block"><Suspense fallback={null}><Hologram className="absolute inset-0" /></Suspense></div>
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <p className="mono text-sm text-muted"><span className="text-brand">root@projectforge</span>:<span className="text-sky-400">~</span>$ <Typed text="./launch --project final-year --stack any" /></p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="display glow mt-5 text-[clamp(2.8rem,9.5vw,8rem)]">
            <span className="glitch" data-text="Fork it.">Fork it.</span><br /><span className="holo-text">Run it.</span><br /><span className="text-ink/35">Ace the viva.</span>
          </motion.h1>
          <div className="mt-10 grid items-end gap-8 lg:grid-cols-[1fr_480px]">
            <div className="max-w-xl">
              <p className="text-lg text-muted">{all.data ? <><strong className="text-ink">{all.data.total.toLocaleString('en-IN')}</strong> licensed open-source &amp; curated projects</> : 'Hundreds of projects'} in Python, MERN, Java, .NET, PHP and Android — license shown on every one. Nothing to match? We’ll build it for you.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton to="/projects" size="lg">ls ./projects <ArrowRight className="size-4" /></LinkButton>
                <LinkButton to="/custom" variant="secondary" size="lg">sudo build --custom</LinkButton>
              </div>
              <dl className="mono mt-8 flex gap-8">{[['projects', all.data?.total], ['free', freeN.data?.total], ['categories', cats.data?.items.length]].map(([k, v]) => <div key={k as string}><dd className="text-3xl font-bold text-brand">{typeof v === 'number' ? <CountUp to={v} /> : '–'}</dd><dt className="label">{k}</dt></div>)}</dl>
            </div>
            <Finder />
          </div>
        </div>
      </section>

      {techs.length > 0 && <div className="overflow-hidden border-y border-line bg-surface py-2.5" aria-label="Popular technologies">
        <div className="ticker mono">{[...techs, ...techs].map((t, i) => <Link key={i} to={`/projects?tech=${encodeURIComponent(t.name)}`} className="mx-4 shrink-0 text-sm text-muted hover:text-brand"><span className="text-brand">$</span> {t.name.toLowerCase()} <span className="opacity-50">[{t.count}]</span></Link>)}</div></div>}

      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <p className="label">// 01 categories</p>
        <h2 className="display mt-2 text-4xl sm:text-5xl">ls -la <span className="text-brand">./build</span></h2>
        <div className="mt-10 grid auto-rows-[120px] gap-4 sm:grid-cols-4">
          {cats.isLoading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)}
          {cats.error && <div className="col-span-full"><ErrorState message="Could not load categories." retry={() => cats.refetch()} /></div>}
          {cats.data?.items.map((c, i) => { const I = icons[c.icon] ?? Folder; const big = i === 0; return (
            <Link key={c._id} to={`/projects?category=${c.slug}`} className={cn('sheet group relative flex flex-col justify-between overflow-hidden p-4', bento[i % bento.length])}>
              <I className={cn('text-brand', big ? 'size-9' : 'size-5')} aria-hidden strokeWidth={1.75} />
              <div><p className={cn('mono font-bold leading-tight', big ? 'text-2xl' : 'text-sm')}>{c.slug}/</p><p className="label mt-1">{c.projectCount.toLocaleString('en-IN')} items</p></div>
              <ArrowUpRight className="absolute right-3 top-3 size-4 text-brand opacity-0 transition group-hover:opacity-100" aria-hidden />
              {big && <span aria-hidden className="display pointer-events-none absolute -bottom-6 right-2 text-[9rem] text-brand/[0.06]">{'{}'}</span>}
            </Link>); })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <div className="flex items-end justify-between gap-4"><div><p className="label">// 02 most viewed</p><h2 className="display mt-2 text-4xl sm:text-5xl">cat <span className="text-brand">top.log</span></h2></div><Link to="/projects?sort=popular" className="mono text-sm text-[color:var(--brand-text)] hover:underline">view all →</Link></div>
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {popular.isLoading && Array.from({ length: 3 }).map((_, i) => <ProjectCardSkeleton key={i} />)}
          {popular.error && <div className="col-span-full"><ErrorState message="Could not load projects." retry={() => popular.refetch()} /></div>}
          {popular.data?.items.map((p) => <ProjectCard key={p._id} p={p} />)}
          {popular.data?.items.length === 0 && <div className="col-span-full"><EmptyState title="No projects yet" body="Published projects will appear here." /></div>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <p className="label">// 03 workflow</p><h2 className="display mt-2 text-4xl sm:text-5xl">from idea to <span className="text-brand">viva</span></h2>
        <div className="sheet mono mt-10 overflow-hidden text-sm">
          <div className="term-bar"><i /><i /><i /><span className="label ml-2">workflow.log</span></div>
          <ol className="divide-y divide-line">{[['pick', 'Filter by degree, stack and budget. License is always shown.'], ['run', 'Follow the original README or our setup guide. Stuck? Open a ticket.'], ['own', 'Understand it, extend it, document it. Follow your institution’s rules.'], ['commission', 'No match? Request a custom build with a quote, milestones and delivery.']].map(([t, d], i) => (
            <li key={t} className="grid gap-1 px-4 py-3 sm:grid-cols-[70px_110px_1fr_auto] sm:items-center sm:gap-4"><span className="text-muted">[0{i + 1}]</span><span className="font-bold text-brand">{t}</span><span className="font-sans text-muted">{d}</span><span className="text-emerald-500">OK</span></li>))}</ol>
        </div>
      </section>

      <section className="mx-auto mt-24 grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-2">
        <div className="sheet overflow-hidden"><div className="term-bar"><i /><i /><i /><span className="label ml-2">cat free-library.md</span></div>
          <div className="p-6"><h3 className="display text-3xl">learn from real code</h3>
            <p className="mt-3 max-w-md text-sm text-muted">Beginner projects are free. Every listing shows author, license and the original link — we never claim third-party work as ours.</p>
            <div className="mt-5 space-y-2">{free.data?.items.map((p) => <Link key={p._id} to={`/projects/${p.slug}`} className="mono flex items-center justify-between rounded border border-line px-3 py-2 text-sm capitalize hover:border-brand hover:text-brand"><span className="truncate">{p.title}</span><ArrowUpRight className="size-4 shrink-0" /></Link>)}</div>
            <LinkButton to="/projects?pricing=free" variant="secondary" className="mt-6">ls --free</LinkButton></div></div>
        <div className="sheet relative overflow-hidden" style={{ borderColor: 'var(--color-brand)' }}><div className="term-bar"><i /><i /><i /><span className="label ml-2">sudo build --custom</span></div>
          <div className="p-6"><h3 className="display text-3xl">we build your idea</h3>
            <ul className="mono mt-4 space-y-2 text-sm text-muted"><li><span className="text-brand">+</span> web · mobile · desktop · AI/ML · IoT · blockchain</li><li><span className="text-brand">+</span> written quote with scope &amp; milestones</li><li><span className="text-brand">+</span> pay an advance, track progress, pay on delivery</li></ul>
            <LinkButton to="/custom" size="lg" className="mt-8">request_build()</LinkButton></div></div>
      </section>
    </>
  );
}
