import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, Compass, UserCheck, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useBookmarks } from '@/hooks/useBookmarks';
import type { Paged, ProjectCardData } from '@/lib/types';
import { Card, LinkButton } from '@/components/ui';
import { ProjectCard, ProjectCardSkeleton } from '@/components/ProjectCard';
import { VerifyEmailCard } from '@/components/VerifyEmailCard';

export default function Overview() {
  const { user } = useAuth(); const { ids } = useBookmarks();
  const fields = [user?.name, user?.degree, user?.college, user?.semester]; const done = fields.filter(Boolean).length; const pct = Math.round((done / fields.length) * 100);
  const rec = useQuery({ queryKey: ['recommended', user?.degree], queryFn: () => api.get<Paged<ProjectCardData>>(`/projects?limit=3&sort=popular${user?.degree ? `&degree=${encodeURIComponent(user.degree)}` : ''}`) });
  const tiles = [[Bookmark, 'Saved projects', String(ids.size), '/dashboard/saved'], [UserCheck, 'Profile complete', `${pct}%`, '/dashboard/profile'], [Wrench, 'Custom requests', '—', '/dashboard/custom']] as const;
  return (
    <div className="space-y-8">
      <div><p className="label">// overview</p><h1 className="display text-3xl sm:text-4xl">Hello, <span className="text-brand">{user?.name.split(' ')[0]}</span></h1><p className="mt-1 text-sm text-muted">Find a project, save it, and get set up — everything is in the menu on the left.</p></div>
      <VerifyEmailCard />
      <div className="grid gap-4 sm:grid-cols-3">{tiles.map(([I, k, v, to]) => <Link key={k} to={to}><Card className="p-4 transition hover:border-brand"><I className="size-5 text-brand" /><p className="mono mt-3 text-3xl font-bold">{v}</p><p className="label">{k}</p></Card></Link>)}</div>
      {pct < 100 && <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span>Add your degree, college and semester to get recommendations that fit you.</span><LinkButton to="/dashboard/profile" size="sm" variant="secondary">Complete profile</LinkButton></Card>}
      <section>
        <div className="mb-4 flex items-end justify-between"><h2 className="font-display text-xl font-bold">{user?.degree ? <>Popular for <span className="text-brand">{user.degree}</span></> : 'Popular projects'}</h2><Link to={`/dashboard/projects${user?.degree ? `?degree=${encodeURIComponent(user.degree)}` : ''}`} className="mono inline-flex items-center gap-1 text-sm text-[color:var(--brand-text)] hover:underline">browse all <ArrowRight className="size-3.5" /></Link></div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{rec.isLoading && Array.from({ length: 3 }).map((_, i) => <ProjectCardSkeleton key={i} />)}{rec.data?.items.map((p) => <ProjectCard key={p._id} p={p} />)}</div>
      </section>
      <Card className="flex flex-wrap items-center gap-3 p-4"><Compass className="size-5 text-brand" /><span className="text-sm">Looking for something specific?</span><LinkButton to="/dashboard/projects" size="sm">Browse the catalog</LinkButton></Card>
    </div>
  );
}
