import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { DIFFICULTIES } from '@projectforge/shared';
import { api } from '@/lib/api';
import type { Category, Facets, Paged, ProjectCardData } from '@/lib/types';
import { useDebounced } from '@/hooks/useTheme';
import { Button, EmptyState, ErrorState } from '@/components/ui';
import { ProjectCard, ProjectCardSkeleton } from '@/components/ProjectCard';
import { cn } from '@/lib/cn';

const sel = 'h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-sm';
const Group = ({ title, children }: { title: string; children: React.ReactNode }) => <fieldset className="space-y-2"><legend className="mb-1 text-sm font-semibold">{title}</legend>{children}</fieldset>;
const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) =>
  <button type="button" aria-pressed={on} onClick={onClick} className={cn('mono rounded border px-2.5 py-1 text-xs transition', on ? 'border-brand bg-brand text-onbrand' : 'border-line bg-surface hover:border-brand')}>{children}</button>;

export default function Projects() {
  const [sp, setSp] = useSearchParams();
  const [text, setText] = useState(sp.get('q') ?? '');
  const debounced = useDebounced(text);
  const [show, setShow] = useState(false);
  const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); return n; }, { replace: true });
  useEffect(() => { if (debounced !== (sp.get('q') ?? '')) set('q', debounced); /* eslint-disable-next-line */ }, [debounced]);
  useEffect(() => { document.title = 'Browse projects — ProjectForge'; }, []);

  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api.get<{ items: Category[] }>('/categories') });
  const facets = useQuery({ queryKey: ['facets'], queryFn: () => api.get<Facets>('/projects/facets'), staleTime: 300_000 });
  const qs = sp.toString();
  const list = useQuery({ queryKey: ['projects', qs], queryFn: () => api.get<Paged<ProjectCardData>>(`/projects?${qs}`), placeholderData: keepPreviousData });
  const page = Number(sp.get('page') ?? 1);
  const active = [...sp.keys()].filter((k) => k !== 'page' && k !== 'sort').length;
  const techs = (sp.get('tech') ?? '').split(',').filter(Boolean);
  const toggleTech = (t: string) => set('tech', (techs.includes(t) ? techs.filter((x) => x !== t) : [...techs, t]).join(','));
  const price = sp.get('pricing') ? sp.get('pricing') : sp.get('maxPrice') ? 'u200' : '';
  const setPrice = (v: string) => setSp((p) => { const n = new URLSearchParams(p); ['pricing', 'maxPrice', 'minPrice', 'page'].forEach((k) => n.delete(k));
    if (v === 'free') n.set('pricing', 'free'); if (v === 'paid') n.set('pricing', 'paid'); if (v === 'u200') { n.set('pricing', 'paid'); n.set('maxPrice', '200'); } return n; }, { replace: true });
  const f = facets.data;
  const opt = (a?: { name: string; count: number }[]) => a?.map((x) => <option key={x.name} value={x.name}>{x.name} ({x.count})</option>);

  const Filters = (
    <div className="space-y-5">
      {active > 0 && <Button variant="ghost" size="sm" onClick={() => { setText(''); setSp({}); }}><X className="size-4" />Clear all ({active})</Button>}
      <Group title="Your degree"><div className="flex flex-wrap gap-1.5">{f?.degrees.map((d) => <Chip key={d.name} on={sp.get('degree') === d.name} onClick={() => set('degree', sp.get('degree') === d.name ? '' : d.name)}>{d.name}</Chip>)}</div></Group>
      <Group title="Technology"><div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto pr-1">{f?.technologies.map((t) => <Chip key={t.name} on={techs.includes(t.name)} onClick={() => toggleTech(t.name)}>{t.name}</Chip>)}</div></Group>
      <Group title="Price"><div className="flex flex-wrap gap-1.5">{[['', 'All'], ['free', 'Free'], ['u200', 'Under ₹200'], ['paid', 'Paid']].map(([v, l]) => <Chip key={v} on={price === v} onClick={() => setPrice(v)}>{l}</Chip>)}</div></Group>
      <Group title="Difficulty"><div className="flex flex-wrap gap-1.5">{DIFFICULTIES.map((d) => <Chip key={d} on={sp.get('difficulty') === d} onClick={() => set('difficulty', sp.get('difficulty') === d ? '' : d)}>{d}</Chip>)}</div></Group>
      <label className="block text-sm font-semibold">Category<select className={cn(sel, 'mt-1 font-normal')} value={sp.get('category') ?? ''} onChange={(e) => set('category', e.target.value)}><option value="">All categories</option>{cats.data?.items.map((c) => <option key={c._id} value={c.slug}>{c.name} ({c.projectCount})</option>)}</select></label>
      <label className="block text-sm font-semibold">Application type<select className={cn(sel, 'mt-1 font-normal')} value={sp.get('appType') ?? ''} onChange={(e) => set('appType', e.target.value)}><option value="">All</option>{opt(f?.appTypes)}</select></label>
      <label className="block text-sm font-semibold">Language<select className={cn(sel, 'mt-1 font-normal')} value={sp.get('language') ?? ''} onChange={(e) => set('language', e.target.value)}><option value="">All</option>{opt(f?.languages)}</select></label>
      <label className="block text-sm font-semibold">Database<select className={cn(sel, 'mt-1 font-normal')} value={sp.get('database') ?? ''} onChange={(e) => set('database', e.target.value)}><option value="">Any</option>{opt(f?.databases)}</select></label>
      <label className="block text-sm font-semibold">License<select className={cn(sel, 'mt-1 font-normal')} value={sp.get('license') ?? ''} onChange={(e) => set('license', e.target.value)}><option value="">Any</option>{opt(f?.licenses)}</select></label>
      <label className="block text-sm font-semibold">Source<select className={cn(sel, 'mt-1 font-normal')} value={sp.get('sourceType') ?? ''} onChange={(e) => set('sourceType', e.target.value)}><option value="">Any</option><option value="original">Original (ProjectForge)</option><option value="external-link">Open-source (original repo)</option><option value="authorized-redistribution">Authorised redistribution</option></select></label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={sp.get('verified') === 'true'} onChange={(e) => set('verified', e.target.checked ? 'true' : '')} className="size-4 accent-[var(--color-brand)]" />Verified by our team only</label>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="label">// catalog</p><h1 className="display text-4xl sm:text-5xl"><span className="text-brand">$</span> ls ./projects</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Search" placeholder="Search by title, technology…" className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm" /></div>
        <select aria-label="Sort" className="h-11 rounded-xl border border-line bg-surface px-3 text-sm" value={sp.get('sort') ?? 'newest'} onChange={(e) => set('sort', e.target.value)}>
          <option value="newest">Newest</option><option value="popular">Most viewed</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select>
        <Button variant="secondary" className="lg:hidden" onClick={() => setShow((s) => !s)} aria-expanded={show}><SlidersHorizontal className="size-4" />Filters{active ? ` (${active})` : ''}</Button>
      </div>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className={cn(show ? 'block' : 'hidden', 'lg:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-2')} aria-label="Filters">{Filters}</aside>
        <div>
          {list.error && <ErrorState message="Could not load projects." retry={() => list.refetch()} />}
          {list.isLoading && <div className="grid grid-cols-[minmax(0,1fr)] gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <ProjectCardSkeleton key={i} />)}</div>}
          {list.data && (list.data.items.length === 0
            ? <EmptyState title="No projects match" body="Try removing a filter or searching for something broader." action={<Button variant="secondary" onClick={() => { setText(''); setSp({}); }}>Clear filters</Button>} />
            : <>
              <p className="mb-4 text-sm text-muted" aria-live="polite">{list.data.total.toLocaleString('en-IN')} project{list.data.total === 1 ? '' : 's'}</p>
              <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-6 sm:grid-cols-2 xl:grid-cols-3', list.isPlaceholderData && 'opacity-60')}>{list.data.items.map((p) => <ProjectCard key={p._id} p={p} />)}</div>
              {list.data.pages > 1 && <div className="mt-8 flex items-center justify-center gap-3">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => { set('page', String(page - 1)); window.scrollTo({ top: 0 }); }}>Previous</Button>
                <span className="text-sm text-muted">Page {page} of {list.data.pages}</span>
                <Button variant="secondary" size="sm" disabled={page >= list.data.pages} onClick={() => { set('page', String(page + 1)); window.scrollTo({ top: 0 }); }}>Next</Button></div>}
            </>)}
        </div>
      </div>
    </div>
  );
}
