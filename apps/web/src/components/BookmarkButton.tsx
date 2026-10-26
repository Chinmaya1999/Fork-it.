import { Bookmark } from 'lucide-react';
import { useBookmarks } from '@/hooks/useBookmarks';
import { cn } from '@/lib/cn';

export function BookmarkButton({ id, className, label = false }: { id: string; className?: string; label?: boolean }) {
  const { enabled, ids, toggle } = useBookmarks();
  if (!enabled) return null; // only for logged-in users
  const saved = ids.has(id);
  return (
    <button type="button" aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save project'} title={saved ? 'Saved' : 'Save for later'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(id); }}
      className={cn('inline-flex items-center gap-1.5 rounded border border-line bg-surface/80 p-1.5 text-xs backdrop-blur transition hover:border-brand', saved ? 'text-brand' : 'text-muted', className)}>
      <Bookmark className="size-4" fill={saved ? 'currentColor' : 'none'} />{label && (saved ? 'Saved' : 'Save')}
    </button>
  );
}
