import { Bookmark } from 'lucide-react';
import { useBookmarks } from '@/hooks/useBookmarks';
import { EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { ProjectCard } from '@/components/ProjectCard';

export default function Saved() {
  const { items, loading } = useBookmarks();
  return (
    <div className="space-y-6"><div><p className="label">// saved</p><h1 className="display text-3xl">Saved projects</h1></div>
      {loading && <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>}
      {!loading && items.length === 0 && <EmptyState title="Nothing saved yet" body="Tap the bookmark icon on any project to keep it here for later." action={<LinkButton to="/dashboard/projects"><Bookmark className="size-4" />Browse projects</LinkButton>} />}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{items.map((p) => <ProjectCard key={p._id} p={p} />)}</div>
    </div>
  );
}
